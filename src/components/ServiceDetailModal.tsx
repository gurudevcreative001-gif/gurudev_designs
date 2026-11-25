import React from 'react';
import { Check, Clock, ShoppingBag, X } from 'lucide-react';
import type { ServiceItem } from '../types/design';
import { formatPriceINR } from '../utils/orderUtils';
import { SafeImage } from './SafeImage';

interface ServiceDetailModalProps {
  service: ServiceItem | null;
  onClose: () => void;
  onOrderNow: (service: ServiceItem) => void;
}

export const ServiceDetailModal: React.FC<ServiceDetailModalProps> = ({
  service,
  onClose,
  onOrderNow,
}) => {
  if (!service) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="service-detail-title"
    >
      <div className="gd-card rounded-3xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-5 sm:p-7 space-y-5 relative">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close service details"
          className="absolute top-4 right-4 w-10 h-10 rounded-xl bg-[#06142E] border border-[#35AFFF]/35 text-slate-200 hover:text-white flex items-center justify-center cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="rounded-2xl overflow-hidden border border-[#35AFFF]/30 aspect-[16/10] bg-[#06142E]">
          <SafeImage
            src={service.imageUrl}
            alt={service.name}
            className="w-full h-full object-cover"
            fallbackLabel={service.name}
          />
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-[#35AFFF] tracking-wide">
              {service.category}
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-300">
              <Clock className="w-3.5 h-3.5 text-[#FFD369]" aria-hidden="true" />
              {service.turnaround}
            </span>
          </div>

          <div className="flex items-start justify-between gap-4">
            <h2
              id="service-detail-title"
              className="font-display font-bold text-2xl text-[#FFD369]"
            >
              {service.name}
            </h2>
            <div className="text-right shrink-0">
              <p className="text-[11px] text-slate-400">Starting Price</p>
              <p className="font-mono-tabular text-xl font-extrabold text-white">
                {formatPriceINR(service.price)}
              </p>
            </div>
          </div>

          <p className="text-sm sm:text-base text-slate-200 leading-relaxed">
            {service.description}
          </p>

          {service.deliverables && service.deliverables.length > 0 && (
            <div className="pt-2 space-y-2">
              <h3 className="text-sm font-bold text-white">What You Receive</h3>
              <ul className="space-y-1.5">
                {service.deliverables.map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-slate-200">
                    <Check className="w-4 h-4 text-[#35AFFF] shrink-0" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="gd-glow-btn-blue min-h-[46px] sm:w-1/3 rounded-xl font-semibold text-sm cursor-pointer"
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onOrderNow(service);
            }}
            className="gd-glow-btn-gold min-h-[48px] sm:w-2/3 rounded-xl font-bold text-base inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            <ShoppingBag className="w-4 h-4" aria-hidden="true" />
            Order Now — {formatPriceINR(service.price)}
          </button>
        </div>
      </div>
    </div>
  );
};
