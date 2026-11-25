import React, { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Check, Edit3, Plus, Save, Trash2, Upload, X } from 'lucide-react';
import { CATEGORY_IMAGES, DEFAULT_CATEGORIES } from '../../data/seedCatalog';
import {
  batchUpdateServicePrices,
  deleteServiceItem,
  reorderServices,
  uploadFileWithProgress,
  upsertService,
} from '../../services/firebaseService';
import type { ServiceCategory, ServiceItem, SiteSettings } from '../../types/design';
import { formatPriceINR } from '../../utils/orderUtils';
import { SafeImage } from '../SafeImage';

interface AdminServicesPanelProps {
  services: ServiceItem[];
  settings?: SiteSettings;
  mode: 'services' | 'prices';
}

export const AdminServicesPanel: React.FC<AdminServicesPanelProps> = ({
  services,
  settings,
  mode,
}) => {
  const [editingService, setEditingService] = useState<ServiceItem | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Price editor local state
  const [priceEdits, setPriceEdits] = useState<Record<string, string>>({});

  const sortedServices = useMemo(
    () => [...services].sort((a, b) => a.displayOrder - b.displayOrder),
    [services]
  );

  const availableCategories = useMemo(() => {
    const base =
      settings?.categories && settings.categories.length > 0
        ? settings.categories
        : DEFAULT_CATEGORIES;
    const names = base
      .slice()
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((c) => c.name);
    for (const svc of services) {
      if (svc.category && !names.includes(svc.category)) {
        names.push(svc.category);
      }
    }
    return names;
  }, [settings?.categories, services]);

  const openNewService = () => {
    const nextOrder = sortedServices.length + 1;
    setIsNew(true);
    setEditingService({
      id: `custom-service-${Date.now().toString(36)}`,
      name: '',
      category: 'SPECIAL DESIGN',
      price: 299,
      description: '',
      imageUrl: CATEGORY_IMAGES['SPECIAL DESIGN'],
      enabled: true,
      displayOrder: nextOrder,
      turnaround: '24 hrs',
      deliverables: ['High-Res PNG + PDF', '2 Free Revisions'],
    });
    setFeedback(null);
  };

  const openEditService = (svc: ServiceItem) => {
    setIsNew(false);
    setEditingService({ ...svc });
    setFeedback(null);
  };

  const handleUploadServiceImage = async (files: FileList | null) => {
    if (!files || !files[0] || !editingService) return;
    const file = files[0];
    setUploadPct(1);
    setFeedback(null);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const url = await uploadFileWithProgress(
        file,
        `public-assets/services/${editingService.id}_${Date.now()}_${safeName}`,
        setUploadPct
      );
      const versionedUrl = `${url.split('?')[0]}?v=${Date.now()}`;
      setEditingService({ ...editingService, imageUrl: versionedUrl });
      setFeedback('Service photo uploaded successfully!');
    } catch {
      setFeedback('Service photo upload failed. Please check file size and connection.');
    }
  };

  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingService) return;
    if (!editingService.name.trim() || !editingService.description.trim()) {
      setFeedback('Service name and description are required.');
      return;
    }
    setSaving(true);
    try {
      await upsertService(editingService);
      setEditingService(null);
      setFeedback('Service saved to database.');
    } catch {
      setFeedback('Failed to save service.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleEnabled = async (svc: ServiceItem) => {
    await upsertService({ ...svc, enabled: !svc.enabled });
  };

  const handleMoveService = async (index: number, direction: -1 | 1) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= sortedServices.length || reordering) return;
    const reordered = [...sortedServices];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIdx, 0, moved);
    setReordering(true);
    try {
      await reorderServices(reordered);
      setFeedback(`Moved "${moved.name}" to position #${targetIdx + 1}.`);
    } catch {
      setFeedback('Could not reorder services right now.');
    } finally {
      setReordering(false);
    }
  };

  const handleDeleteService = async (svc: ServiceItem) => {
    await deleteServiceItem(svc.id);
    setFeedback(`Deleted "${svc.name}".`);
  };

  const handleSaveAllPrices = async () => {
    const updates: Array<{ service: ServiceItem; newPrice: number }> = [];
    for (const svc of sortedServices) {
      const raw = priceEdits[svc.id];
      if (raw !== undefined && raw !== '') {
        const num = Number(raw);
        if (!Number.isNaN(num) && num !== svc.price) {
          updates.push({ service: svc, newPrice: num });
        }
      }
    }
    if (updates.length === 0) {
      setFeedback('No price changes detected.');
      return;
    }
    setSaving(true);
    try {
      await batchUpdateServicePrices(updates);
      setPriceEdits({});
      setFeedback(`Updated ${updates.length} service prices in Firestore.`);
    } finally {
      setSaving(false);
    }
  };

  if (mode === 'prices') {
    return (
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-display font-bold text-xl text-[#FFD369]">
              Manage Service Prices ({sortedServices.length})
            </h3>
            <p className="text-xs sm:text-sm text-slate-300">
              Update any starting price below and click Save All Price Changes.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSaveAllPrices}
            disabled={saving}
            className="gd-glow-btn-gold px-5 py-2.5 rounded-xl text-sm font-bold inline-flex items-center gap-2 cursor-pointer"
          >
            <Save className="w-4 h-4" aria-hidden="true" />
            {saving ? 'Saving...' : 'Save All Price Changes'}
          </button>
        </div>

        {feedback && <p className="text-xs font-semibold text-emerald-300">{feedback}</p>}

        <div className="gd-card rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#06142E] text-xs uppercase text-[#35AFFF] border-b border-[#35AFFF]/25">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Service Name</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Current Price</th>
                  <th className="px-4 py-3">New Price (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#35AFFF]/15">
                {sortedServices.map((svc) => (
                  <tr key={svc.id} className="hover:bg-[#06142E]/40">
                    <td className="px-4 py-2.5 font-mono-tabular text-xs text-slate-400">
                      {svc.displayOrder}
                    </td>
                    <td className="px-4 py-2.5 font-semibold text-white">{svc.name}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-300">{svc.category}</td>
                    <td className="px-4 py-2.5 font-mono-tabular text-[#FFD369] font-bold">
                      {formatPriceINR(svc.price)}
                    </td>
                    <td className="px-4 py-2.5">
                      <input
                        type="number"
                        min={0}
                        value={priceEdits[svc.id] ?? String(svc.price)}
                        onChange={(e) =>
                          setPriceEdits((prev) => ({ ...prev, [svc.id]: e.target.value }))
                        }
                        aria-label={`Price for ${svc.name}`}
                        className="w-28 h-9 px-2.5 rounded-lg bg-[#06142E] border border-[#35AFFF]/35 font-mono-tabular text-sm text-white focus:outline-none focus:border-[#35AFFF]"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-display font-bold text-xl text-[#FFD369]">
            Manage Services ({sortedServices.length})
          </h3>
          <p className="text-xs sm:text-sm text-slate-300">
            Add, edit, reorder, enable/disable, or delete services.
          </p>
        </div>

        <button
          type="button"
          onClick={openNewService}
          className="gd-glow-btn-gold px-5 py-2.5 rounded-xl text-sm font-bold inline-flex items-center gap-2 cursor-pointer"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          Add New Service
        </button>
      </div>

      {feedback && <p className="text-xs font-semibold text-emerald-300">{feedback}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sortedServices.map((svc, idx) => (
          <div key={svc.id} className="gd-card rounded-2xl p-4 flex gap-3.5 justify-between items-center">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-16 h-16 rounded-xl overflow-hidden border border-[#35AFFF]/30 bg-[#06142E] shrink-0">
                <SafeImage
                  src={svc.imageUrl}
                  alt={svc.name}
                  className="w-full h-full object-cover"
                  fallbackLabel={svc.name}
                />
              </div>
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-mono-tabular text-slate-400">#{svc.displayOrder}</span>
                  <span className="text-[#35AFFF] font-semibold truncate">{svc.category}</span>
                </div>
                <h4 className="font-bold text-white truncate">{svc.name}</h4>
                <p className="font-mono-tabular text-sm font-bold text-[#FFD369]">
                  {formatPriceINR(svc.price)} ·{' '}
                  <span className={svc.enabled ? 'text-emerald-300' : 'text-rose-300'}>
                    {svc.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-1.5 shrink-0">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={idx === 0 || reordering}
                  onClick={() => handleMoveService(idx, -1)}
                  aria-label={`Move ${svc.name} up`}
                  title="Move Up"
                  className="flex-1 h-7 px-2 rounded-lg bg-[#06142E] border border-[#35AFFF]/30 text-slate-200 hover:text-[#FFD369] inline-flex items-center justify-center cursor-pointer disabled:opacity-40"
                >
                  <ArrowUp className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  disabled={idx === sortedServices.length - 1 || reordering}
                  onClick={() => handleMoveService(idx, 1)}
                  aria-label={`Move ${svc.name} down`}
                  title="Move Down"
                  className="flex-1 h-7 px-2 rounded-lg bg-[#06142E] border border-[#35AFFF]/30 text-slate-200 hover:text-[#FFD369] inline-flex items-center justify-center cursor-pointer disabled:opacity-40"
                >
                  <ArrowDown className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => openEditService(svc)}
                className="gd-glow-btn-blue px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                Edit
              </button>
              <button
                type="button"
                onClick={() => handleToggleEnabled(svc)}
                className="px-3 py-1.5 rounded-lg bg-[#06142E] border border-[#35AFFF]/30 text-xs text-slate-200 hover:text-white cursor-pointer"
              >
                {svc.enabled ? 'Disable' : 'Enable'}
              </button>
              <button
                type="button"
                onClick={() => handleDeleteService(svc)}
                aria-label={`Delete ${svc.name}`}
                className="px-3 py-1.5 rounded-lg bg-rose-500/15 border border-rose-400/35 text-xs text-rose-200 hover:bg-rose-500/25 inline-flex items-center justify-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add/Edit Service Modal */}
      {editingService && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-service-title"
        >
          <form
            onSubmit={handleSaveService}
            className="gd-card rounded-3xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4 relative"
          >
            <button
              type="button"
              onClick={() => setEditingService(null)}
              aria-label="Close service editor"
              className="absolute top-4 right-4 w-9 h-9 rounded-xl bg-[#06142E] border border-[#35AFFF]/35 text-white flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 id="edit-service-title" className="font-display font-bold text-xl text-[#FFD369]">
              {isNew ? 'Add New Service' : `Edit ${editingService.name}`}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-white">Service Name</label>
                <input
                  type="text"
                  required
                  value={editingService.name}
                  onChange={(e) =>
                    setEditingService({ ...editingService, name: e.target.value })
                  }
                  className="w-full h-10 px-3 rounded-xl bg-[#06142E] border border-[#35AFFF]/35 text-sm text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-white">Category</label>
                <select
                  value={editingService.category}
                  onChange={(e) =>
                    setEditingService({
                      ...editingService,
                      category: e.target.value as ServiceCategory,
                    })
                  }
                  className="w-full h-10 px-3 rounded-xl bg-[#06142E] border border-[#35AFFF]/35 text-sm text-white"
                >
                  {availableCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-white">Starting Price (₹)</label>
                <input
                  type="number"
                  min={0}
                  required
                  value={editingService.price}
                  onChange={(e) =>
                    setEditingService({
                      ...editingService,
                      price: Number(e.target.value) || 0,
                    })
                  }
                  className="w-full h-10 px-3 rounded-xl bg-[#06142E] border border-[#35AFFF]/35 text-sm text-white font-mono-tabular"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-white">Display Order</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={editingService.displayOrder}
                  onChange={(e) =>
                    setEditingService({
                      ...editingService,
                      displayOrder: Number(e.target.value) || 1,
                    })
                  }
                  className="w-full h-10 px-3 rounded-xl bg-[#06142E] border border-[#35AFFF]/35 text-sm text-white font-mono-tabular"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-white">Short Description</label>
              <textarea
                rows={2}
                required
                value={editingService.description}
                onChange={(e) =>
                  setEditingService({ ...editingService, description: e.target.value })
                }
                className="w-full p-3 rounded-xl bg-[#06142E] border border-[#35AFFF]/35 text-sm text-white"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-white">Service Image URL or Upload</label>
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-xl overflow-hidden border border-[#35AFFF]/35 bg-[#06142E] shrink-0">
                  <SafeImage
                    src={editingService.imageUrl}
                    alt={editingService.name || 'Preview'}
                    className="w-full h-full object-cover"
                    fallbackLabel="Preview"
                  />
                </div>
                <div className="flex-1 flex gap-2">
                  <input
                    type="text"
                    value={editingService.imageUrl}
                    onChange={(e) =>
                      setEditingService({ ...editingService, imageUrl: e.target.value })
                    }
                    className="flex-1 h-10 px-3 rounded-xl bg-[#06142E] border border-[#35AFFF]/35 text-sm text-white"
                  />
                  <label className="gd-glow-btn-blue px-3 h-10 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer shrink-0">
                    <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                    Upload {uploadPct > 0 && uploadPct < 100 ? `${uploadPct}%` : ''}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleUploadServiceImage(e.target.files)}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEditingService(null)}
                className="gd-glow-btn-blue px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="gd-glow-btn-gold px-5 py-2 rounded-xl text-sm font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" aria-hidden="true" />
                {saving ? 'Saving...' : 'Save Service'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
