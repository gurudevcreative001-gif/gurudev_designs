export const SERVICE_CATEGORIES = [
  'SOCIAL MEDIA DESIGN',
  'BUSINESS DESIGN',
  'INVITATION CARD DESIGN',
  'SHRADDHANJALI DESIGN',
  'FESTIVAL & RELIGIOUS DESIGN',
  'SPECIAL DESIGN',
] as const;

export type DefaultServiceCategory = (typeof SERVICE_CATEGORIES)[number];
export type ServiceCategory = string;

export interface ServiceCategoryConfig {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  enabled: boolean;
  displayOrder: number;
}

export const ORDER_STATUSES = [
  'NEW ORDER',
  'PAYMENT VERIFICATION PENDING',
  'PAYMENT PENDING',
  'PAYMENT RECEIVED',
  'DESIGNING',
  'DESIGN COMPLETED',
  'DELIVERED',
  'CANCELLED',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const LIVE_ORDER_STEPS = [
  'Order Received',
  'Payment Pending',
  'Payment Verified',
  'Designing Started',
  'Design Completed',
  'Delivered',
] as const;

export type LiveOrderStep = (typeof LIVE_ORDER_STEPS)[number];

export const PAYMENT_VERIFICATION_STATUSES = [
  'PAYMENT VERIFICATION PENDING',
  'PAYMENT VERIFIED',
  'PAYMENT REJECTED',
] as const;

export type PaymentVerificationStatus = (typeof PAYMENT_VERIFICATION_STATUSES)[number];

export const PAYMENT_METHOD_OPTIONS = [
  'Razorpay',
  'Scan & Pay QR',
  'UPI Payment',
] as const;

export type PaymentMethodOption = (typeof PAYMENT_METHOD_OPTIONS)[number];

export const DESIGN_LANGUAGES = ['Gujarati', 'Hindi', 'English'] as const;

export type DesignLanguage = (typeof DESIGN_LANGUAGES)[number];

export const GALLERY_CATEGORIES = [
  'Instagram Designs',
  'Business Designs',
  'Invitation Cards',
  'Shraddhanjali Designs',
  'Festival Designs',
  'Religious Designs',
] as const;

export type GalleryCategory = (typeof GALLERY_CATEGORIES)[number];

export interface ServiceItem {
  id: string;
  name: string;
  category: ServiceCategory;
  price: number;
  description: string;
  imageUrl: string;
  enabled: boolean;
  displayOrder: number;
  turnaround: string;
  deliverables: string[];
  updatedAt?: unknown;
}

export interface OrderRecord {
  docId?: string;
  orderId: string;
  trackingKey: string;
  phoneKey?: string;
  customerName: string;
  mobile: string;
  serviceId: string;
  serviceName: string;
  servicePrice?: number;
  discountAmount?: number;
  finalAmount?: number;
  designSize: string;
  language: DesignLanguage;
  designText: string;
  requirements: string;
  specialInstructions: string;
  referencePhotos: string[];
  logoUrl: string;
  paymentMethod?: PaymentMethodOption;
  paymentReference?: string;
  paymentScreenshotUrl?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  paymentStatus?: PaymentVerificationStatus;
  status: OrderStatus;
  adminNotes: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

/**
 * Sanitized customer tracking record stored in /order_tracking/{trackingKey}.
 * Intentionally excludes raw phone numbers, private uploaded photos, logos,
 * payment screenshots, payment references/UTR, and sensitive order details.
 */
export interface OrderTrackingRecord {
  orderId: string;
  phoneKey?: string;
  customerName?: string;
  serviceName: string;
  servicePrice?: number;
  discountAmount?: number;
  finalAmount?: number;
  paymentStatus?: PaymentVerificationStatus;
  status: OrderStatus;
  deliveryStatus: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface PhoneOrderIndex {
  phoneKey: string;
  trackingKeys: string[];
  updatedAt?: unknown;
}

export interface OrderDraft {
  customerName: string;
  mobile: string;
  serviceId: string;
  serviceName: string;
  designSize: string;
  language: DesignLanguage;
  designText: string;
  requirements: string;
  specialInstructions: string;
  referencePhotos: string[];
  logoUrl: string;
}

export interface ConfirmedOrderSummary {
  orderId: string;
  customerName: string;
  mobile: string;
  serviceName: string;
  servicePrice: number;
  discountAmount: number;
  finalAmount: number;
  paymentMethod: PaymentMethodOption;
  paymentReference: string;
  paymentStatus: PaymentVerificationStatus;
  orderStatus: OrderStatus;
  orderDateLabel: string;
  whatsappUrl: string;
}

export interface GalleryItem {
  id: string;
  title: string;
  category: GalleryCategory;
  imageUrl: string;
  description: string;
  createdAt?: unknown;
}

export const MENU_ITEM_KEYS = [
  'home',
  'allServices',
  'gallery',
  'orders',
  'about',
  'contact',
  'whatsapp',
  'paymentInfo',
  'terms',
  'privacy',
  'refund',
  'admin',
  // Legacy keys retained for backward compatibility with existing Firestore site docs
  'socialMedia',
  'business',
  'invitation',
  'shraddhanjali',
  'festival',
  'special',
] as const;

export type MenuItemKey = (typeof MENU_ITEM_KEYS)[number];

export type MenuVisibility = Record<MenuItemKey, boolean>;

export interface SiteSettings {
  brandName: string;
  logoUrl: string;
  whatsappNumber: string;
  instagramUrl: string;
  contactEmail: string;
  contactPhone: string;
  contactAddress: string;
  websiteDescription: string;
  paymentQrUrl: string;
  upiId: string;
  razorpayEnabled?: boolean;
  razorpayKeyId?: string;
  razorpayMerchantName?: string;
  discountPercent: number;
  discountFlat: number;
  discountLabel: string;
  bannerTitle: string;
  bannerSubtitle: string;
  bannerImageUrl: string;
  categories?: ServiceCategoryConfig[];
  menuVisibility: MenuVisibility;
  updatedAt?: unknown;
}

export type AppView =
  | 'home'
  | 'services'
  | 'order-form'
  | 'payment'
  | 'confirm'
  | 'my-orders'
  | 'gallery'
  | 'about'
  | 'contact'
  | 'payment-info'
  | 'terms'
  | 'privacy'
  | 'refund'
  | 'admin';
