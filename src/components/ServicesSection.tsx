import React, { useMemo, useState } from 'react';
import { Eye, Search, ShoppingBag, Sparkles, X } from 'lucide-react';
import { DEFAULT_CATEGORIES } from '../data/seedCatalog';
import type { ServiceCategory, ServiceItem, SiteSettings } from '../types/design';
import { calculatePricingSummary, formatPriceINR } from '../utils/orderUtils';
import { SafeImage } from './SafeImage';

interface ServicesSectionProps {
  services: ServiceItem[];
  settings: SiteSettings;
  selectedCategory: ServiceCategory | 'ALL';
  onCategoryChange: (category: ServiceCategory | 'ALL') => void;
  onViewDetails: (service: ServiceItem) => void;
  onOrderService: (service: ServiceItem) => void;
}

export const ServicesSection: React.FC<ServicesSectionProps> = ({
  services,
  settings,
  selectedCategory,
  onCategoryChange,
  onViewDetails,
  onOrderService,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const enabledServices = useMemo(
    () =>
      services
        .filter((s) => s.enabled)
        .sort((a, b) => a.displayOrder - b.displayOrder),
    [services]
  );

  const liveCategories = useMemo(() => {
    const base = (
      settings.categories && settings.categories.length > 0
        ? settings.categories
        : DEFAULT_CATEGORIES
    )
      .filter((c) => c.enabled)
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((c) => c.name);
    const extra = enabledServices
      .map((s) => s.category)
      .filter((cat) => cat && !base.includes(cat));
    return Array.from(new Set([...base, ...extra]));
  }, [settings.categories, enabledServices]);

  const filteredServices = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return enabledServices.filter((svc) => {
      const catMatch = selectedCategory === 'ALL' || svc.category === selectedCategory;
      const textMatch =
        !q ||
        svc.name.toLowerCase().includes(q) ||
        svc.description.toLowerCase().includes(q) ||
        svc.category.toLowerCase().includes(q);
      return catMatch && textMatch;
    });
  }, [enabledServices, selectedCategory, searchQuery]);

  const hasActiveDiscount =
    (Number(settings.discountPercent) || 0) > 0 || (Number(settings.discountFlat) || 0) > 0;

  return (
    <section
      id="services-catalog"
      aria-labelledby="services-heading"
      className="max-w-7xl mx-auto px-4 sm:px-6 space-y-5 sm:space-y-6"
    >
      {/* Compact iOS-Inspired Studio Header Card on Page 1 */}
      <div className="gd-card rounded-3xl p-4 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-[#35AFFF]">
              {settings.bannerSubtitle || 'YOUR CREATIVE DESIGN PARTNER'}
            </span>
          </div>
          <h1
            id="services-heading"
            className="font-display font-extrabold text-2xl sm:text-3xl lg:text-4xl text-[#FFD369] tracking-tight"
          >
            All Design Services
          </h1>
          <p className="text-xs sm:text-sm text-slate-300">
            Showing {filteredServices.length} of {enabledServices.length} creative design services ·
            Tap <strong className="text-white">Order Now</strong> to customize &amp; pay
          </p>
        </div>

        {/* Search Input + Active Discount Info */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
          {hasActiveDiscount && (
            <div className="px-3.5 py-2 rounded-2xl bg-emerald-500/15 border border-emerald-400/40 text-xs text-emerald-200 font-semibold inline-flex items-center gap-1.5 whitespace-nowrap">
              <Sparkles className="w-4 h-4 text-[#FFD369] shrink-0" aria-hidden="true" />
              <span>
                {settings.discountLabel?.trim() || 'Special Studio Offer'}:{' '}
                {settings.discountPercent > 0 ? `${settings.discountPercent}% OFF` : ''}
                {settings.discountPercent > 0 && settings.discountFlat > 0 ? ' + ' : ''}
                {settings.discountFlat > 0 ? `${formatPriceINR(settings.discountFlat)} OFF` : ''}
              </span>
            </div>
          )}

          <div className="relative w-full sm:w-80">
            <Search
              className="w-4 h-4 text-[#35AFFF] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search poster, card, logo..."
              aria-label="Search design services"
              className="w-full h-11 pl-10 pr-9 rounded-2xl bg-[#06142E] border border-[#35AFFF]/35 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:border-[#35AFFF]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 6 Category Filter Buttons */}
      <div
        role="tablist"
        aria-label="Service categories"
        className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 sm:flex-wrap"
      >
        <button
          type="button"
          role="tab"
          aria-selected={selectedCategory === 'ALL'}
          onClick={() => onCategoryChange('ALL')}
          className={`shrink-0 min-h-[42px] px-3.5 py-2 rounded-2xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors cursor-pointer ${
            selectedCategory === 'ALL'
              ? 'bg-[#FFD369] text-[#06142E] font-bold shadow-[0_4px_16px_rgba(255,211,105,0.28)]'
              : 'bg-[#10264B] text-slate-200 border border-[#35AFFF]/30 hover:border-[#35AFFF]'
          }`}
        >
          All Services ({enabledServices.length})
        </button>

        {liveCategories.map((category) => {
          const count = enabledServices.filter((s) => s.category === category).length;
          const active = selectedCategory === category;
          return (
            <button
              key={category}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onCategoryChange(category)}
              className={`shrink-0 min-h-[42px] px-3.5 py-2 rounded-2xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                active
                  ? 'bg-[#FFD369] text-[#06142E] font-bold shadow-[0_4px_16px_rgba(255,211,105,0.28)]'
                  : 'bg-[#10264B] text-slate-200 border border-[#35AFFF]/30 hover:border-[#35AFFF]'
              }`}
            >
              {category} ({count})
            </button>
          );
        })}
      </div>

      {/* Two-Column Rounded Service Cards Grid */}
      {filteredServices.length === 0 ? (
        <div className="gd-card rounded-3xl p-8 text-center space-y-3">
          <p className="text-base font-semibold text-[#FFD369]">
            No matching services found
          </p>
          <p className="text-sm text-slate-300">
            Try clearing your search or selecting &quot;All Services&quot; to browse every design service.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              onCategoryChange('ALL');
            }}
            className="gd-glow-btn-blue px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer"
          >
            Show All Services
          </button>
        </div>
      ) : (
        <div
          data-testid="services-grid"
          className="grid grid-cols-2 gap-3 sm:gap-5"
        >
          {filteredServices.map((service) => {
            const pricing = calculatePricingSummary(service.price, settings);
            return (
              <article
                key={service.id}
                className="gd-card rounded-3xl p-3 sm:p-5 flex flex-col justify-between gap-3"
              >
                <div className="space-y-2.5 sm:space-y-3">
                  <div className="rounded-2xl overflow-hidden border border-[#35AFFF]/25 aspect-[4/3] bg-[#06142E]">
                    <SafeImage
                      src={service.imageUrl}
                      alt={service.name}
                      className="w-full h-full object-cover"
                      fallbackLabel={service.name}
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-1">
                      <h2 className="font-display font-bold text-sm sm:text-lg text-white leading-snug line-clamp-2">
                        {service.name}
                      </h2>
                      <div className="text-left sm:text-right shrink-0">
                        {pricing.discountAmount > 0 ? (
                          <div className="flex sm:flex-col items-baseline sm:items-end gap-1.5 sm:gap-0">
                            <span className="font-mono-tabular text-sm sm:text-base font-extrabold text-[#FFD369] whitespace-nowrap">
                              {formatPriceINR(pricing.finalPayable)}
                            </span>
                            <span className="font-mono-tabular text-[11px] text-slate-400 line-through whitespace-nowrap">
                              {formatPriceINR(pricing.totalPrice)}
                            </span>
                          </div>
                        ) : (
                          <span className="font-mono-tabular text-sm sm:text-base font-extrabold text-[#FFD369] whitespace-nowrap">
                            {formatPriceINR(service.price)}
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="text-[11px] sm:text-xs text-[#35AFFF] font-medium truncate">
                      {service.category} · {service.turnaround}
                    </p>

                    <p className="text-xs sm:text-sm text-slate-300 line-clamp-2 leading-relaxed">
                      {service.description}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-[#35AFFF]/20">
                  <button
                    type="button"
                    onClick={() => onViewDetails(service)}
                    aria-label={`View details for ${service.name}`}
                    className="gd-glow-btn-blue min-h-[44px] sm:flex-1 px-3 py-2 rounded-2xl text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Details</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onOrderService(service)}
                    aria-label={`Order now for ${service.name}`}
                    className="gd-glow-btn-gold min-h-[44px] sm:flex-1 px-3 py-2.5 rounded-2xl text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <ShoppingBag className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Order Now</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};
