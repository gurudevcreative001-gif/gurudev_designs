import React, { useMemo, useState } from 'react';
import { Maximize2, ShoppingBag, X } from 'lucide-react';
import { GALLERY_CATEGORIES, type GalleryCategory, type GalleryItem } from '../types/design';
import { SafeImage } from './SafeImage';

interface GallerySectionProps {
  items: GalleryItem[];
  onOrderSimilar: () => void;
}

export const GallerySection: React.FC<GallerySectionProps> = ({ items, onOrderSimilar }) => {
  const [selectedCategory, setSelectedCategory] = useState<GalleryCategory | 'ALL'>('ALL');
  const [lightboxItem, setLightboxItem] = useState<GalleryItem | null>(null);

  const filteredItems = useMemo(() => {
    if (selectedCategory === 'ALL') return items;
    return items.filter((item) => item.category === selectedCategory);
  }, [items, selectedCategory]);

  return (
    <section aria-labelledby="gallery-heading" className="max-w-7xl mx-auto px-4 sm:px-6 space-y-6">
      <div className="space-y-1.5">
        <h2
          id="gallery-heading"
          className="font-display font-bold text-2xl sm:text-3xl text-[#FFD369]"
        >
          Design Portfolio Gallery
        </h2>
        <p className="text-sm sm:text-base text-slate-300">
          Explore selected artwork across social media, business branding, invitations, Shraddhanjali, and festivals.
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Portfolio categories">
        <button
          type="button"
          role="tab"
          aria-selected={selectedCategory === 'ALL'}
          onClick={() => setSelectedCategory('ALL')}
          className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap cursor-pointer transition-colors ${
            selectedCategory === 'ALL'
              ? 'bg-[#FFD369] text-[#06142E] font-bold'
              : 'bg-[#10264B] text-slate-200 border border-[#35AFFF]/30 hover:border-[#35AFFF]'
          }`}
        >
          All Designs ({items.length})
        </button>

        {GALLERY_CATEGORIES.map((cat) => {
          const active = selectedCategory === cat;
          return (
            <button
              key={cat}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSelectedCategory(cat)}
              className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                active
                  ? 'bg-[#FFD369] text-[#06142E] font-bold'
                  : 'bg-[#10264B] text-slate-200 border border-[#35AFFF]/30 hover:border-[#35AFFF]'
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {filteredItems.length === 0 ? (
        <div className="gd-card rounded-2xl p-8 text-center text-slate-300">
          No portfolio items in this category yet.
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-5">
          {filteredItems.map((item) => (
            <article key={item.id} className="gd-card rounded-2xl p-3 sm:p-4 flex flex-col justify-between gap-3">
              <button
                type="button"
                onClick={() => setLightboxItem(item)}
                className="group relative rounded-xl overflow-hidden border border-[#35AFFF]/25 aspect-[4/3] bg-[#06142E] cursor-pointer text-left"
                aria-label={`Preview ${item.title}`}
              >
                <SafeImage
                  src={item.imageUrl}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-200"
                  fallbackLabel={item.title}
                />
                <span className="absolute bottom-2 right-2 w-8 h-8 rounded-lg bg-[#06142E]/85 border border-[#35AFFF]/40 flex items-center justify-center text-[#FFD369]">
                  <Maximize2 className="w-4 h-4" aria-hidden="true" />
                </span>
              </button>

              <div className="space-y-1">
                <p className="text-[11px] sm:text-xs text-[#35AFFF] font-medium">
                  {item.category}
                </p>
                <h3 className="font-display font-bold text-sm sm:text-base text-white line-clamp-1">
                  {item.title}
                </h3>
                {item.description && (
                  <p className="text-xs text-slate-300 line-clamp-2">{item.description}</p>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Lightbox Preview Modal */}
      {lightboxItem && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="lightbox-title"
        >
          <div className="gd-card rounded-3xl max-w-2xl w-full p-5 sm:p-6 space-y-4 relative">
            <button
              type="button"
              onClick={() => setLightboxItem(null)}
              aria-label="Close gallery preview"
              className="absolute top-4 right-4 w-10 h-10 rounded-xl bg-[#06142E] border border-[#35AFFF]/35 text-white flex items-center justify-center cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="rounded-2xl overflow-hidden border border-[#35AFFF]/30 bg-[#06142E] max-h-[60vh]">
              <SafeImage
                src={lightboxItem.imageUrl}
                alt={lightboxItem.title}
                className="w-full h-full max-h-[60vh] object-contain"
                fallbackLabel={lightboxItem.title}
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-xs text-[#35AFFF] font-semibold">{lightboxItem.category}</p>
                <h3 id="lightbox-title" className="font-display font-bold text-xl text-[#FFD369]">
                  {lightboxItem.title}
                </h3>
                {lightboxItem.description && (
                  <p className="text-sm text-slate-300 mt-1">{lightboxItem.description}</p>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  setLightboxItem(null);
                  onOrderSimilar();
                }}
                className="gd-glow-btn-gold min-h-[44px] px-5 py-2.5 rounded-xl text-sm font-bold inline-flex items-center justify-center gap-2 shrink-0 cursor-pointer"
              >
                <ShoppingBag className="w-4 h-4" aria-hidden="true" />
                Order Similar Design
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
