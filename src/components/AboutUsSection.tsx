import React from 'react';
import {
  Award,
  CheckCircle2,
  Clock,
  Instagram,
  Languages,
  MapPin,
  MessageCircle,
  Palette,
  Phone,
} from 'lucide-react';
import type { SiteSettings } from '../types/design';
import { buildWhatsAppUrl } from '../utils/orderUtils';

interface AboutUsSectionProps {
  settings: SiteSettings;
  serviceCount: number;
  onExploreServices: () => void;
  onPlaceOrder: () => void;
}

export const AboutUsSection: React.FC<AboutUsSectionProps> = ({
  settings,
  serviceCount,
  onExploreServices,
  onPlaceOrder,
}) => {
  const brand = settings.brandName || 'gurudev_designs';
  const waUrl = buildWhatsAppUrl(
    settings.whatsappNumber || '916353894486',
    `Hello ${brand}, I would like to know more about your graphic design services.`
  );

  return (
    <section
      aria-labelledby="about-us-heading"
      className="max-w-7xl mx-auto px-4 sm:px-6 space-y-8"
    >
      <div className="gd-card rounded-3xl p-6 sm:p-10 space-y-6">
        <div className="max-w-3xl space-y-3">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#35AFFF]">
            About Our Studio
          </p>
          <h1
            id="about-us-heading"
            className="font-display font-extrabold text-3xl sm:text-4xl text-[#FFD369]"
          >
            {brand} — Creative Design Studio
          </h1>
          <p className="text-sm sm:text-base text-slate-200 leading-relaxed">
            {settings.websiteDescription}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-2xl bg-[#06142E]/85 border border-[#35AFFF]/25 p-5 space-y-2">
            <Palette className="w-6 h-6 text-[#FFD369]" aria-hidden="true" />
            <h2 className="font-display font-bold text-lg text-white">
              {serviceCount}+ Specialized Designs
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Dedicated categories for Social Media, Business Branding, Gujarati Invitations, Shraddhanjali Tributes, Festivals, and Custom Events.
            </p>
          </div>

          <div className="rounded-2xl bg-[#06142E]/85 border border-[#35AFFF]/25 p-5 space-y-2">
            <Languages className="w-6 h-6 text-[#FFD369]" aria-hidden="true" />
            <h2 className="font-display font-bold text-lg text-white">
              Gujarati · Hindi · English
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Culturally accurate typography and traditional layouts crafted cleanly in regional Gujarati, Hindi, and modern English fonts.
            </p>
          </div>

          <div className="rounded-2xl bg-[#06142E]/85 border border-[#35AFFF]/25 p-5 space-y-2">
            <Clock className="w-6 h-6 text-[#FFD369]" aria-hidden="true" />
            <h2 className="font-display font-bold text-lg text-white">
              Fast Delivery &amp; WhatsApp Support
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Direct WhatsApp coordination, transparent revisions, and print-ready or social-ready high-resolution files delivered on time.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
          <div className="rounded-2xl bg-[#06142E]/75 border border-[#35AFFF]/20 p-5 space-y-3">
            <h2 className="font-display font-bold text-lg text-[#FFD369] flex items-center gap-2">
              <Award className="w-5 h-5" aria-hidden="true" />
              Why Clients Choose {brand}
            </h2>
            <ul className="space-y-2 text-sm text-slate-200">
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#35AFFF] mt-0.5 shrink-0" aria-hidden="true" />
                <span>Custom artwork tailored to your photos, logo, and event details</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#35AFFF] mt-0.5 shrink-0" aria-hidden="true" />
                <span>Affordable starting prices with clear deliverables and zero hidden charges</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#35AFFF] mt-0.5 shrink-0" aria-hidden="true" />
                <span>Instant order tracking and direct WhatsApp confirmation</span>
              </li>
            </ul>
          </div>

          <div className="rounded-2xl bg-[#06142E]/75 border border-[#35AFFF]/20 p-5 space-y-3">
            <h2 className="font-display font-bold text-lg text-[#FFD369]">
              Official Studio Contact
            </h2>
            <div className="space-y-2.5 text-sm text-slate-200">
              <div className="flex items-start gap-2.5">
                <Phone className="w-4 h-4 text-[#35AFFF] mt-0.5 shrink-0" aria-hidden="true" />
                <span>{settings.contactPhone || settings.whatsappNumber}</span>
              </div>
              {settings.contactAddress && (
                <div className="flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 text-[#35AFFF] mt-0.5 shrink-0" aria-hidden="true" />
                  <span>{settings.contactAddress}</span>
                </div>
              )}
              {settings.instagramUrl && (
                <div className="flex items-start gap-2.5">
                  <Instagram className="w-4 h-4 text-[#35AFFF] mt-0.5 shrink-0" aria-hidden="true" />
                  <a
                    href={settings.instagramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#35AFFF] hover:text-[#FFD369] underline"
                  >
                    {settings.instagramUrl}
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            type="button"
            onClick={onPlaceOrder}
            className="gd-glow-btn-gold min-h-[46px] px-6 py-2.5 rounded-xl font-bold text-sm cursor-pointer"
          >
            Place Design Order
          </button>
          <button
            type="button"
            onClick={onExploreServices}
            className="gd-glow-btn-blue min-h-[46px] px-5 py-2.5 rounded-xl font-semibold text-sm cursor-pointer"
          >
            Explore All Services
          </button>
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[46px] px-5 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-400/40 text-emerald-200 hover:bg-emerald-500/25 font-semibold text-sm inline-flex items-center gap-2"
          >
            <MessageCircle className="w-4 h-4 text-[#FFD369]" aria-hidden="true" />
            WhatsApp Studio
          </a>
        </div>
      </div>
    </section>
  );
};
