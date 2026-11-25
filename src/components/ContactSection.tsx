import React from 'react';
import { Instagram, Mail, MapPin, MessageCircle, Phone, QrCode } from 'lucide-react';
import type { SiteSettings } from '../types/design';
import { buildWhatsAppUrl } from '../utils/orderUtils';

interface ContactSectionProps {
  settings: SiteSettings;
  onPlaceOrder: () => void;
}

export const ContactSection: React.FC<ContactSectionProps> = ({ settings, onPlaceOrder }) => {
  const directWaUrl = buildWhatsAppUrl(
    settings.whatsappNumber || '916353894486',
    `Hello ${settings.brandName || 'gurudev_designs'}, I would like to inquire about a custom graphic design.`
  );

  return (
    <section aria-labelledby="contact-heading" className="max-w-7xl mx-auto px-4 sm:px-6 space-y-6">
      <div className="space-y-1.5">
        <h2
          id="contact-heading"
          className="font-display font-bold text-2xl sm:text-3xl text-[#FFD369]"
        >
          Contact &amp; Payment Details
        </h2>
        <p className="text-sm sm:text-base text-slate-300">
          {settings.websiteDescription}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="gd-card rounded-2xl p-6 space-y-5">
          <h3 className="font-display font-bold text-xl text-white">
            Reach {settings.brandName || 'gurudev_designs'}
          </h3>

          <div className="space-y-3.5 text-sm text-slate-200">
            <div className="flex items-start gap-3">
              <Phone className="w-4 h-4 text-[#35AFFF] mt-0.5 shrink-0" aria-hidden="true" />
              <span>{settings.contactPhone || settings.whatsappNumber}</span>
            </div>
            {settings.contactEmail && (
              <div className="flex items-start gap-3">
                <Mail className="w-4 h-4 text-[#35AFFF] mt-0.5 shrink-0" aria-hidden="true" />
                <span>{settings.contactEmail}</span>
              </div>
            )}
            {settings.contactAddress && (
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-[#35AFFF] mt-0.5 shrink-0" aria-hidden="true" />
                <span>{settings.contactAddress}</span>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <a
              href={directWaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="gd-glow-btn-gold min-h-[46px] px-5 py-2.5 rounded-xl font-bold text-sm inline-flex items-center justify-center gap-2"
            >
              <MessageCircle className="w-4 h-4" aria-hidden="true" />
              Chat on WhatsApp
            </a>

            {settings.instagramUrl && (
              <a
                href={settings.instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="gd-glow-btn-blue min-h-[46px] px-5 py-2.5 rounded-xl font-semibold text-sm inline-flex items-center justify-center gap-2"
              >
                <Instagram className="w-4 h-4 text-[#FFD369]" aria-hidden="true" />
                Instagram Profile
              </a>
            )}
          </div>
        </div>

        <div className="gd-card rounded-2xl p-6 flex flex-col justify-between gap-5">
          <div className="space-y-2">
            <h3 className="font-display font-bold text-xl text-white flex items-center gap-2">
              <QrCode className="w-5 h-5 text-[#FFD369]" aria-hidden="true" />
              UPI &amp; Digital Payment
            </h3>
            <p className="text-sm text-slate-300">
              After submitting your order, send advance payment via UPI and share the screenshot on WhatsApp.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-5 bg-[#06142E]/80 border border-[#35AFFF]/25 rounded-2xl p-4">
            {settings.paymentQrUrl ? (
              <img
                src={settings.paymentQrUrl}
                alt="Payment QR Code"
                referrerPolicy="no-referrer"
                className="w-28 h-28 rounded-xl bg-white p-1.5 object-contain shrink-0"
              />
            ) : (
              <div className="w-28 h-28 rounded-xl bg-[#10264B] border border-[#35AFFF]/30 flex flex-col items-center justify-center text-center p-2 shrink-0">
                <QrCode className="w-8 h-8 text-[#35AFFF] mb-1" aria-hidden="true" />
                <span className="text-[11px] text-slate-300">QR Configured in Admin</span>
              </div>
            )}

            <div className="space-y-2 text-center sm:text-left">
              <div>
                <p className="text-xs text-slate-400">Official UPI ID</p>
                <p className="font-mono-tabular text-base font-bold text-[#FFD369]">
                  {settings.upiId || 'gurudevdesigns@upi'}
                </p>
              </div>
              <button
                type="button"
                onClick={onPlaceOrder}
                className="gd-glow-btn-blue px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Start Design Order
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
