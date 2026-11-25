import {
  LIVE_ORDER_STEPS,
  type DesignLanguage,
  type LiveOrderStep,
  type OrderStatus,
  type PaymentMethodOption,
  type PaymentVerificationStatus,
  type SiteSettings,
} from '../types/design';

export interface DesignDetailsInput {
  customerName: string;
  mobile: string;
  serviceId: string;
  serviceName: string;
  designSize: string;
  language: DesignLanguage;
  designText: string;
  requirements: string;
  specialInstructions: string;
}

export interface OrderFormInput extends DesignDetailsInput {
  paymentMethod?: PaymentMethodOption;
  paymentReference?: string;
  paymentCompletedChecked?: boolean;
}

export interface OrderValidationErrors {
  customerName?: string;
  mobile?: string;
  serviceId?: string;
  designSize?: string;
  language?: string;
  requirements?: string;
  paymentReference?: string;
  paymentCompletedChecked?: string;
}

export interface PricingSummary {
  totalPrice: number;
  discountAmount: number;
  finalPayable: number;
}

export interface WhatsAppOrderPayload {
  brandName: string;
  orderId: string;
  customerName: string;
  mobile: string;
  serviceName: string;
  servicePrice?: number;
  discountAmount?: number;
  finalAmount?: number;
  paymentMethod?: PaymentMethodOption;
  paymentReference?: string;
  paymentStatus?: PaymentVerificationStatus;
  designSize: string;
  language: string;
  requirements: string;
  designText: string;
  specialInstructions: string;
}

export interface LiveOrderStepState {
  label: LiveOrderStep;
  completed: boolean;
  active: boolean;
}

export interface LiveOrderProgress {
  currentStepIndex: number;
  friendlyLabel: string;
  isCancelled: boolean;
  steps: LiveOrderStepState[];
}

/**
 * Computes total price, admin discount, and final payable amount in INR (never below 0).
 */
export function calculatePricingSummary(
  servicePrice: number,
  settings?: Pick<SiteSettings, 'discountPercent' | 'discountFlat'>
): PricingSummary {
  const safeBase = Math.max(0, Math.round(Number(servicePrice) || 0));
  const pct = Math.max(0, Math.min(90, Number(settings?.discountPercent) || 0));
  const flat = Math.max(0, Math.round(Number(settings?.discountFlat) || 0));

  const pctDiscount = pct > 0 ? Math.round((safeBase * pct) / 100) : 0;
  const rawDiscount = pctDiscount + flat;
  const discountAmount = Math.min(safeBase, rawDiscount);
  const finalPayable = Math.max(0, safeBase - discountAmount);

  return {
    totalPrice: safeBase,
    discountAmount,
    finalPayable,
  };
}

/**
 * Generates a unique, human-readable Order ID strictly matching ^[A-Z0-9\-]+$.
 */
export function generateOrderId(now = new Date(), randomSuffix?: number): string {
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const rand =
    randomSuffix !== undefined
      ? String(randomSuffix).padStart(4, '0').slice(-4)
      : String(Math.floor(1000 + Math.random() * 9000));
  return `GD-${yy}${mm}${dd}-${rand}`;
}

/**
 * Extracts the last 10 numeric digits of a mobile number for consistent matching.
 */
export function normalizeMobileLast10(mobile: string): string {
  const digits = mobile.replace(/\D/g, '');
  if (digits.length <= 10) return digits;
  return digits.slice(-10);
}

async function sha256Hex(raw: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(raw);
  const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Computes a deterministic 64-character SHA-256 hex key from Order ID and mobile number.
 */
export async function computeTrackingKey(orderId: string, mobile: string): Promise<string> {
  const normalizedOrderId = orderId.trim().toUpperCase();
  const normalizedMobile = normalizeMobileLast10(mobile);
  return sha256Hex(`${normalizedOrderId}:${normalizedMobile}`);
}

/**
 * Computes a deterministic 64-character SHA-256 hex index key from a customer's 10-digit WhatsApp mobile.
 */
export async function computePhoneKey(mobile: string): Promise<string> {
  const normalizedMobile = normalizeMobileLast10(mobile);
  return sha256Hex(`gd-phone-v1:${normalizedMobile}`);
}

/**
 * Validates Step 1 (Order Form) customer & design details before transitioning to Payment.
 */
export function validateDesignDetailsInput(input: DesignDetailsInput): OrderValidationErrors {
  const errors: OrderValidationErrors = {};
  const trimmedName = input.customerName.trim();
  const trimmedMobile = input.mobile.trim();
  const digits = trimmedMobile.replace(/\D/g, '');

  if (trimmedName.length < 2 || trimmedName.length > 100) {
    errors.customerName = 'Please enter customer full name (2–100 characters).';
  }

  if (digits.length < 10 || digits.length > 15 || !/^[0-9+\-\s()]{10,20}$/.test(trimmedMobile)) {
    errors.mobile = 'Please enter a valid 10–15 digit WhatsApp mobile number.';
  }

  if (!input.serviceId.trim() || !input.serviceName.trim()) {
    errors.serviceId = 'Please select a design service.';
  }

  if (!input.designSize.trim() || input.designSize.trim().length > 100) {
    errors.designSize = 'Please select or enter a design size.';
  }

  if (!['Gujarati', 'Hindi', 'English'].includes(input.language)) {
    errors.language = 'Please select Gujarati, Hindi, or English.';
  }

  if (!input.requirements.trim() || input.requirements.trim().length > 3000) {
    errors.requirements = 'Please describe your design requirements.';
  }

  return errors;
}

/**
 * Validates customer order & payment inputs against blueprint constraints.
 */
export function validateOrderInput(input: OrderFormInput): OrderValidationErrors {
  const errors = validateDesignDetailsInput(input);

  if (input.paymentMethod !== 'Razorpay') {
    const trimmedRef = (input.paymentReference || '').trim();
    if (trimmedRef.length < 4 || trimmedRef.length > 80) {
      errors.paymentReference =
        'Please enter a valid Payment Reference / UTR Number (at least 4 characters).';
    }

    if (input.paymentCompletedChecked !== true) {
      errors.paymentCompletedChecked =
        'Please confirm by checking "I have completed the payment."';
    }
  }

  return errors;
}

/**
 * Maps internal OrderStatus + PaymentVerificationStatus onto the 6 live progress steps.
 */
export function getLiveOrderStepsState(
  status: OrderStatus,
  paymentStatus?: PaymentVerificationStatus
): LiveOrderProgress {
  if (status === 'CANCELLED') {
    return {
      currentStepIndex: -1,
      friendlyLabel: 'Cancelled',
      isCancelled: true,
      steps: LIVE_ORDER_STEPS.map((label) => ({
        label,
        completed: false,
        active: false,
      })),
    };
  }

  let idx = 0;
  if (status === 'DELIVERED') {
    idx = 5;
  } else if (status === 'DESIGN COMPLETED') {
    idx = 4;
  } else if (status === 'DESIGNING') {
    idx = 3;
  } else if (status === 'PAYMENT RECEIVED' || paymentStatus === 'PAYMENT VERIFIED') {
    idx = 2;
  } else if (
    status === 'PAYMENT VERIFICATION PENDING' ||
    status === 'PAYMENT PENDING' ||
    paymentStatus === 'PAYMENT VERIFICATION PENDING'
  ) {
    idx = 1;
  } else {
    idx = 0;
  }

  return {
    currentStepIndex: idx,
    friendlyLabel: LIVE_ORDER_STEPS[idx],
    isCancelled: false,
    steps: LIVE_ORDER_STEPS.map((label, stepIdx) => ({
      label,
      completed: stepIdx <= idx,
      active: stepIdx === idx,
    })),
  };
}

/**
 * Formats the complete WhatsApp order summary message including order, price, payment ref/ID, and requirements.
 */
export function formatWhatsAppMessage(payload: WhatsAppOrderPayload): string {
  const textVal = payload.designText.trim() || 'Not specified';
  const instructionsVal = payload.specialInstructions.trim() || 'None';
  const basePrice = Math.max(0, Math.round(payload.servicePrice ?? 0));
  const discount = Math.max(0, Math.round(payload.discountAmount ?? 0));
  const finalAmount = Math.max(0, Math.round(payload.finalAmount ?? basePrice));
  const paymentRef = (payload.paymentReference || '').trim() || 'Not provided';
  const paymentStatus = payload.paymentStatus || 'PAYMENT VERIFICATION PENDING';
  const paymentMethod = payload.paymentMethod || 'Scan & Pay QR';
  const refLabel =
    paymentMethod === 'Razorpay' ? 'Razorpay Payment ID' : 'Payment Reference (UTR)';

  const priceLine =
    discount > 0
      ? `Price: ${formatPriceINR(finalAmount)} (MRP ${formatPriceINR(basePrice)}, Discount -${formatPriceINR(discount)})`
      : `Price: ${formatPriceINR(finalAmount)}`;

  return [
    'NEW DESIGN ORDER',
    `Brand: ${payload.brandName}`,
    `Order ID: ${payload.orderId}`,
    `Customer Name: ${payload.customerName.trim()}`,
    `Mobile Number: ${payload.mobile.trim()}`,
    `Selected Service: ${payload.serviceName}`,
    priceLine,
    `Payment Method: ${paymentMethod}`,
    `${refLabel}: ${paymentRef}`,
    `Payment Status: ${paymentStatus}`,
    `Design Size: ${payload.designSize.trim()}`,
    `Language: ${payload.language}`,
    `Customer Requirements: ${payload.requirements.trim()}`,
    `Text for Design: ${textVal}`,
    `Special Instructions: ${instructionsVal}`,
    'Please view uploaded reference photos and track status in Admin Panel.',
  ].join('\n');
}

/**
 * Builds a WhatsApp click-to-chat URL safely stripping formatting characters.
 */
export function buildWhatsAppUrl(phoneNumber: string, message: string): string {
  const digitsOnly = phoneNumber.replace(/\D/g, '');
  const withCountry = digitsOnly.length === 10 ? `91${digitsOnly}` : digitsOnly;
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(message)}`;
}

/**
 * Maps internal order statuses to customer-facing delivery status descriptions.
 */
export function getDeliveryStatusText(status: OrderStatus): string {
  switch (status) {
    case 'NEW ORDER':
      return 'Order Received — Queued for Studio Review';
    case 'PAYMENT VERIFICATION PENDING':
      return 'Payment Pending — Awaiting Payment Verification';
    case 'PAYMENT PENDING':
      return 'Payment Pending — Complete Payment to Begin';
    case 'PAYMENT RECEIVED':
      return 'Payment Verified — Queued for Designing';
    case 'DESIGNING':
      return 'Designing Started — Artwork in Progress';
    case 'DESIGN COMPLETED':
      return 'Design Completed — Ready for Final Dispatch';
    case 'DELIVERED':
      return 'Delivered — Final High-Res Files Sent';
    case 'CANCELLED':
      return 'Order Cancelled';
  }
}

export function formatPriceINR(price: number): string {
  return `₹${Math.round(price).toLocaleString('en-IN')}`;
}

export function validateFileSelection(
  file: File,
  maxBytes = 10 * 1024 * 1024
): string | null {
  const isImage = file.type.startsWith('image/');
  const isPdf = file.type === 'application/pdf';
  if (!isImage && !isPdf) {
    return `${file.name}: Only image files (JPG, PNG, WEBP) or PDF files are allowed.`;
  }
  if (file.size > maxBytes) {
    return `${file.name}: File exceeds maximum allowed size of 10 MB.`;
  }
  return null;
}
