import React, { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  MessageCircle,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  addGalleryItem,
  deleteGalleryItem,
  seedDefaultsIfNeeded,
  updateSiteSettings,
  uploadFileWithProgress,
} from '../../services/firebaseService';
import { DEFAULT_CATEGORIES, DEFAULT_MENU_VISIBILITY } from '../../data/seedCatalog';
import {
  GALLERY_CATEGORIES,
  type GalleryCategory,
  type GalleryItem,
  type MenuItemKey,
  type OrderRecord,
  type ServiceCategoryConfig,
  type SiteSettings,
} from '../../types/design';
import { MENU_ITEMS, normalizeMenuVisibility } from '../../utils/menuConfig';
import { buildWhatsAppUrl, formatWhatsAppMessage } from '../../utils/orderUtils';
import { SafeImage } from '../SafeImage';

interface AdminSettingsAndGalleryPanelProps {
  section: 'categories' | 'gallery' | 'customers' | 'payment' | 'whatsapp' | 'website';
  gallery: GalleryItem[];
  orders: OrderRecord[];
  settings: SiteSettings;
}

export const AdminSettingsAndGalleryPanel: React.FC<AdminSettingsAndGalleryPanelProps> = ({
  section,
  gallery,
  orders,
  settings,
}) => {
  const [formSettings, setFormSettings] = useState<SiteSettings>(settings);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Gallery add state
  const [galTitle, setGalTitle] = useState('');
  const [galCategory, setGalCategory] = useState<GalleryCategory>('Instagram Designs');
  const [galUrl, setGalUrl] = useState('');
  const [galDesc, setGalDesc] = useState('');
  const [uploadPct, setUploadPct] = useState(0);

  // New Category form state
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [newCatImg, setNewCatImg] = useState('');

  React.useEffect(() => {
    setFormSettings({
      ...settings,
      categories:
        settings.categories && settings.categories.length > 0
          ? settings.categories
          : DEFAULT_CATEGORIES,
      menuVisibility: normalizeMenuVisibility(settings.menuVisibility, DEFAULT_MENU_VISIBILITY),
    });
  }, [settings]);

  const categoriesList: ServiceCategoryConfig[] = useMemo(() => {
    const base =
      formSettings.categories && formSettings.categories.length > 0
        ? formSettings.categories
        : DEFAULT_CATEGORIES;
    return [...base].sort((a, b) => a.displayOrder - b.displayOrder);
  }, [formSettings.categories]);

  const handleToggleMenuVisibility = (key: MenuItemKey) => {
    setFormSettings((prev) => {
      const current = normalizeMenuVisibility(prev.menuVisibility, DEFAULT_MENU_VISIBILITY);
      return {
        ...prev,
        menuVisibility: {
          ...current,
          [key]: !current[key],
        },
      };
    });
  };

  const customers = useMemo(() => {
    const map = new Map<
      string,
      { name: string; mobile: string; count: number; lastOrderId: string }
    >();
    for (const o of orders) {
      const key = o.mobile.replace(/\D/g, '').slice(-10) || o.mobile;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          name: o.customerName,
          mobile: o.mobile,
          count: 1,
          lastOrderId: o.orderId,
        });
      } else {
        existing.count += 1;
      }
    }
    return Array.from(map.values());
  }, [orders]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      await updateSiteSettings(formSettings);
      setMsg('Settings updated in Firestore.');
    } catch {
      setMsg('Failed to update settings.');
    } finally {
      setSaving(false);
    }
  };

  const persistCategories = async (nextCategories: ServiceCategoryConfig[], statusText: string) => {
    const normalized = nextCategories.map((c, idx) => ({
      ...c,
      displayOrder: idx + 1,
    }));
    const updated = { ...formSettings, categories: normalized };
    setFormSettings(updated);
    setSaving(true);
    setMsg(null);
    try {
      await updateSiteSettings(updated);
      setMsg(statusText);
    } catch {
      setMsg('Failed to save categories to Firestore.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newCatName.trim().toUpperCase();
    if (!cleanName) {
      setMsg('Category name is required.');
      return;
    }
    if (categoriesList.some((c) => c.name.toUpperCase() === cleanName)) {
      setMsg('A category with this name already exists.');
      return;
    }
    const next: ServiceCategoryConfig = {
      id: `cat-${Date.now().toString(36)}`,
      name: cleanName,
      description: newCatDesc.trim() || 'Custom design category.',
      imageUrl: newCatImg.trim() || '/images/services/brand-design.png',
      enabled: true,
      displayOrder: categoriesList.length + 1,
    };
    setNewCatName('');
    setNewCatDesc('');
    setNewCatImg('');
    await persistCategories([...categoriesList, next], `Category "${cleanName}" added live.`);
  };

  const handleMoveCategory = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= categoriesList.length) return;
    const copy = [...categoriesList];
    const [item] = copy.splice(index, 1);
    copy.splice(target, 0, item);
    await persistCategories(copy, `Moved "${item.name}" to #${target + 1}.`);
  };

  const handleUploadAsset = async (
    files: FileList | null,
    folder: string,
    onDone: (url: string) => void
  ) => {
    if (!files || !files[0]) return;
    const file = files[0];
    setUploadPct(1);
    try {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const url = await uploadFileWithProgress(
        file,
        `public-assets/${folder}/${Date.now()}_${safe}`,
        setUploadPct
      );
      onDone(url);
      setMsg('Image uploaded successfully.');
    } catch {
      setMsg('Upload failed. Ensure Storage rules are deployed or paste a valid URL.');
    }
  };

  const handleAddGallery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!galTitle.trim() || !galUrl.trim()) {
      setMsg('Title and image are required for gallery items.');
      return;
    }
    setSaving(true);
    try {
      await addGalleryItem({
        id: `gal-${Date.now().toString(36)}`,
        title: galTitle,
        category: galCategory,
        imageUrl: galUrl,
        description: galDesc,
      });
      setGalTitle('');
      setGalUrl('');
      setGalDesc('');
      setUploadPct(0);
      setMsg('Added portfolio item to gallery.');
    } finally {
      setSaving(false);
    }
  };

  if (section === 'categories') {
    return (
      <div className="space-y-6">
        <form onSubmit={handleAddCategory} className="gd-card rounded-2xl p-5 space-y-4">
          <div>
            <h3 className="font-display font-bold text-xl text-[#FFD369]">
              Manage Service Categories ({categoriesList.length})
            </h3>
            <p className="text-xs sm:text-sm text-slate-300">
              Add, edit, upload category cover images, reorder, or enable/disable categories live across Homepage and Services.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <input
              type="text"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="New Category Name (e.g. PACKAGING DESIGN)"
              className="h-10 px-3 rounded-xl bg-[#06142E] border border-[#35AFFF]/35 text-sm text-white"
            />
            <input
              type="text"
              value={newCatDesc}
              onChange={(e) => setNewCatDesc(e.target.value)}
              placeholder="Short description"
              className="h-10 px-3 rounded-xl bg-[#06142E] border border-[#35AFFF]/35 text-sm text-white"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={newCatImg}
              onChange={(e) => setNewCatImg(e.target.value)}
              placeholder="Cover Image URL or upload..."
              className="flex-1 h-10 px-3 rounded-xl bg-[#06142E] border border-[#35AFFF]/35 text-sm text-white"
            />
            <label className="gd-glow-btn-blue px-4 h-10 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer">
              <Upload className="w-4 h-4" aria-hidden="true" />
              Upload Cover {uploadPct > 0 && uploadPct < 100 ? `${uploadPct}%` : ''}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleUploadAsset(e.target.files, 'categories', setNewCatImg)}
                className="hidden"
              />
            </label>
            <button
              type="submit"
              disabled={saving}
              className="gd-glow-btn-gold px-5 h-10 rounded-xl text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              Add Category
            </button>
          </div>
          {msg && <p className="text-xs font-semibold text-emerald-300">{msg}</p>}
        </form>

        <div className="space-y-3">
          {categoriesList.map((cat, idx) => (
            <div key={cat.id} className="gd-card rounded-2xl p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="w-20 h-20 rounded-xl overflow-hidden bg-[#06142E] border border-[#35AFFF]/30 shrink-0">
                  <SafeImage
                    src={cat.imageUrl}
                    alt={cat.name}
                    className="w-full h-full object-cover"
                    fallbackLabel={cat.name}
                  />
                </div>

                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <input
                    type="text"
                    value={cat.name}
                    aria-label={`Category name for ${cat.name}`}
                    onChange={(e) =>
                      setFormSettings((prev) => ({
                        ...prev,
                        categories: categoriesList.map((c) =>
                          c.id === cat.id ? { ...c, name: e.target.value } : c
                        ),
                      }))
                    }
                    className="h-9 px-3 rounded-xl bg-[#06142E] border border-[#35AFFF]/30 text-xs sm:text-sm font-bold text-white"
                  />
                  <input
                    type="text"
                    value={cat.description}
                    aria-label={`Description for ${cat.name}`}
                    onChange={(e) =>
                      setFormSettings((prev) => ({
                        ...prev,
                        categories: categoriesList.map((c) =>
                          c.id === cat.id ? { ...c, description: e.target.value } : c
                        ),
                      }))
                    }
                    className="h-9 px-3 rounded-xl bg-[#06142E] border border-[#35AFFF]/30 text-xs text-slate-200"
                  />
                  <div className="sm:col-span-2 flex gap-2">
                    <input
                      type="text"
                      value={cat.imageUrl}
                      aria-label={`Image URL for ${cat.name}`}
                      onChange={(e) =>
                        setFormSettings((prev) => ({
                          ...prev,
                          categories: categoriesList.map((c) =>
                            c.id === cat.id ? { ...c, imageUrl: e.target.value } : c
                          ),
                        }))
                      }
                      className="flex-1 h-9 px-3 rounded-xl bg-[#06142E] border border-[#35AFFF]/30 text-xs text-slate-300"
                    />
                    <label className="gd-glow-btn-blue px-3 h-9 rounded-xl text-xs font-semibold inline-flex items-center gap-1 cursor-pointer shrink-0">
                      <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                      Upload
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) =>
                          handleUploadAsset(e.target.files, 'categories', (url) => {
                            const updated = categoriesList.map((c) =>
                              c.id === cat.id ? { ...c, imageUrl: url } : c
                            );
                            void persistCategories(updated, `Updated cover image for "${cat.name}".`);
                          })
                        }
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                <div className="flex sm:flex-col items-center gap-1.5 shrink-0">
                  <div className="flex gap-1 w-full">
                    <button
                      type="button"
                      disabled={idx === 0 || saving}
                      onClick={() => handleMoveCategory(idx, -1)}
                      aria-label={`Move ${cat.name} up`}
                      className="flex-1 h-8 px-2 rounded-lg bg-[#06142E] border border-[#35AFFF]/30 text-slate-200 hover:text-[#FFD369] inline-flex items-center justify-center cursor-pointer disabled:opacity-40"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === categoriesList.length - 1 || saving}
                      onClick={() => handleMoveCategory(idx, 1)}
                      aria-label={`Move ${cat.name} down`}
                      className="flex-1 h-8 px-2 rounded-lg bg-[#06142E] border border-[#35AFFF]/30 text-slate-200 hover:text-[#FFD369] inline-flex items-center justify-center cursor-pointer disabled:opacity-40"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() =>
                      void persistCategories(
                        categoriesList.map((c) =>
                          c.id === cat.id ? { ...c, enabled: !c.enabled } : c
                        ),
                        `${cat.name} ${cat.enabled ? 'disabled' : 'enabled'}.`
                      )
                    }
                    className={`w-full px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                      cat.enabled
                        ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200'
                        : 'bg-slate-800 border-slate-600 text-slate-300'
                    }`}
                  >
                    {cat.enabled ? 'Enabled' : 'Disabled'}
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() =>
                      void persistCategories(categoriesList, `Saved "${cat.name}".`)
                    }
                    className="w-full gd-glow-btn-gold px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer"
                  >
                    Save
                  </button>
                  {categoriesList.length > 1 && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() =>
                        void persistCategories(
                          categoriesList.filter((c) => c.id !== cat.id),
                          `Removed "${cat.name}".`
                        )
                      }
                      aria-label={`Delete ${cat.name}`}
                      className="w-full px-3 py-1.5 rounded-lg bg-rose-500/15 border border-rose-400/35 text-xs text-rose-200 hover:bg-rose-500/25 cursor-pointer"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (section === 'gallery') {
    return (
      <div className="space-y-6">
        <form onSubmit={handleAddGallery} className="gd-card rounded-2xl p-5 space-y-4">
          <h3 className="font-display font-bold text-xl text-[#FFD369]">
            Upload Design Portfolio Item
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input
              type="text"
              required
              value={galTitle}
              onChange={(e) => setGalTitle(e.target.value)}
              placeholder="Design Title"
              className="h-10 px-3 rounded-xl bg-[#06142E] border border-[#35AFFF]/35 text-sm text-white"
            />
            <select
              value={galCategory}
              onChange={(e) => setGalCategory(e.target.value as GalleryCategory)}
              className="h-10 px-3 rounded-xl bg-[#06142E] border border-[#35AFFF]/35 text-sm text-white"
            >
              {GALLERY_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              required
              value={galUrl}
              onChange={(e) => setGalUrl(e.target.value)}
              placeholder="Paste image URL or upload file..."
              className="flex-1 h-10 px-3 rounded-xl bg-[#06142E] border border-[#35AFFF]/35 text-sm text-white"
            />
            <label className="gd-glow-btn-blue px-4 h-10 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer">
              <Upload className="w-4 h-4" aria-hidden="true" />
              Upload Image {uploadPct > 0 && uploadPct < 100 ? `${uploadPct}%` : ''}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleUploadAsset(e.target.files, 'gallery', setGalUrl)}
                className="hidden"
              />
            </label>
          </div>

          <input
            type="text"
            value={galDesc}
            onChange={(e) => setGalDesc(e.target.value)}
            placeholder="Short description (optional)"
            className="w-full h-10 px-3 rounded-xl bg-[#06142E] border border-[#35AFFF]/35 text-sm text-white"
          />

          {msg && <p className="text-xs font-semibold text-emerald-300">{msg}</p>}

          <button
            type="submit"
            disabled={saving}
            className="gd-glow-btn-gold px-5 py-2.5 rounded-xl text-sm font-bold inline-flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            Add to Gallery
          </button>
        </form>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {gallery.map((item) => (
            <div key={item.id} className="gd-card rounded-2xl p-3 space-y-2.5">
              <div className="rounded-xl overflow-hidden aspect-[4/3] bg-[#06142E]">
                <SafeImage src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
              </div>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] text-[#35AFFF]">{item.category}</p>
                  <p className="text-sm font-bold text-white truncate">{item.title}</p>
                </div>
                <button
                  type="button"
                  onClick={() => deleteGalleryItem(item.id)}
                  aria-label={`Delete ${item.title}`}
                  className="p-2 rounded-lg bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (section === 'customers') {
    return (
      <div className="space-y-4">
        <h3 className="font-display font-bold text-xl text-[#FFD369]">
          Customer Details ({customers.length})
        </h3>
        {customers.length === 0 ? (
          <div className="gd-card rounded-2xl p-8 text-center text-slate-300">
            Customers will appear automatically as orders arrive.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {customers.map((c) => (
              <div
                key={c.mobile}
                className="gd-card rounded-2xl p-4 flex items-center justify-between gap-3"
              >
                <div>
                  <p className="font-bold text-white">{c.name}</p>
                  <p className="font-mono-tabular text-xs text-slate-300">{c.mobile}</p>
                  <p className="text-xs text-[#35AFFF] mt-1">
                    {c.count} Order(s) · Latest: {c.lastOrderId}
                  </p>
                </div>
                <a
                  href={buildWhatsAppUrl(c.mobile, `Hello ${c.name} from ${settings.brandName}`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="gd-glow-btn-blue px-3.5 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5"
                >
                  <MessageCircle className="w-4 h-4 text-[#FFD369]" aria-hidden="true" />
                  Chat
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (section === 'payment') {
    return (
      <form onSubmit={handleSaveSettings} className="gd-card rounded-2xl p-6 space-y-5 max-w-2xl">
        <h3 className="font-display font-bold text-xl text-[#FFD369]">
          Payment, Razorpay &amp; Discount Settings
        </h3>

        {/* Razorpay Checkout Settings */}
        <div className="rounded-2xl bg-[#06142E]/85 border border-[#35AFFF]/30 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-bold text-[#FFD369]">Razorpay Checkout Gateway</p>
              <p className="text-xs text-slate-300">
                Server API keys (RAZORPAY_KEY_ID &amp; RAZORPAY_KEY_SECRET) are kept securely in server environment secrets.
              </p>
            </div>
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-white cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={formSettings.razorpayEnabled !== false}
                onChange={(e) =>
                  setFormSettings({ ...formSettings, razorpayEnabled: e.target.checked })
                }
                className="w-4 h-4 accent-[#FFD369]"
              />
              Enable Razorpay
            </label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-white">Checkout Merchant Name</label>
              <input
                type="text"
                value={formSettings.razorpayMerchantName || ''}
                onChange={(e) =>
                  setFormSettings({ ...formSettings, razorpayMerchantName: e.target.value })
                }
                placeholder="gurudev_designs"
                className="w-full h-10 px-3 rounded-xl bg-[#10264B] border border-[#35AFFF]/35 text-sm text-white"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-white">Public Key Reference (Optional)</label>
              <input
                type="text"
                value={formSettings.razorpayKeyId || ''}
                onChange={(e) =>
                  setFormSettings({ ...formSettings, razorpayKeyId: e.target.value })
                }
                placeholder="rzp_live_... or configured on server"
                className="w-full h-10 px-3 rounded-xl bg-[#10264B] border border-[#35AFFF]/35 text-sm font-mono-tabular text-white"
              />
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-white">UPI ID</label>
          <input
            type="text"
            value={formSettings.upiId}
            onChange={(e) => setFormSettings({ ...formSettings, upiId: e.target.value })}
            className="w-full h-10 px-3 rounded-xl bg-[#06142E] border border-[#35AFFF]/35 text-sm text-white font-mono-tabular"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-white">Payment QR Code Image</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={formSettings.paymentQrUrl}
              onChange={(e) =>
                setFormSettings({ ...formSettings, paymentQrUrl: e.target.value })
              }
              placeholder="Paste QR image URL or upload..."
              className="flex-1 h-10 px-3 rounded-xl bg-[#06142E] border border-[#35AFFF]/35 text-sm text-white"
            />
            <label className="gd-glow-btn-blue px-4 h-10 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer">
              <Upload className="w-4 h-4" aria-hidden="true" />
              Upload QR
              <input
                type="file"
                accept="image/*"
                onChange={(e) =>
                  handleUploadAsset(e.target.files, 'qr', (url) =>
                    setFormSettings({ ...formSettings, paymentQrUrl: url })
                  )
                }
                className="hidden"
              />
            </label>
          </div>
          {formSettings.paymentQrUrl && (
            <img
              src={formSettings.paymentQrUrl}
              alt="Payment QR Preview"
              className="w-28 h-28 rounded-xl bg-white p-1.5 object-contain mt-2"
            />
          )}
        </div>

        {/* Storewide Discount Settings */}
        <div className="rounded-2xl bg-[#06142E]/80 border border-[#35AFFF]/25 p-4 space-y-3">
          <p className="text-xs font-bold text-[#FFD369]">Customer Order Discount Settings</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-white">Discount % (0–90)</label>
              <input
                type="number"
                min={0}
                max={90}
                value={formSettings.discountPercent ?? 0}
                onChange={(e) =>
                  setFormSettings({
                    ...formSettings,
                    discountPercent: Math.max(0, Math.min(90, Number(e.target.value) || 0)),
                  })
                }
                className="w-full h-10 px-3 rounded-xl bg-[#10264B] border border-[#35AFFF]/35 text-sm font-mono-tabular text-white"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-white">Flat Discount (₹)</label>
              <input
                type="number"
                min={0}
                max={100000}
                value={formSettings.discountFlat ?? 0}
                onChange={(e) =>
                  setFormSettings({
                    ...formSettings,
                    discountFlat: Math.max(0, Math.min(100000, Number(e.target.value) || 0)),
                  })
                }
                className="w-full h-10 px-3 rounded-xl bg-[#10264B] border border-[#35AFFF]/35 text-sm font-mono-tabular text-white"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-white">Offer Label</label>
              <input
                type="text"
                maxLength={80}
                value={formSettings.discountLabel || ''}
                onChange={(e) =>
                  setFormSettings({ ...formSettings, discountLabel: e.target.value })
                }
                placeholder="e.g. Festive Offer"
                className="w-full h-10 px-3 rounded-xl bg-[#10264B] border border-[#35AFFF]/35 text-sm text-white"
              />
            </div>
          </div>
        </div>

        {msg && <p className="text-xs font-semibold text-emerald-300">{msg}</p>}
        <button
          type="submit"
          disabled={saving}
          className="gd-glow-btn-gold px-6 py-2.5 rounded-xl text-sm font-bold inline-flex items-center gap-2 cursor-pointer"
        >
          <Save className="w-4 h-4" aria-hidden="true" />
          Save Payment &amp; Discount Settings
        </button>
      </form>
    );
  }

  if (section === 'whatsapp') {
    const sampleMsg = formatWhatsAppMessage({
      brandName: formSettings.brandName || 'gurudev_designs',
      orderId: 'GD-261125-4829',
      customerName: 'Rakesh Patel',
      mobile: '+91 98765 43210',
      serviceName: 'Business Poster',
      servicePrice: 399,
      discountAmount: 0,
      finalAmount: 399,
      paymentMethod: 'Scan & Pay QR',
      paymentReference: 'UTR432910884712',
      paymentStatus: 'PAYMENT VERIFICATION PENDING',
      designSize: '1080 x 1080 px',
      language: 'Gujarati',
      requirements: 'Diwali offer poster with gold theme',
      designText: 'શુભ દિવાળી',
      specialInstructions: 'High resolution PNG',
    });

    return (
      <form onSubmit={handleSaveSettings} className="gd-card rounded-2xl p-6 space-y-4 max-w-2xl">
        <h3 className="font-display font-bold text-xl text-[#FFD369]">WhatsApp Settings</h3>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-white">
            Admin WhatsApp Number (with country code, e.g. 919876543210)
          </label>
          <input
            type="text"
            required
            value={formSettings.whatsappNumber}
            onChange={(e) =>
              setFormSettings({ ...formSettings, whatsappNumber: e.target.value })
            }
            className="w-full h-11 px-3.5 rounded-xl bg-[#06142E] border border-[#35AFFF]/35 text-sm font-mono-tabular text-white"
          />
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-[#35AFFF]">Live WhatsApp Message Format Preview</p>
          <pre className="bg-[#06142E] border border-[#35AFFF]/25 rounded-xl p-3.5 text-xs text-slate-200 whitespace-pre-wrap font-mono-tabular">
            {sampleMsg}
          </pre>
        </div>
        {msg && <p className="text-xs font-semibold text-emerald-300">{msg}</p>}
        <button
          type="submit"
          disabled={saving}
          className="gd-glow-btn-gold px-6 py-2.5 rounded-xl text-sm font-bold inline-flex items-center gap-2 cursor-pointer"
        >
          <Save className="w-4 h-4" aria-hidden="true" />
          Save WhatsApp Number
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSaveSettings} className="gd-card rounded-2xl p-6 space-y-4 max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-display font-bold text-xl text-[#FFD369]">Website Settings</h3>
        <button
          type="button"
          onClick={async () => {
            setSaving(true);
            try {
              await seedDefaultsIfNeeded(true);
              setMsg('All 45 default services synced to Firestore.');
            } finally {
              setSaving(false);
            }
          }}
          className="gd-glow-btn-blue px-4 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
          Sync Default 45 Services
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-white">Brand Name</label>
          <input
            type="text"
            required
            value={formSettings.brandName}
            onChange={(e) => setFormSettings({ ...formSettings, brandName: e.target.value })}
            className="w-full h-10 px-3 rounded-xl bg-[#06142E] border border-[#35AFFF]/35 text-sm text-white"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-white">Instagram Profile Link</label>
          <input
            type="text"
            value={formSettings.instagramUrl}
            onChange={(e) =>
              setFormSettings({ ...formSettings, instagramUrl: e.target.value })
            }
            className="w-full h-10 px-3 rounded-xl bg-[#06142E] border border-[#35AFFF]/35 text-sm text-white"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-white">Contact Email</label>
          <input
            type="email"
            value={formSettings.contactEmail}
            onChange={(e) =>
              setFormSettings({ ...formSettings, contactEmail: e.target.value })
            }
            className="w-full h-10 px-3 rounded-xl bg-[#06142E] border border-[#35AFFF]/35 text-sm text-white"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-white">Contact Phone</label>
          <input
            type="text"
            value={formSettings.contactPhone}
            onChange={(e) =>
              setFormSettings({ ...formSettings, contactPhone: e.target.value })
            }
            className="w-full h-10 px-3 rounded-xl bg-[#06142E] border border-[#35AFFF]/35 text-sm text-white"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-white">WhatsApp Number (with country code)</label>
          <input
            type="text"
            required
            value={formSettings.whatsappNumber}
            onChange={(e) =>
              setFormSettings({ ...formSettings, whatsappNumber: e.target.value })
            }
            className="w-full h-10 px-3 rounded-xl bg-[#06142E] border border-[#35AFFF]/35 text-sm font-mono-tabular text-white"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-white">Contact Address</label>
          <input
            type="text"
            value={formSettings.contactAddress}
            onChange={(e) =>
              setFormSettings({ ...formSettings, contactAddress: e.target.value })
            }
            className="w-full h-10 px-3 rounded-xl bg-[#06142E] border border-[#35AFFF]/35 text-sm text-white"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-semibold text-white">Website Description</label>
        <textarea
          rows={2}
          required
          value={formSettings.websiteDescription}
          onChange={(e) =>
            setFormSettings({ ...formSettings, websiteDescription: e.target.value })
          }
          className="w-full p-3 rounded-xl bg-[#06142E] border border-[#35AFFF]/35 text-sm text-white"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-white">Homepage Banner Title</label>
          <input
            type="text"
            required
            value={formSettings.bannerTitle}
            onChange={(e) =>
              setFormSettings({ ...formSettings, bannerTitle: e.target.value })
            }
            className="w-full h-10 px-3 rounded-xl bg-[#06142E] border border-[#35AFFF]/35 text-sm text-white"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-white">Homepage Banner Subtitle</label>
          <input
            type="text"
            required
            value={formSettings.bannerSubtitle}
            onChange={(e) =>
              setFormSettings({ ...formSettings, bannerSubtitle: e.target.value })
            }
            className="w-full h-10 px-3 rounded-xl bg-[#06142E] border border-[#35AFFF]/35 text-sm text-white"
          />
        </div>
      </div>

      {/* Website Logo Manager */}
      <div className="rounded-2xl bg-[#06142E]/85 border border-[#35AFFF]/30 p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h4 className="font-display font-bold text-sm text-[#FFD369]">Website Logo Manager</h4>
            <p className="text-xs text-slate-300">
              Upload, replace, or remove brand logo (PNG, JPG, WebP). Updates header, footer, and menu instantly.
            </p>
          </div>
          {formSettings.logoUrl && (
            <button
              type="button"
              onClick={() => setFormSettings({ ...formSettings, logoUrl: '' })}
              className="text-xs font-semibold text-rose-300 hover:text-rose-200 cursor-pointer"
            >
              Remove Logo
            </button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="w-16 h-16 rounded-xl overflow-hidden bg-[#10264B] border border-[#35AFFF]/40 flex items-center justify-center shrink-0">
            {formSettings.logoUrl ? (
              <SafeImage
                src={formSettings.logoUrl}
                alt="Logo Preview"
                className="w-full h-full object-cover"
                fallbackLabel="Logo"
              />
            ) : (
              <span className="font-display font-extrabold text-xs text-[#FFD369]">GD</span>
            )}
          </div>

          <div className="flex-1 w-full space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={formSettings.logoUrl}
                onChange={(e) => setFormSettings({ ...formSettings, logoUrl: e.target.value })}
                placeholder="Logo image URL or upload file..."
                className="flex-1 h-10 px-3 rounded-xl bg-[#10264B] border border-[#35AFFF]/35 text-xs text-white"
              />
              <label className="gd-glow-btn-blue px-4 h-10 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer shrink-0">
                <Upload className="w-4 h-4 text-[#FFD369]" aria-hidden="true" />
                <span>{uploadPct > 0 && uploadPct < 100 ? `${uploadPct}%` : 'Upload / Replace'}</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  onChange={(e) =>
                    handleUploadAsset(e.target.files, 'brand', (url) => {
                      const versioned = `${url.split('?')[0]}?v=${Date.now()}`;
                      setFormSettings({ ...formSettings, logoUrl: versioned });
                      setMsg('Website logo updated successfully! Click Save Website Settings below.');
                    })
                  }
                  className="hidden"
                />
              </label>
            </div>
            {uploadPct > 0 && uploadPct < 100 && (
              <div className="w-full h-1.5 bg-[#10264B] rounded-full overflow-hidden">
                <div className="h-full bg-[#35AFFF] transition-all" style={{ width: `${uploadPct}%` }} />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-semibold text-white">Homepage Banner Image URL</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={formSettings.bannerImageUrl}
            onChange={(e) =>
              setFormSettings({ ...formSettings, bannerImageUrl: e.target.value })
            }
            className="flex-1 h-10 px-3 rounded-xl bg-[#06142E] border border-[#35AFFF]/35 text-sm text-white"
          />
          <label className="gd-glow-btn-blue px-3 h-10 rounded-xl text-xs font-semibold inline-flex items-center cursor-pointer">
            Upload
            <input
              type="file"
              accept="image/*"
              onChange={(e) =>
                handleUploadAsset(e.target.files, 'banner', (url) =>
                  setFormSettings({ ...formSettings, bannerImageUrl: url })
                )
              }
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Website Menu Visibility Controls */}
      <div className="rounded-2xl bg-[#06142E]/80 border border-[#35AFFF]/25 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="font-display font-bold text-sm text-[#FFD369]">
              Website Menu Visibility
            </h4>
            <p className="text-xs text-slate-300">
              Choose which items appear inside the slide-in navigation menu.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              setFormSettings((prev) => ({
                ...prev,
                menuVisibility: { ...DEFAULT_MENU_VISIBILITY },
              }))
            }
            className="text-xs font-semibold text-[#35AFFF] hover:text-[#FFD369] cursor-pointer"
          >
            Show All Menu Items
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {MENU_ITEMS.map((item) => {
            const visible =
              formSettings.menuVisibility?.[item.key] ?? DEFAULT_MENU_VISIBILITY[item.key];
            return (
              <label
                key={item.key}
                className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-[#10264B]/60 border border-[#35AFFF]/25 cursor-pointer hover:border-[#35AFFF]/55"
              >
                <span className="text-xs font-medium text-white">{item.label}</span>
                <input
                  type="checkbox"
                  checked={visible}
                  onChange={() => handleToggleMenuVisibility(item.key)}
                  aria-label={`Show ${item.label} in menu`}
                  className="w-4 h-4 accent-[#FFD369] cursor-pointer"
                />
              </label>
            );
          })}
        </div>
      </div>

      {msg && <p className="text-xs font-semibold text-emerald-300">{msg}</p>}

      <button
        type="submit"
        disabled={saving}
        className="gd-glow-btn-gold px-6 py-2.5 rounded-xl text-sm font-bold inline-flex items-center gap-2 cursor-pointer"
      >
        <Save className="w-4 h-4" aria-hidden="true" />
        {saving ? 'Saving...' : 'Save Website Settings'}
      </button>
    </form>
  );
};
