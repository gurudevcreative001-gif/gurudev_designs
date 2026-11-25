import React from 'react';
import { ArrowRight, PenTool } from 'lucide-react';
import {
  CATEGORY_DESCRIPTIONS,
  CATEGORY_IMAGES,
  DEFAULT_CATEGORIES,
} from '../data/seedCatalog';
import type { ServiceCategory, ServiceItem, SiteSettings } from '../types/design';
import { formatPriceINR } from '../utils/orderUtils';
import { SafeImage } from './SafeImage';

interface HeroSectionProps {
  settings: SiteSettings;
  services: ServiceItem[];
  onExploreServices: () => void;
  onPlaceOrder: () => void;
  onSelectCategory: (category: ServiceCategory) => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  settings,
  services,
  onExploreServices,
  onPlaceOrder,
  onSelectCategory,
}) => {
  const enabledServices = services.filter((s) => s.enabled);
  const liveCategories = (
    settings.categories && settings.categories.length > 0
      ? settings.categories
      : DEFAULT_CATEGORIES
  )
    .filter((c) => c.enabled)
    .sort((a, b) => a.displayOrder - b.displayOrder);

  return (
    <div className="space-y-14 sm:space-y-16">
      {/* Hero Banner */}
      <section className="relative pt-6 sm:pt-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="gd-card rounded-3xl p-5 sm:p-10 lg:p-12 overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 sm:gap-8 items-center">
              <div className="lg:col-span-7 space-y-4 sm:space-y-5 text-center lg:text-left">
                <p className="text-xs sm:text-sm font-semibold tracking-widest uppercase text-[#35AFFF]">
                  {settings.bannerSubtitle || 'YOUR CREATIVE DESIGN PARTNER'}
                </p>

                <h1 className="font-display font-extrabold text-3xl sm:text-5xl lg:text-[54px] leading-[1.08] tracking-tight text-[#FFD369] [text-wrap:balance]">
                  {settings.bannerTitle || 'GURUDEV_DESIGNS'}
                </h1>

                <div className="space-y-2">
                  <p className="text-base sm:text-2xl font-semibold text-white">
                    Professional Graphic Design Services
                  </p>
                  <p className="text-xs sm:text-base text-slate-300 flex flex-wrap items-center justify-center lg:justify-start gap-x-2 gap-y-1">
                    <span>Creative Designs</span>
                    <span className="text-[#35AFFF]" aria-hidden="true">|</span>
                    <span>Quality Work</span>
                    <span className="text-[#35AFFF]" aria-hidden="true">|</span>
                    <span>Affordable Prices</span>
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3.5 pt-2">
                  <button
                    type="button"
                    onClick={onExploreServices}
                    className="gd-glow-btn-gold w-full sm:w-auto min-h-[48px] px-7 py-3 rounded-xl font-bold text-sm sm:text-base inline-flex items-center justify-center gap-2 cursor-pointer"
                  >
                    Explore Services
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={onPlaceOrder}
                    className="gd-glow-btn-blue w-full sm:w-auto min-h-[48px] px-7 py-3 rounded-xl font-bold text-sm sm:text-base inline-flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <PenTool className="w-4 h-4 text-[#FFD369]" aria-hidden="true" />
                    Place Your Order
                  </button>
                </div>
              </div>

              <div className="lg:col-span-5">
                <div className="rounded-2xl overflow-hidden border border-[#35AFFF]/40 shadow-[0_0_32px_rgba(53,175,255,0.2)] aspect-video lg:aspect-[4/3]">
                  <SafeImage
                    src={settings.bannerImageUrl || '/src/assets/images/hero_design_studio_1795608983810.jpg'}
                    alt="gurudev_designs creative studio illustration"
                    className="w-full h-full object-cover"
                    fallbackLabel="gurudev_designs Creative Studio"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Two-Column Service Categories Grid */}
      <section aria-labelledby="categories-heading" className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-6 sm:mb-8">
          <div>
            <h2
              id="categories-heading"
              className="font-display font-bold text-2xl sm:text-3xl text-[#FFD369]"
            >
              Our Design Categories
            </h2>
            <p className="text-sm sm:text-base text-slate-300 mt-1">
              Explore {enabledServices.length} specialized design services across {liveCategories.length} creative categories
            </p>
          </div>
          <button
            type="button"
            onClick={onExploreServices}
            className="text-sm font-semibold text-[#35AFFF] hover:text-[#FFD369] inline-flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
          >
            View All {enabledServices.length} Services
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3.5 sm:gap-6">
          {liveCategories.map((cat) => {
            const catServices = enabledServices.filter((s) => s.category === cat.name);
            const minPrice =
              catServices.length > 0 ? Math.min(...catServices.map((s) => s.price)) : 199;
            const catImage =
              cat.imageUrl ||
              CATEGORY_IMAGES[cat.name] ||
              '/src/assets/images/hero_design_studio_1795608983810.jpg';
            const catDesc = cat.description || CATEGORY_DESCRIPTIONS[cat.name] || '';

            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => onSelectCategory(cat.name)}
                className="gd-card rounded-2xl p-3.5 sm:p-5 text-left flex flex-col justify-between gap-3 group cursor-pointer focus-visible:outline-2 focus-visible:outline-[#35AFFF]"
              >
                <div className="space-y-3">
                  <div className="rounded-xl overflow-hidden border border-[#35AFFF]/25 aspect-[16/10] bg-[#06142E]">
                    <SafeImage
                      src={catImage}
                      alt={cat.name}
                      className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-200"
                      fallbackLabel={cat.name}
                    />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-display font-bold text-xs sm:text-lg text-[#FFD369] leading-snug">
                      {cat.name}
                    </h3>
                    <p className="text-[11px] sm:text-sm text-slate-300 line-clamp-2">
                      {catDesc}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-1.5 pt-2 border-t border-[#35AFFF]/20 text-[11px] sm:text-xs">
                  <span className="text-slate-300 font-medium">
                    {catServices.length} Services · From{' '}
                    <span className="font-mono-tabular text-[#FFD369] font-bold">
                      {formatPriceINR(minPrice)}
                    </span>
                  </span>
                  <span className="text-[#35AFFF] font-semibold inline-flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                    Browse <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
};
