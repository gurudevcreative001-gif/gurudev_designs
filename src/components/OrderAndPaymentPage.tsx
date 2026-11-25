import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  CreditCard,
  Edit3,
  ImagePlus,
  Loader2,
  QrCode,
  ReceiptText,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Trash2,
  Upload,
} from 'lucide-react';
import { DEFAULT_CATEGORIES, DESIGN_SIZE_PRESETS } from '../data/seedCatalog';
import { submitCustomerOrder, uploadFileWithProgress } from '../services/firebaseService';
import {
  DESIGN_LANGUAGES,
  PAYMENT_METHOD_OPTIONS,
  type ConfirmedOrderSummary,
  type DesignLanguage,
  type PaymentMethodOption,
  type ServiceItem,
  type SiteSettings,
} from '../types/design';
import {
  buildWhatsAppUrl,
  calculatePricingSummary,
  formatPriceINR,
  formatWhatsAppMessage,
  generateOrderId,
  validateDesignDetailsInput,
  validateFileSelection,
  validateOrderInput,
  type OrderValidationErrors,
} from '../utils/orderUtils';
import { resolveAssetUrl } from '../utils/assetUrl';

interface SelectedFileItem {
  id: string;
  file: File;
  previewUrl: string;
  progress: number;
  uploadedUrl?: string;
}

interface OrderAndPaymentPageProps {
  step: 'order-form' | 'payment';
  selectedService: ServiceItem | null;
  services: ServiceItem[];
  settings: SiteSettings;
  onBackToServices: () => void;
  onProceedToPayment: () => void;
  onBackToOrderForm: () => void;
  onOrderConfirmed: (summary: ConfirmedOrderSummary) => void;
}

interface RazorpayCheckoutResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayInstance {
  open: () => void;
  on: (event: string, cb: (payload: { error?: { description?: string } }) => void) => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

function loadRazorpayCheckoutScript(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);

  return new Promise((resolve) => {
    const existing = document.querySelector('script[data-razorpay-checkout="true"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(Boolean(window.Razorpay)));
      existing.addEventListener('error', () => resolve(false));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.dataset.razorpayCheckout = 'true';
    script.onload = () => resolve(Boolean(window.Razorpay));
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export const OrderAndPaymentPage: React.FC<OrderAndPaymentPageProps> = ({
  step,
  selectedService: initialService,
  services,
  settings,
  onBackToServices,
  onProceedToPayment,
  onBackToOrderForm,
  onOrderConfirmed,
}) => {
  const enabledServices = useMemo(
    () => services.filter((s) => s.enabled).sort((a, b) => a.displayOrder - b.displayOrder),
    [services]
  );

  const liveCategories = useMemo(() => {
    const base =
      settings.categories && settings.categories.length > 0
        ? settings.categories
        : DEFAULT_CATEGORIES;
    const ordered = base
      .filter((c) => c.enabled !== false)
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((c) => c.name);
    for (const svc of enabledServices) {
      if (svc.category && !ordered.includes(svc.category)) {
        ordered.push(svc.category);
      }
    }
    return ordered;
  }, [settings.categories, enabledServices]);

  // Step 1: Order Form State
  const [customerName, setCustomerName] = useState('');
  const [mobile, setMobile] = useState('');
  const [serviceId, setServiceId] = useState(
    initialService?.id || enabledServices[0]?.id || ''
  );
  const [designSizePreset, setDesignSizePreset] = useState(DESIGN_SIZE_PRESETS[0]);
  const [customSize, setCustomSize] = useState('');
  const [language, setLanguage] = useState<DesignLanguage>('Gujarati');
  const [designText, setDesignText] = useState('');
  const [requirements, setRequirements] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');

  // File Uploads
  const [refPhotos, setRefPhotos] = useState<SelectedFileItem[]>([]);
  const [logoFile, setLogoFile] = useState<SelectedFileItem | null>(null);
  const [logoProgress, setLogoProgress] = useState(0);

  // Step 2: Payment Screen State
  const razorpayEnabled = settings.razorpayEnabled !== false;
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodOption>(
    razorpayEnabled ? 'Razorpay' : 'Scan & Pay QR'
  );
  const [razorpayServerReady, setRazorpayServerReady] = useState<boolean | null>(null);
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentScreenshot, setPaymentScreenshot] = useState<SelectedFileItem | null>(null);
  const [paymentShotProgress, setPaymentShotProgress] = useState(0);
  const [paymentCompletedChecked, setPaymentCompletedChecked] = useState(false);
  const [copiedUpi, setCopiedUpi] = useState(false);

  // Validation & Submit
  const [errors, setErrors] = useState<OrderValidationErrors>({});
  const [fileError, setFileError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const pendingOrderIdRef = useRef<string | null>(null);
  const sessionFolderRef = useRef<string>(
    `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
  );
  const refInputRef = useRef<HTMLInputElement | null>(null);
  const replacePhotoInputRef = useRef<HTMLInputElement | null>(null);
  const replaceTargetIdRef = useRef<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const paymentShotInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (initialService) {
      setServiceId(initialService.id);
    } else if (!serviceId && enabledServices[0]) {
      setServiceId(enabledServices[0].id);
    }
  }, [initialService, enabledServices, serviceId]);

  useEffect(() => {
    if (step !== 'payment') return;
    let active = true;
    fetch('/api/payments/razorpay/config')
      .then((res) => res.json())
      .then((data: { configured?: boolean }) => {
        if (active) setRazorpayServerReady(Boolean(data.configured));
      })
      .catch(() => {
        if (active) setRazorpayServerReady(false);
      });
    return () => {
      active = false;
    };
  }, [step]);

  useEffect(() => {
    if (!razorpayEnabled && paymentMethod === 'Razorpay') {
      setPaymentMethod('Scan & Pay QR');
    }
  }, [razorpayEnabled, paymentMethod]);

  const activeService =
    enabledServices.find((s) => s.id === serviceId) || initialService || enabledServices[0] || null;
  const pricing = calculatePricingSummary(activeService?.price || 0, settings);

  const effectiveDesignSize =
    designSizePreset === 'Custom Size (Specify in Requirements)'
      ? customSize.trim() || 'Custom Size'
      : designSizePreset;

  const handleAddReferencePhotos = (files: FileList | null) => {
    if (!files) return;
    setFileError(null);
    const next: SelectedFileItem[] = [];
    for (const file of Array.from(files)) {
      if (refPhotos.length + next.length >= 10) {
        setFileError('Maximum 10 reference photos can be uploaded per order.');
        break;
      }
      const err = validateFileSelection(file);
      if (err) {
        setFileError(err);
        continue;
      }
      next.push({
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        file,
        previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : '',
        progress: 0,
      });
    }
    setRefPhotos((prev) => [...prev, ...next]);
  };

  const handleReplacePhoto = (photoId: string) => {
    replaceTargetIdRef.current = photoId;
    replacePhotoInputRef.current?.click();
  };

  const handleReplacePhotoSelected = (files: FileList | null) => {
    const targetId = replaceTargetIdRef.current;
    if (!files || !files[0] || !targetId) return;
    const file = files[0];
    const err = validateFileSelection(file);
    if (err) {
      setFileError(err);
      return;
    }
    setFileError(null);
    setRefPhotos((prev) =>
      prev.map((item) => {
        if (item.id !== targetId) return item;
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
        return {
          ...item,
          file,
          previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : '',
          progress: 0,
          uploadedUrl: undefined,
        };
      })
    );
  };

  const handleRemovePhoto = (photoId: string) => {
    setRefPhotos((prev) => {
      const target = prev.find((p) => p.id === photoId);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.id !== photoId);
    });
  };

  const handleSelectLogo = (files: FileList | null) => {
    if (!files || !files[0]) return;
    const file = files[0];
    const err = validateFileSelection(file);
    if (err) {
      setFileError(err);
      return;
    }
    setFileError(null);
    if (logoFile?.previewUrl) URL.revokeObjectURL(logoFile.previewUrl);
    setLogoFile({
      id: `logo_${Date.now()}`,
      file,
      previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : '',
      progress: 0,
    });
    setLogoProgress(0);
  };

  const handleSelectPaymentScreenshot = (files: FileList | null) => {
    if (!files || !files[0]) return;
    const file = files[0];
    const err = validateFileSelection(file);
    if (err) {
      setFileError(err);
      return;
    }
    setFileError(null);
    if (paymentScreenshot?.previewUrl) URL.revokeObjectURL(paymentScreenshot.previewUrl);
    setPaymentScreenshot({
      id: `pay_${Date.now()}`,
      file,
      previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : '',
      progress: 0,
    });
    setPaymentShotProgress(0);
  };

  const handleCopyUpi = async () => {
    if (!settings.upiId) return;
    try {
      await navigator.clipboard.writeText(settings.upiId);
      setCopiedUpi(true);
      setTimeout(() => setCopiedUpi(false), 2000);
    } catch {
      // Clipboard blocked in sandbox
    }
  };

  const uploadDesignAttachments = async (): Promise<{
    uploadedPhotoUrls: string[];
    uploadedLogoUrl: string;
  }> => {
    const uploadedPhotoUrls: string[] = [];
    for (let i = 0; i < refPhotos.length; i += 1) {
      const item = refPhotos[i];
      if (item.uploadedUrl) {
        uploadedPhotoUrls.push(item.uploadedUrl);
        continue;
      }
      const safeName = item.file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
      const path = `order-uploads/${sessionFolderRef.current}/ref_${i}_${Date.now()}_${safeName}`;
      const url = await uploadFileWithProgress(item.file, path, (pct) => {
        setRefPhotos((prev) =>
          prev.map((p) => (p.id === item.id ? { ...p, progress: pct } : p))
        );
      });
      uploadedPhotoUrls.push(url);
      setRefPhotos((prev) =>
        prev.map((p) => (p.id === item.id ? { ...p, uploadedUrl: url, progress: 100 } : p))
      );
    }

    let uploadedLogoUrl = logoFile?.uploadedUrl || '';
    if (logoFile && !uploadedLogoUrl) {
      const safeName = logoFile.file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
      const path = `order-uploads/${sessionFolderRef.current}/logo_${Date.now()}_${safeName}`;
      uploadedLogoUrl = await uploadFileWithProgress(logoFile.file, path, (pct) => {
        setLogoProgress(pct);
      });
      setLogoFile((prev) => (prev ? { ...prev, uploadedUrl: uploadedLogoUrl, progress: 100 } : null));
    }

    return { uploadedPhotoUrls, uploadedLogoUrl };
  };

  const handleContinueToPayment = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    const validation = validateDesignDetailsInput({
      customerName,
      mobile,
      serviceId: activeService?.id || '',
      serviceName: activeService?.name || '',
      designSize: effectiveDesignSize,
      language,
      designText,
      requirements,
      specialInstructions,
    });

    if (Object.keys(validation).length > 0) {
      setErrors(validation);
      return;
    }

    setErrors({});
    onProceedToPayment();
  };

  const finalizeAndSaveOrder = async (opts: {
    method: PaymentMethodOption;
    paymentRef: string;
    paymentShotUrl: string;
    razorpayOrderId?: string;
    razorpayPaymentId?: string;
    razorpaySignature?: string;
  }) => {
    const serviceName = activeService?.name || '';
    const { uploadedPhotoUrls, uploadedLogoUrl } = await uploadDesignAttachments();
    const stableOrderId = pendingOrderIdRef.current || generateOrderId();
    pendingOrderIdRef.current = stableOrderId;

    const saved = await submitCustomerOrder({
      orderId: stableOrderId,
      customerName,
      mobile,
      serviceId: activeService?.id || serviceId,
      serviceName,
      servicePrice: pricing.totalPrice,
      discountAmount: pricing.discountAmount,
      finalAmount: pricing.finalPayable,
      designSize: effectiveDesignSize,
      language,
      designText,
      requirements,
      specialInstructions,
      referencePhotos: uploadedPhotoUrls,
      logoUrl: uploadedLogoUrl,
      paymentMethod: opts.method,
      paymentReference: opts.paymentRef,
      paymentScreenshotUrl: opts.paymentShotUrl,
      razorpayOrderId: opts.razorpayOrderId,
      razorpayPaymentId: opts.razorpayPaymentId,
      razorpaySignature: opts.razorpaySignature,
    });

    const whatsappMessage = formatWhatsAppMessage({
      brandName: settings.brandName || 'gurudev_designs',
      orderId: saved.orderId,
      customerName,
      mobile,
      serviceName,
      servicePrice: pricing.totalPrice,
      discountAmount: pricing.discountAmount,
      finalAmount: pricing.finalPayable,
      paymentMethod: opts.method,
      paymentReference: opts.paymentRef,
      paymentStatus: saved.paymentStatus,
      designSize: effectiveDesignSize,
      language,
      requirements,
      designText,
      specialInstructions,
    });

    const whatsappUrl = buildWhatsAppUrl(
      settings.whatsappNumber || '916353894486',
      whatsappMessage
    );

    const summary: ConfirmedOrderSummary = {
      orderId: saved.orderId,
      customerName: customerName.trim(),
      mobile: mobile.trim(),
      serviceName,
      servicePrice: pricing.totalPrice,
      discountAmount: pricing.discountAmount,
      finalAmount: pricing.finalPayable,
      paymentMethod: opts.method,
      paymentReference: opts.paymentRef,
      paymentStatus: saved.paymentStatus,
      orderStatus: saved.orderStatus,
      orderDateLabel: new Date().toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      whatsappUrl,
    };

    pendingOrderIdRef.current = null;
    onOrderConfirmed(summary);
  };

  const handleRazorpayPayNow = async () => {
    if (isSubmitting) return;
    setSubmitError(null);

    const validation = validateOrderInput({
      customerName,
      mobile,
      serviceId: activeService?.id || '',
      serviceName: activeService?.name || '',
      designSize: effectiveDesignSize,
      language,
      designText,
      requirements,
      specialInstructions,
      paymentMethod: 'Razorpay',
    });

    if (Object.keys(validation).length > 0) {
      setErrors(validation);
      onBackToOrderForm();
      return;
    }

    if (pricing.finalPayable < 1) {
      setSubmitError('Payable amount must be at least ₹1 for Razorpay checkout.');
      return;
    }

    setIsSubmitting(true);
    try {
      const stableOrderId = pendingOrderIdRef.current || generateOrderId();
      pendingOrderIdRef.current = stableOrderId;

      const createRes = await fetch('/api/payments/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountInInr: pricing.finalPayable,
          receipt: stableOrderId,
          serviceName: activeService?.name || 'Design Service',
          customerName: customerName.trim(),
        }),
      });

      const createData = (await createRes.json()) as {
        razorpayOrderId?: string;
        amountPaise?: number;
        currency?: string;
        keyId?: string;
        error?: string;
      };

      if (!createRes.ok || !createData.razorpayOrderId || !createData.keyId) {
        setSubmitError(
          createData.error ||
            'Razorpay checkout is unavailable right now. Please use Scan & Pay QR or UPI Payment.'
        );
        setIsSubmitting(false);
        return;
      }

      const loaded = await loadRazorpayCheckoutScript();
      if (!loaded || !window.Razorpay) {
        setSubmitError(
          'Unable to load Razorpay Checkout script. Check your internet connection or pay via Scan & Pay QR.'
        );
        setIsSubmitting(false);
        return;
      }

      const rzp = new window.Razorpay({
        key: createData.keyId,
        amount: createData.amountPaise,
        currency: createData.currency || 'INR',
        name: settings.razorpayMerchantName || settings.brandName || 'gurudev_designs',
        description: activeService?.name || 'Graphic Design Service',
        order_id: createData.razorpayOrderId,
        prefill: {
          name: customerName.trim(),
          contact: mobile.replace(/\D/g, '').slice(-10),
        },
        theme: {
          color: '#06142E',
        },
        modal: {
          ondismiss: () => {
            setIsSubmitting(false);
          },
        },
        handler: async (response: RazorpayCheckoutResponse) => {
          try {
            const verifyRes = await fetch('/api/payments/razorpay/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
                expectedAmountInr: pricing.finalPayable,
              }),
            });

            const verifyJson = (await verifyRes.json()) as {
              verified?: boolean;
              error?: string;
            };

            if (!verifyRes.ok || !verifyJson.verified) {
              setSubmitError(
                verifyJson.error || 'Payment verification failed. Contact studio support if debited.'
              );
              setIsSubmitting(false);
              return;
            }

            await finalizeAndSaveOrder({
              method: 'Razorpay',
              paymentRef: response.razorpay_payment_id,
              paymentShotUrl: '',
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
          } catch (err) {
            setSubmitError(
              err instanceof Error
                ? err.message
                : 'Payment was verified, but saving order failed. Please contact WhatsApp support.'
            );
          } finally {
            setIsSubmitting(false);
          }
        },
      });

      rzp.on('payment.failed', (failure) => {
        setSubmitError(
          failure.error?.description || 'Razorpay payment did not complete. You can retry or use UPI QR.'
        );
        setIsSubmitting(false);
      });

      rzp.open();
    } catch {
      setSubmitError('Unable to launch Razorpay payment gateway. Try Scan & Pay QR or UPI Payment.');
      setIsSubmitting(false);
    }
  };

  const handleManualPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setSubmitError(null);
    const serviceName = activeService?.name || '';
    const validation = validateOrderInput({
      customerName,
      mobile,
      serviceId: activeService?.id || '',
      serviceName,
      designSize: effectiveDesignSize,
      language,
      designText,
      requirements,
      specialInstructions,
      paymentMethod,
      paymentReference,
      paymentCompletedChecked,
    });

    if (Object.keys(validation).length > 0) {
      setErrors(validation);
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    try {
      let uploadedPaymentShotUrl = paymentScreenshot?.uploadedUrl || '';
      if (paymentScreenshot && !uploadedPaymentShotUrl) {
        const safeName = paymentScreenshot.file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
        const path = `order-uploads/${sessionFolderRef.current}/payment_${Date.now()}_${safeName}`;
        uploadedPaymentShotUrl = await uploadFileWithProgress(
          paymentScreenshot.file,
          path,
          (pct) => {
            setPaymentShotProgress(pct);
          }
        );
        setPaymentScreenshot((prev) =>
          prev ? { ...prev, uploadedUrl: uploadedPaymentShotUrl, progress: 100 } : null
        );
      }

      await finalizeAndSaveOrder({
        method: paymentMethod,
        paymentRef: paymentReference.trim(),
        paymentShotUrl: uploadedPaymentShotUrl,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to submit order.';
      if (msg.includes('storage/unauthorized') || msg.includes('storage/')) {
        setSubmitError(
          'File upload failed in Firebase Storage. Please remove attachments and share them directly on WhatsApp.'
        );
      } else {
        setSubmitError(
          'Could not save your order right now. Please verify your internet connection and try again.'
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const availablePaymentMethods = PAYMENT_METHOD_OPTIONS.filter(
    (opt) => opt !== 'Razorpay' || razorpayEnabled
  );

  return (
    <section
      aria-labelledby="order-payment-heading"
      className="max-w-5xl mx-auto px-4 sm:px-6 space-y-6"
    >
      {/* Two-Step Progress Header */}
      <div className="gd-card rounded-3xl p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <button
            type="button"
            onClick={step === 'payment' ? onBackToOrderForm : onBackToServices}
            className="text-xs font-semibold text-[#35AFFF] hover:text-[#FFD369] inline-flex items-center gap-1.5 cursor-pointer mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            {step === 'payment' ? 'Edit Order Details' : 'Back to All Design Services'}
          </button>
          <h1
            id="order-payment-heading"
            className="font-display font-extrabold text-2xl sm:text-3xl text-[#FFD369]"
          >
            {step === 'order-form' ? 'Step 1: Order Details' : 'Step 2: Payment Screen'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-300">
            {step === 'order-form'
              ? 'Fill in your design requirements and upload reference photos before payment.'
              : 'Review your pricing summary and pay securely with Razorpay or UPI QR.'}
          </p>
        </div>

        {activeService && (
          <div className="bg-[#06142E] border border-[#35AFFF]/40 rounded-2xl px-4 py-3 text-left sm:text-right shrink-0">
            <p className="text-[11px] uppercase tracking-wider text-[#35AFFF] font-semibold">
              Selected Service
            </p>
            <p className="font-display font-bold text-sm sm:text-base text-white">
              {activeService.name}
            </p>
            <p className="font-mono-tabular text-lg font-extrabold text-[#FFD369]">
              {formatPriceINR(pricing.finalPayable)}
              {pricing.discountAmount > 0 && (
                <span className="ml-2 text-xs text-slate-400 line-through font-normal">
                  {formatPriceINR(pricing.totalPrice)}
                </span>
              )}
            </p>
          </div>
        )}
      </div>

      {submitError && (
        <div
          role="alert"
          className="rounded-2xl bg-rose-500/15 border border-rose-400/50 p-4 text-sm text-rose-200"
        >
          {submitError}
        </div>
      )}

      {/* STEP 1: ORDER FORM */}
      {step === 'order-form' && (
        <form onSubmit={handleContinueToPayment} className="gd-card rounded-3xl p-5 sm:p-7 space-y-5" noValidate>
          <div className="flex items-center gap-2.5 border-b border-[#35AFFF]/20 pb-3">
            <ReceiptText className="w-5 h-5 text-[#FFD369]" aria-hidden="true" />
            <h2 className="font-display font-bold text-lg sm:text-xl text-white">
              Customer &amp; Design Form
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="order-name" className="block text-xs sm:text-sm font-semibold text-white">
                Customer Name <span className="text-[#FFD369]">*</span>
              </label>
              <input
                id="order-name"
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="e.g. Rajeshbhai Patel"
                className="w-full h-11 px-3.5 rounded-2xl bg-[#06142E] border border-[#35AFFF]/35 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:border-[#35AFFF]"
              />
              {errors.customerName && (
                <p className="text-xs text-rose-300">{errors.customerName}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="order-mobile" className="block text-xs sm:text-sm font-semibold text-white">
                WhatsApp Number <span className="text-[#FFD369]">*</span>
              </label>
              <input
                id="order-mobile"
                type="tel"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="e.g. +91 98765 43210"
                className="w-full h-11 px-3.5 rounded-2xl bg-[#06142E] border border-[#35AFFF]/35 text-sm font-mono-tabular text-white placeholder:text-slate-400 focus:outline-none focus:border-[#35AFFF]"
              />
              {errors.mobile && <p className="text-xs text-rose-300">{errors.mobile}</p>}
            </div>
          </div>

          {/* Selected Service & Auto-filled Price */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <label htmlFor="order-service" className="block text-xs sm:text-sm font-semibold text-white">
                Selected Service <span className="text-[#FFD369]">*</span>
              </label>
              <select
                id="order-service"
                value={activeService?.id || ''}
                onChange={(e) => setServiceId(e.target.value)}
                className="w-full h-11 px-3.5 rounded-2xl bg-[#06142E] border border-[#35AFFF]/35 text-sm text-white focus:outline-none focus:border-[#35AFFF]"
              >
                {liveCategories.map((cat) => {
                  const catServices = enabledServices.filter((s) => s.category === cat);
                  if (catServices.length === 0) return null;
                  return (
                    <optgroup key={cat} label={cat} className="bg-[#06142E] text-[#FFD369]">
                      {catServices.map((svc) => (
                        <option key={svc.id} value={svc.id} className="bg-[#06142E] text-white">
                          {svc.name} ({formatPriceINR(svc.price)})
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
              </select>
              {errors.serviceId && <p className="text-xs text-rose-300">{errors.serviceId}</p>}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="order-service-price" className="block text-xs sm:text-sm font-semibold text-white">
                Service Price
              </label>
              <input
                id="order-service-price"
                type="text"
                readOnly
                value={formatPriceINR(pricing.totalPrice)}
                className="w-full h-11 px-3.5 rounded-2xl bg-[#06142E]/80 border border-[#FFD369]/40 text-sm font-mono-tabular font-bold text-[#FFD369]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="order-size" className="block text-xs sm:text-sm font-semibold text-white">
                Design Size <span className="text-[#FFD369]">*</span>
              </label>
              <select
                id="order-size"
                value={designSizePreset}
                onChange={(e) => setDesignSizePreset(e.target.value)}
                className="w-full h-11 px-3.5 rounded-2xl bg-[#06142E] border border-[#35AFFF]/35 text-sm text-white focus:outline-none focus:border-[#35AFFF]"
              >
                {DESIGN_SIZE_PRESETS.map((preset) => (
                  <option key={preset} value={preset} className="bg-[#06142E]">
                    {preset}
                  </option>
                ))}
              </select>
              {designSizePreset === 'Custom Size (Specify in Requirements)' && (
                <input
                  type="text"
                  value={customSize}
                  onChange={(e) => setCustomSize(e.target.value)}
                  placeholder="Enter custom dimensions (e.g. 10x8 ft)"
                  aria-label="Custom design size"
                  className="mt-2 w-full h-10 px-3.5 rounded-2xl bg-[#06142E] border border-[#35AFFF]/35 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:border-[#35AFFF]"
                />
              )}
              {errors.designSize && <p className="text-xs text-rose-300">{errors.designSize}</p>}
            </div>

            <div className="space-y-1.5">
              <span className="block text-xs sm:text-sm font-semibold text-white">
                Language <span className="text-[#FFD369]">*</span>
              </span>
              <div className="grid grid-cols-3 gap-2">
                {DESIGN_LANGUAGES.map((lang) => {
                  const active = language === lang;
                  return (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => setLanguage(lang)}
                      className={`h-11 rounded-2xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
                        active
                          ? 'bg-[#FFD369] text-[#06142E] font-bold'
                          : 'bg-[#06142E] text-slate-200 border border-[#35AFFF]/35 hover:border-[#35AFFF]'
                      }`}
                    >
                      {lang}
                    </button>
                  );
                })}
              </div>
              {errors.language && <p className="text-xs text-rose-300">{errors.language}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="order-text" className="block text-xs sm:text-sm font-semibold text-white">
              Design Text
            </label>
            <textarea
              id="order-text"
              rows={2}
              value={designText}
              onChange={(e) => setDesignText(e.target.value)}
              placeholder="Names, dates, venue, offers, phone numbers, or Gujarati/Hindi wording..."
              className="w-full p-3.5 rounded-2xl bg-[#06142E] border border-[#35AFFF]/35 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:border-[#35AFFF]"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="order-requirements" className="block text-xs sm:text-sm font-semibold text-white">
              Requirements <span className="text-[#FFD369]">*</span>
            </label>
            <textarea
              id="order-requirements"
              rows={3}
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              placeholder="Describe colors, theme, style, or layout preferences..."
              className="w-full p-3.5 rounded-2xl bg-[#06142E] border border-[#35AFFF]/35 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:border-[#35AFFF]"
            />
            {errors.requirements && (
              <p className="text-xs text-rose-300">{errors.requirements}</p>
            )}
          </div>

          {/* Upload Multiple Photos + Upload Logo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2 bg-[#06142E]/70 border border-[#35AFFF]/25 rounded-2xl p-3.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs sm:text-sm font-semibold text-white">
                  Upload Multiple Photos
                </span>
                <span className="text-[11px] text-slate-400">Up to 10</span>
              </div>

              <input
                ref={refInputRef}
                type="file"
                multiple
                accept="image/*,application/pdf"
                onChange={(e) => {
                  handleAddReferencePhotos(e.target.files);
                  e.target.value = '';
                }}
                className="hidden"
              />
              <input
                ref={replacePhotoInputRef}
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => {
                  handleReplacePhotoSelected(e.target.files);
                  e.target.value = '';
                }}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => refInputRef.current?.click()}
                className="gd-glow-btn-blue w-full min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <ImagePlus className="w-4 h-4 text-[#FFD369]" aria-hidden="true" />
                Add Multiple Photos
              </button>

              {refPhotos.length > 0 && (
                <ul className="space-y-2 pt-1">
                  {refPhotos.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center gap-2.5 bg-[#10264B] border border-[#35AFFF]/25 rounded-xl p-2"
                    >
                      {item.previewUrl ? (
                        <img
                          src={item.previewUrl}
                          alt={item.file.name}
                          className="w-10 h-10 rounded-lg object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-[#06142E] flex items-center justify-center text-[10px] font-bold text-[#FFD369] shrink-0">
                          PDF
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-white truncate">{item.file.name}</p>
                        <div className="w-full h-1.5 bg-[#06142E] rounded-full mt-1 overflow-hidden">
                          <div
                            className="h-full bg-[#35AFFF] transition-all"
                            style={{ width: `${item.progress}%` }}
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleReplacePhoto(item.id)}
                        aria-label={`Replace ${item.file.name}`}
                        className="p-1.5 text-slate-300 hover:text-[#FFD369] cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(item.id)}
                        aria-label={`Remove ${item.file.name}`}
                        className="p-1.5 text-slate-300 hover:text-rose-400 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-2 bg-[#06142E]/70 border border-[#35AFFF]/25 rounded-2xl p-3.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs sm:text-sm font-semibold text-white">
                  Upload Logo (Optional)
                </span>
                <span className="text-[11px] text-slate-400">PNG/JPG/PDF</span>
              </div>

              <input
                ref={logoInputRef}
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => {
                  handleSelectLogo(e.target.files);
                  e.target.value = '';
                }}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                className="gd-glow-btn-blue w-full min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <Upload className="w-4 h-4 text-[#FFD369]" aria-hidden="true" />
                {logoFile ? 'Replace Logo' : 'Upload Logo'}
              </button>

              {logoFile && (
                <div className="flex items-center gap-2.5 bg-[#10264B] border border-[#35AFFF]/25 rounded-xl p-2 mt-1">
                  {logoFile.previewUrl ? (
                    <img
                      src={logoFile.previewUrl}
                      alt={logoFile.file.name}
                      className="w-10 h-10 rounded-lg object-contain bg-white/10 shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-[#06142E] flex items-center justify-center text-[10px] font-bold text-[#FFD369] shrink-0">
                      FILE
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white truncate">{logoFile.file.name}</p>
                    <div className="w-full h-1.5 bg-[#06142E] rounded-full mt-1 overflow-hidden">
                      <div
                        className="h-full bg-[#FFD369] transition-all"
                        style={{ width: `${logoProgress}%` }}
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (logoFile.previewUrl) URL.revokeObjectURL(logoFile.previewUrl);
                      setLogoFile(null);
                      setLogoProgress(0);
                    }}
                    aria-label="Remove logo"
                    className="p-1.5 text-slate-300 hover:text-rose-400 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {fileError && (
            <p role="alert" className="text-xs text-amber-300">
              {fileError}
            </p>
          )}

          <div className="space-y-1.5">
            <label htmlFor="order-instructions" className="block text-xs sm:text-sm font-semibold text-white">
              Special Instructions
            </label>
            <input
              id="order-instructions"
              type="text"
              value={specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)}
              placeholder="Urgent timeline, print bleed, or file format preferences..."
              className="w-full h-11 px-3.5 rounded-2xl bg-[#06142E] border border-[#35AFFF]/35 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:border-[#35AFFF]"
            />
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-[#35AFFF]/20">
            <p className="text-xs text-slate-300">
              Payable on next step:{' '}
              <strong className="font-mono-tabular text-[#FFD369] text-sm">
                {formatPriceINR(pricing.finalPayable)}
              </strong>
            </p>
            <button
              type="submit"
              className="gd-glow-btn-gold w-full sm:w-auto min-h-[48px] px-7 py-3 rounded-2xl font-extrabold text-sm inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Continue to Payment</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </form>
      )}

      {/* STEP 2: PAYMENT SCREEN */}
      {step === 'payment' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Summary Column (Editable before payment) */}
          <div className="lg:col-span-5 gd-card rounded-3xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between gap-2 border-b border-[#35AFFF]/20 pb-3">
              <h2 className="font-display font-bold text-lg text-white">Order Summary</h2>
              <button
                type="button"
                onClick={onBackToOrderForm}
                className="gd-glow-btn-blue px-3 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5 text-[#FFD369]" aria-hidden="true" />
                Edit Details
              </button>
            </div>

            <div className="space-y-2.5 text-xs sm:text-sm">
              <div className="flex justify-between gap-2">
                <span className="text-slate-400">Customer</span>
                <span className="font-semibold text-white text-right">{customerName}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-400">WhatsApp</span>
                <span className="font-mono-tabular text-white">{mobile}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-400">Selected Service</span>
                <span className="font-semibold text-white text-right">{activeService?.name}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-400">Size / Language</span>
                <span className="text-slate-200 text-right">
                  {effectiveDesignSize} · {language}
                </span>
              </div>
            </div>

            {/* Price Breakdown Card */}
            <div className="rounded-2xl bg-[#06142E] border border-[#35AFFF]/30 p-4 space-y-2.5 text-sm">
              <div className="flex items-center justify-between text-slate-300">
                <span>Service Price</span>
                <span className="font-mono-tabular font-semibold text-white">
                  {formatPriceINR(pricing.totalPrice)}
                </span>
              </div>

              <div className="flex items-center justify-between text-emerald-300">
                <span>
                  Discount
                  {settings.discountLabel ? ` (${settings.discountLabel})` : ''}
                </span>
                <span className="font-mono-tabular font-semibold">
                  {pricing.discountAmount > 0
                    ? `-${formatPriceINR(pricing.discountAmount)}`
                    : '₹0'}
                </span>
              </div>

              <div className="border-t border-[#35AFFF]/20 pt-2.5 flex items-center justify-between">
                <span className="font-bold text-white">Final Amount</span>
                <span className="font-mono-tabular text-2xl font-extrabold text-[#FFD369]">
                  {formatPriceINR(pricing.finalPayable)}
                </span>
              </div>
            </div>
          </div>

          {/* Right Payment Methods Column */}
          <div className="lg:col-span-7 gd-card rounded-3xl p-5 sm:p-6 space-y-5">
            <div className="flex items-center gap-2.5 border-b border-[#35AFFF]/20 pb-3">
              <CreditCard className="w-5 h-5 text-[#FFD369]" aria-hidden="true" />
              <h2 className="font-display font-bold text-lg sm:text-xl text-white">
                Choose Payment Method
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {availablePaymentMethods.map((option) => {
                const active = paymentMethod === option;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      setPaymentMethod(option);
                      setSubmitError(null);
                    }}
                    className={`min-h-[46px] px-3 py-2 rounded-2xl text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#FFD369] text-[#06142E] font-bold'
                        : 'bg-[#06142E] text-slate-200 border border-[#35AFFF]/35 hover:border-[#35AFFF]'
                    }`}
                  >
                    {option === 'Razorpay' ? (
                      <ShieldCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
                    ) : option === 'Scan & Pay QR' ? (
                      <QrCode className="w-4 h-4 shrink-0" aria-hidden="true" />
                    ) : (
                      <Smartphone className="w-4 h-4 shrink-0" aria-hidden="true" />
                    )}
                    <span>{option}</span>
                  </button>
                );
              })}
            </div>

            {/* OPTION 1: REAL RAZORPAY CHECKOUT */}
            {paymentMethod === 'Razorpay' && (
              <div className="rounded-2xl bg-[#06142E] border border-[#35AFFF]/35 p-5 space-y-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-display font-bold text-base sm:text-lg text-[#FFD369]">
                      Instant Razorpay Online Payment
                    </h3>
                    <span className="text-[11px] font-semibold text-emerald-300">
                      UPI · Cards · NetBanking
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    Pay <strong className="text-white">{formatPriceINR(pricing.finalPayable)}</strong> securely via Razorpay. Your payment is verified server-side and your order starts immediately.
                  </p>
                </div>

                {razorpayServerReady === false && (
                  <div className="rounded-xl bg-amber-500/10 border border-amber-400/35 p-3 text-xs text-amber-200 flex items-start gap-2">
                    <ShieldAlert className="w-4 h-4 text-[#FFD369] shrink-0 mt-0.5" aria-hidden="true" />
                    <span>
                      Razorpay gateway keys are not active on this server yet. Please switch to{' '}
                      <strong className="text-white">Scan &amp; Pay QR</strong> or{' '}
                      <strong className="text-white">UPI Payment</strong> to complete your order right now.
                    </span>
                  </div>
                )}

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleRazorpayPayNow}
                  data-testid="razorpay-pay-now-btn"
                  className="gd-glow-btn-gold w-full min-h-[52px] px-6 py-3 rounded-2xl font-extrabold text-base inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                      <span>Verifying Razorpay Payment...</span>
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-5 h-5" aria-hidden="true" />
                      <span>PAY NOW — {formatPriceINR(pricing.finalPayable)}</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* OPTION 2 & 3: SCAN & PAY QR / UPI PAYMENT */}
            {paymentMethod !== 'Razorpay' && (
              <form onSubmit={handleManualPaymentSubmit} className="space-y-4" noValidate>
                <div className="rounded-2xl bg-[#06142E]/85 border border-[#35AFFF]/30 p-4 space-y-3">
                  {settings.upiId && (
                    <div className="flex items-center justify-between gap-2 bg-[#10264B] border border-[#35AFFF]/30 rounded-xl px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-[11px] text-slate-400">Official Studio UPI ID</p>
                        <p className="font-mono-tabular text-sm font-bold text-[#FFD369] truncate">
                          {settings.upiId}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleCopyUpi}
                        className="min-h-[36px] px-3 py-1.5 rounded-lg bg-[#06142E] border border-[#35AFFF]/40 text-xs font-semibold text-[#35AFFF] hover:text-white inline-flex items-center gap-1 shrink-0 cursor-pointer"
                      >
                        {copiedUpi ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-300" aria-hidden="true" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                            Copy UPI
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {paymentMethod === 'Scan & Pay QR' && (
                    <div className="flex flex-col items-center text-center gap-2.5 pt-1">
                      <div className="w-48 h-48 rounded-2xl bg-white p-1.5 border border-[#35AFFF]/45 shadow-[0_0_20px_rgba(53,175,255,0.2)] flex items-center justify-center overflow-hidden">
                        <img
                          src={resolveAssetUrl(
                            settings.paymentQrUrl?.trim() ||
                              '/assets/aistudio/IMG_20261124_164417_229847fc.jpg'
                          )}
                          alt="Official Studio Payment QR Code"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-contain rounded-xl"
                        />
                      </div>
                      <p className="text-xs text-slate-300">
                        Scan QR using GPay, PhonePe, Paytm, or any UPI app.
                      </p>
                    </div>
                  )}

                  {paymentMethod === 'UPI Payment' && (
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Send{' '}
                      <strong className="text-[#FFD369]">{formatPriceINR(pricing.finalPayable)}</strong>{' '}
                      to{' '}
                      <strong className="font-mono-tabular text-white">
                        {settings.upiId || 'gurudevdesigns@upi'}
                      </strong>{' '}
                      via your preferred UPI app, then enter the 12-digit UTR / Reference number below.
                    </p>
                  )}
                </div>

                {/* Payment Reference / UTR Number */}
                <div className="space-y-1.5">
                  <label htmlFor="payment-reference" className="block text-xs sm:text-sm font-semibold text-white">
                    Payment Reference / UTR Number <span className="text-[#FFD369]">*</span>
                  </label>
                  <input
                    id="payment-reference"
                    type="text"
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    placeholder="e.g. 432910884712 or UPI Transaction ID"
                    className="w-full h-11 px-3.5 rounded-2xl bg-[#06142E] border border-[#35AFFF]/35 text-sm font-mono-tabular text-white placeholder:text-slate-400 focus:outline-none focus:border-[#35AFFF]"
                  />
                  {errors.paymentReference && (
                    <p className="text-xs text-rose-300">{errors.paymentReference}</p>
                  )}
                </div>

                {/* Upload Payment Screenshot */}
                <div className="space-y-2 bg-[#06142E]/70 border border-[#35AFFF]/25 rounded-2xl p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs sm:text-sm font-semibold text-white">
                      Upload Payment Screenshot
                    </span>
                    <span className="text-[11px] text-slate-400">Image / PDF</span>
                  </div>

                  <input
                    ref={paymentShotInputRef}
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => {
                      handleSelectPaymentScreenshot(e.target.files);
                      e.target.value = '';
                    }}
                    className="hidden"
                  />

                  <button
                    type="button"
                    onClick={() => paymentShotInputRef.current?.click()}
                    className="gd-glow-btn-blue w-full min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Upload className="w-4 h-4 text-[#FFD369]" aria-hidden="true" />
                    {paymentScreenshot ? 'Replace Payment Screenshot' : 'Upload Payment Screenshot'}
                  </button>

                  {paymentScreenshot && (
                    <div className="flex items-center gap-2.5 bg-[#10264B] border border-[#35AFFF]/25 rounded-xl p-2 mt-1">
                      {paymentScreenshot.previewUrl ? (
                        <img
                          src={paymentScreenshot.previewUrl}
                          alt={paymentScreenshot.file.name}
                          className="w-10 h-10 rounded-lg object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-[#06142E] flex items-center justify-center text-[10px] font-bold text-[#FFD369] shrink-0">
                          PDF
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-white truncate">{paymentScreenshot.file.name}</p>
                        <div className="w-full h-1.5 bg-[#06142E] rounded-full mt-1 overflow-hidden">
                          <div
                            className="h-full bg-emerald-400 transition-all"
                            style={{ width: `${paymentShotProgress}%` }}
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (paymentScreenshot.previewUrl) {
                            URL.revokeObjectURL(paymentScreenshot.previewUrl);
                          }
                          setPaymentScreenshot(null);
                          setPaymentShotProgress(0);
                        }}
                        aria-label="Remove payment screenshot"
                        className="p-1.5 text-slate-300 hover:text-rose-400 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Required Payment Confirmation Checkbox */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="payment-completed-checkbox"
                    className="flex items-start gap-3 p-3.5 rounded-2xl bg-[#06142E] border border-[#35AFFF]/35 cursor-pointer hover:border-[#FFD369]/60"
                  >
                    <input
                      id="payment-completed-checkbox"
                      type="checkbox"
                      checked={paymentCompletedChecked}
                      onChange={(e) => setPaymentCompletedChecked(e.target.checked)}
                      className="w-5 h-5 mt-0.5 accent-[#FFD369] shrink-0 cursor-pointer"
                    />
                    <span className="text-xs sm:text-sm font-semibold text-white leading-snug">
                      I have completed the payment.
                    </span>
                  </label>
                  {errors.paymentCompletedChecked && (
                    <p className="text-xs text-rose-300">{errors.paymentCompletedChecked}</p>
                  )}
                </div>

                {/* Explicit Pending Verification Notice */}
                <div className="rounded-2xl bg-amber-500/10 border border-amber-400/35 p-3 flex items-start gap-2.5 text-xs text-amber-200">
                  <ShieldAlert className="w-4 h-4 text-[#FFD369] shrink-0 mt-0.5" aria-hidden="true" />
                  <span>
                    Manual UPI/QR payments are saved as{' '}
                    <strong className="text-[#FFD369]">PAYMENT VERIFICATION PENDING</strong> until
                    verified by our studio team.
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="gd-glow-btn-gold w-full min-h-[50px] px-6 py-3 rounded-2xl font-extrabold text-sm sm:text-base inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                      <span>Submitting Order...</span>
                    </>
                  ) : (
                    <span>Submit Order &amp; Verify Payment</span>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
