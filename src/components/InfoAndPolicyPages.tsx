import React from 'react';
import {
  CheckCircle2,
  CreditCard,
  FileText,
  MessageCircle,
  QrCode,
  RefreshCw,
  Shield,
} from 'lucide-react';
import type { SiteSettings } from '../types/design';
import { buildWhatsAppUrl } from '../utils/orderUtils';
import { resolveAssetUrl } from '../utils/assetUrl';

interface InfoPageProps {
  page: 'payment-info' | 'terms' | 'privacy' | 'refund';
  settings: SiteSettings;
  onCreateOrder: () => void;
}

export const InfoAndPolicyPages: React.FC<InfoPageProps> = ({
  page,
  settings,
  onCreateOrder,
}) => {
  const brand = settings.brandName || 'gurudev_designs';
  const waUrl = buildWhatsAppUrl(
    settings.whatsappNumber || '916353894486',
    `Hello ${brand}, I have a question regarding your policies or payments.`
  );

  if (page === 'payment-info') {
    return (
      <section aria-labelledby="payment-info-heading" className="max-w-4xl mx-auto px-4 sm:px-6 space-y-6">
        <div className="gd-card rounded-3xl p-6 sm:p-8 space-y-6">
          <div className="space-y-1.5">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#35AFFF]">
              Accepted Payment Methods
            </p>
            <h1 id="payment-info-heading" className="font-display font-extrabold text-2xl sm:text-3xl text-[#FFD369]">
              Payment Information
            </h1>
            <p className="text-sm text-slate-300">
              {brand} supports instant online payment via Razorpay as well as manual UPI QR verification.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="rounded-2xl bg-[#06142E] border border-[#35AFFF]/30 p-5 space-y-3">
              <div className="flex items-center gap-2.5 text-[#FFD369]">
                <CreditCard className="w-5 h-5" aria-hidden="true" />
                <h2 className="font-display font-bold text-lg text-white">
                  1. Instant Razorpay Checkout
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Pay securely with UPI apps, Debit/Credit Cards, NetBanking, or Wallets. Payments are verified automatically in real time and your order immediately moves to <strong className="text-emerald-300">Payment Verified</strong>.
              </p>
            </div>

            <div className="rounded-2xl bg-[#06142E] border border-[#35AFFF]/30 p-5 space-y-3">
              <div className="flex items-center gap-2.5 text-[#FFD369]">
                <QrCode className="w-5 h-5" aria-hidden="true" />
                <h2 className="font-display font-bold text-lg text-white">
                  2. Scan &amp; Pay QR / UPI ID
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Scan our studio QR code or transfer to{' '}
                <span className="font-mono-tabular text-[#FFD369] font-semibold">
                  {settings.upiId || 'gurudevdesigns@upi'}
                </span>
                . Enter your 12-digit UTR/Reference number on checkout; our studio verifies manual UPI transfers within minutes.
              </p>
              <div className="pt-1 flex justify-center sm:justify-start">
                <img
                  src={resolveAssetUrl(
                    settings.paymentQrUrl?.trim() ||
                      '/assets/aistudio/IMG_20261124_164417_229847fc.jpg'
                  )}
                  alt="Official Studio Payment QR"
                  className="w-32 h-32 rounded-xl bg-white p-1.5 object-contain border border-[#35AFFF]/35"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onCreateOrder}
              className="gd-glow-btn-gold min-h-[44px] px-5 py-2.5 rounded-2xl text-sm font-bold cursor-pointer"
            >
              Create Design Order
            </button>
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="gd-glow-btn-blue min-h-[44px] px-5 py-2.5 rounded-2xl text-sm font-semibold inline-flex items-center gap-2"
            >
              <MessageCircle className="w-4 h-4 text-[#FFD369]" aria-hidden="true" />
              WhatsApp Payment Help
            </a>
          </div>
        </div>
      </section>
    );
  }

  if (page === 'terms') {
    return (
      <section aria-labelledby="terms-heading" className="max-w-4xl mx-auto px-4 sm:px-6">
        <div className="gd-card rounded-3xl p-6 sm:p-8 space-y-5">
          <div className="flex items-center gap-2.5">
            <FileText className="w-6 h-6 text-[#FFD369]" aria-hidden="true" />
            <h1 id="terms-heading" className="font-display font-extrabold text-2xl sm:text-3xl text-[#FFD369]">
              Terms &amp; Conditions
            </h1>
          </div>
          <div className="space-y-4 text-sm text-slate-200 leading-relaxed">
            <div className="rounded-2xl bg-[#06142E]/80 border border-[#35AFFF]/20 p-4 space-y-1.5">
              <h2 className="font-bold text-white">1. Custom Design Scope &amp; Briefing</h2>
              <p className="text-slate-300">
                All designs are created custom to the text, language (Gujarati, Hindi, or English), dimensions, and reference photos you provide during checkout. Please verify spelling and dates carefully before final approval.
              </p>
            </div>
            <div className="rounded-2xl bg-[#06142E]/80 border border-[#35AFFF]/20 p-4 space-y-1.5">
              <h2 className="font-bold text-white">2. Revisions &amp; Turnaround</h2>
              <p className="text-slate-300">
                Each service includes up to 2 complimentary text or color adjustments on the submitted concept. Standard turnaround ranges from same-day delivery to 24–48 hours depending on design complexity.
              </p>
            </div>
            <div className="rounded-2xl bg-[#06142E]/80 border border-[#35AFFF]/20 p-4 space-y-1.5">
              <h2 className="font-bold text-white">3. Digital File Delivery</h2>
              <p className="text-slate-300">
                Final high-resolution files (PNG, JPG, and print-ready PDF where specified) are delivered cleanly via WhatsApp or direct download link once payment is verified and the artwork is completed.
              </p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (page === 'privacy') {
    return (
      <section aria-labelledby="privacy-heading" className="max-w-4xl mx-auto px-4 sm:px-6">
        <div className="gd-card rounded-3xl p-6 sm:p-8 space-y-5">
          <div className="flex items-center gap-2.5">
            <Shield className="w-6 h-6 text-[#FFD369]" aria-hidden="true" />
            <h1 id="privacy-heading" className="font-display font-extrabold text-2xl sm:text-3xl text-[#FFD369]">
              Privacy Policy
            </h1>
          </div>
          <div className="space-y-4 text-sm text-slate-200 leading-relaxed">
            <div className="rounded-2xl bg-[#06142E]/80 border border-[#35AFFF]/20 p-4 space-y-1.5">
              <h2 className="font-bold text-white">1. Data We Collect</h2>
              <p className="text-slate-300">
                We collect only the information needed to craft and deliver your custom graphic design: your name, WhatsApp mobile number, design instructions, and any photos or brand logos you choose to upload.
              </p>
            </div>
            <div className="rounded-2xl bg-[#06142E]/80 border border-[#35AFFF]/20 p-4 space-y-1.5">
              <h2 className="font-bold text-white">2. Private Order Protection</h2>
              <p className="text-slate-300">
                Uploaded reference photos, personal portraits (including Shraddhanjali &amp; invitation photos), brand logos, payment screenshots, and mobile numbers are strictly restricted to our studio team and are never exposed on the public My Orders lookup page.
              </p>
            </div>
            <div className="rounded-2xl bg-[#06142E]/80 border border-[#35AFFF]/20 p-4 space-y-1.5">
              <h2 className="font-bold text-white">3. Zero Third-Party Selling</h2>
              <p className="text-slate-300">
                {brand} never sells, rents, or shares customer contact details or private media with third parties.
              </p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="refund-heading" className="max-w-4xl mx-auto px-4 sm:px-6">
      <div className="gd-card rounded-3xl p-6 sm:p-8 space-y-5">
        <div className="flex items-center gap-2.5">
          <RefreshCw className="w-6 h-6 text-[#FFD369]" aria-hidden="true" />
          <h1 id="refund-heading" className="font-display font-extrabold text-2xl sm:text-3xl text-[#FFD369]">
            Refund Policy
          </h1>
        </div>
        <div className="space-y-4 text-sm text-slate-200 leading-relaxed">
          <div className="rounded-2xl bg-[#06142E]/80 border border-[#35AFFF]/20 p-4 space-y-1.5">
            <h2 className="font-bold text-white flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-300" aria-hidden="true" />
              Before Designing Starts
            </h2>
            <p className="text-slate-300">
              If you request cancellation on WhatsApp before a designer has begun working on your order (status: Order Received or Payment Verified), you are eligible for a 100% refund to your original payment method within 3–5 business days.
            </p>
          </div>
          <div className="rounded-2xl bg-[#06142E]/80 border border-[#35AFFF]/20 p-4 space-y-1.5">
            <h2 className="font-bold text-white">After Designing Starts / Completed Artwork</h2>
            <p className="text-slate-300">
              Because every graphic design is bespoke digital creative work, orders already in <strong className="text-white">Designing Started</strong> or <strong className="text-white">Design Completed</strong> status are non-refundable, though we gladly complete your included revisions to ensure you love the final result.
            </p>
          </div>
          <div className="rounded-2xl bg-[#06142E]/80 border border-[#35AFFF]/20 p-4 space-y-1.5">
            <h2 className="font-bold text-white">Duplicate Charges</h2>
            <p className="text-slate-300">
              Any accidental duplicate Razorpay or UPI payment is refunded in full immediately after verification. Contact us on WhatsApp with both Order IDs.
            </p>
          </div>
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="gd-glow-btn-blue min-h-[44px] px-5 py-2.5 rounded-2xl text-sm font-semibold inline-flex items-center gap-2"
          >
            <MessageCircle className="w-4 h-4 text-[#FFD369]" aria-hidden="true" />
            Contact Support on WhatsApp
          </a>
        </div>
      </div>
    </section>
  );
};
