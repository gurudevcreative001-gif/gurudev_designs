import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { BOOTSTRAPPED_ADMIN_EMAIL, db, storage } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrors';
import {
  DEFAULT_CATEGORIES,
  DEFAULT_MENU_VISIBILITY,
  DEFAULT_SITE_SETTINGS,
  SEED_GALLERY,
  SEED_SERVICES,
} from '../data/seedCatalog';
import type {
  DesignLanguage,
  GalleryItem,
  OrderRecord,
  OrderStatus,
  OrderTrackingRecord,
  PaymentMethodOption,
  PaymentVerificationStatus,
  PhoneOrderIndex,
  ServiceCategoryConfig,
  ServiceItem,
  SiteSettings,
} from '../types/design';
import { normalizeMenuVisibility } from '../utils/menuConfig';
import {
  computePhoneKey,
  computeTrackingKey,
  generateOrderId,
  getDeliveryStatusText,
} from '../utils/orderUtils';

const ORDER_DOC_ID_SAFE = () =>
  `ord_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

function timestampToMs(ts: unknown): number {
  if (!ts) return Date.now();
  if (typeof ts === 'object' && ts !== null && 'toMillis' in ts) {
    return (ts as { toMillis: () => number }).toMillis();
  }
  if (typeof ts === 'object' && ts !== null && 'toDate' in ts) {
    return (ts as { toDate: () => Date }).toDate().getTime();
  }
  const parsed = Date.parse(String(ts));
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function normalizeCategories(raw: unknown): ServiceCategoryConfig[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return DEFAULT_CATEGORIES;
  }
  return raw
    .filter((item): item is Partial<ServiceCategoryConfig> => typeof item === 'object' && item !== null)
    .slice(0, 20)
    .map((item, idx) => ({
      id: String(item.id || `cat-${idx + 1}`).slice(0, 80),
      name: String(item.name || `Category ${idx + 1}`).trim().slice(0, 80),
      description: String(item.description || '').trim().slice(0, 300),
      imageUrl: String(item.imageUrl || '').trim().slice(0, 1000),
      enabled: typeof item.enabled === 'boolean' ? item.enabled : true,
      displayOrder:
        typeof item.displayOrder === 'number' && Number.isFinite(item.displayOrder)
          ? Math.max(0, Math.min(100, Math.round(item.displayOrder)))
          : idx + 1,
    }))
    .sort((a, b) => a.displayOrder - b.displayOrder);
}

export function subscribeServices(
  onData: (services: ServiceItem[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'services';
  const q = query(collection(db, path), orderBy('displayOrder', 'asc'));
  return onSnapshot(
    q,
    (snap) => {
      if (snap.empty) {
        onData(SEED_SERVICES);
        return;
      }
      const list = snap.docs.map((d) => d.data() as ServiceItem);
      onData(list);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeGallery(
  onData: (items: GalleryItem[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'gallery';
  const q = query(collection(db, path), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      if (snap.empty) {
        onData(SEED_GALLERY);
        return;
      }
      onData(snap.docs.map((d) => d.data() as GalleryItem));
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeSiteSettings(
  onData: (settings: SiteSettings) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'settings/site';
  return onSnapshot(
    doc(db, 'settings', 'site'),
    (snap) => {
      if (!snap.exists()) {
        onData(DEFAULT_SITE_SETTINGS);
        return;
      }
      const raw = snap.data() as Partial<SiteSettings>;
      onData({
        ...DEFAULT_SITE_SETTINGS,
        ...raw,
        whatsappNumber:
          !raw.whatsappNumber || raw.whatsappNumber === '919876543210'
            ? DEFAULT_SITE_SETTINGS.whatsappNumber
            : raw.whatsappNumber,
        contactPhone:
          !raw.contactPhone || raw.contactPhone === '+91 98765 43210'
            ? DEFAULT_SITE_SETTINGS.contactPhone
            : raw.contactPhone,
        paymentQrUrl:
          raw.paymentQrUrl && raw.paymentQrUrl.trim()
            ? raw.paymentQrUrl
            : DEFAULT_SITE_SETTINGS.paymentQrUrl,
        razorpayEnabled:
          typeof raw.razorpayEnabled === 'boolean'
            ? raw.razorpayEnabled
            : DEFAULT_SITE_SETTINGS.razorpayEnabled,
        razorpayKeyId: typeof raw.razorpayKeyId === 'string' ? raw.razorpayKeyId : '',
        razorpayMerchantName:
          typeof raw.razorpayMerchantName === 'string' && raw.razorpayMerchantName.trim()
            ? raw.razorpayMerchantName
            : DEFAULT_SITE_SETTINGS.razorpayMerchantName,
        discountPercent: Number(raw.discountPercent) || 0,
        discountFlat: Number(raw.discountFlat) || 0,
        discountLabel: typeof raw.discountLabel === 'string' ? raw.discountLabel : '',
        categories: normalizeCategories(raw.categories),
        menuVisibility: normalizeMenuVisibility(raw.menuVisibility, DEFAULT_MENU_VISIBILITY),
      });
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

export function subscribeAllOrders(
  onData: (orders: OrderRecord[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'orders';
  const q = query(collection(db, path), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => {
          const raw = d.data() as OrderRecord;
          return {
            ...raw,
            docId: d.id,
            paymentStatus: raw.paymentStatus || 'PAYMENT VERIFICATION PENDING',
            paymentMethod: raw.paymentMethod || 'Scan & Pay QR',
            paymentReference: raw.paymentReference || '',
            paymentScreenshotUrl: raw.paymentScreenshotUrl || '',
            razorpayOrderId: raw.razorpayOrderId || '',
            razorpayPaymentId: raw.razorpayPaymentId || '',
            razorpaySignature: raw.razorpaySignature || '',
          };
        })
        .sort((a, b) => timestampToMs(b.createdAt) - timestampToMs(a.createdAt));
      onData(list);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function checkIsAdmin(uid: string, email: string | null): Promise<boolean> {
  if (email && email.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase()) {
    return true;
  }
  const path = `admins/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'admins', uid));
    return snap.exists();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export function uploadFileWithProgress(
  file: File,
  storagePath: string,
  onProgress: (percent: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const storageRef = ref(storage, storagePath);
    const task = uploadBytesResumable(storageRef, file, {
      contentType: file.type || 'application/octet-stream',
    });

    task.on(
      'state_changed',
      (snapshot) => {
        const pct =
          snapshot.totalBytes > 0
            ? Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)
            : 0;
        onProgress(pct);
      },
      (error) => {
        reject(error);
      },
      async () => {
        try {
          const url = await getDownloadURL(task.snapshot.ref);
          onProgress(100);
          resolve(url);
        } catch {
          // When customer uploads are protected by Admin-only read rules, persist the storage path
          // so signed-in Admin sessions resolve the signed download URL securely.
          onProgress(100);
          resolve(`storage://${task.snapshot.ref.fullPath}`);
        }
      }
    );
  });
}

export async function resolveStorageUrl(urlOrPath: string): Promise<string> {
  if (!urlOrPath) return '';
  if (!urlOrPath.startsWith('storage://')) return urlOrPath;
  const fullPath = urlOrPath.slice('storage://'.length);
  return getDownloadURL(ref(storage, fullPath));
}

export interface CreateOrderPayload {
  orderId?: string;
  customerName: string;
  mobile: string;
  serviceId: string;
  serviceName: string;
  servicePrice: number;
  discountAmount: number;
  finalAmount: number;
  designSize: string;
  language: DesignLanguage;
  designText: string;
  requirements: string;
  specialInstructions: string;
  referencePhotos: string[];
  logoUrl: string;
  paymentMethod: PaymentMethodOption;
  paymentReference: string;
  paymentScreenshotUrl: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
}

export async function submitCustomerOrder(
  payload: CreateOrderPayload
): Promise<{
  orderDocId: string;
  orderId: string;
  trackingKey: string;
  phoneKey: string;
  paymentStatus: PaymentVerificationStatus;
  orderStatus: OrderStatus;
}> {
  const orderId = (payload.orderId || generateOrderId()).trim().toUpperCase().slice(0, 32);
  const trackingKey = await computeTrackingKey(orderId, payload.mobile);
  const phoneKey = await computePhoneKey(payload.mobile);
  const orderDocId = ORDER_DOC_ID_SAFE();

  const isVerifiedRazorpay =
    payload.paymentMethod === 'Razorpay' &&
    Boolean(payload.razorpayOrderId?.trim()) &&
    Boolean(payload.razorpayPaymentId?.trim()) &&
    Boolean(payload.razorpaySignature?.trim());

  const initialStatus: OrderStatus = isVerifiedRazorpay
    ? 'PAYMENT RECEIVED'
    : 'PAYMENT VERIFICATION PENDING';
  const initialPaymentStatus: PaymentVerificationStatus = isVerifiedRazorpay
    ? 'PAYMENT VERIFIED'
    : 'PAYMENT VERIFICATION PENDING';

  const servicePrice = Math.max(0, Math.min(1000000, Math.round(Number(payload.servicePrice) || 0)));
  const discountAmount = Math.max(
    0,
    Math.min(1000000, Math.round(Number(payload.discountAmount) || 0))
  );
  const finalAmount = Math.max(0, Math.min(1000000, Math.round(Number(payload.finalAmount) || 0)));

  const orderData: Record<string, unknown> = {
    orderId,
    trackingKey,
    phoneKey,
    customerName: payload.customerName.trim().slice(0, 100),
    mobile: payload.mobile.trim().slice(0, 20),
    serviceId: payload.serviceId.trim().slice(0, 128),
    serviceName: payload.serviceName.trim().slice(0, 120),
    servicePrice,
    discountAmount,
    finalAmount,
    designSize: payload.designSize.trim().slice(0, 100),
    language: payload.language,
    designText: payload.designText.trim().slice(0, 2000),
    requirements: payload.requirements.trim().slice(0, 3000),
    specialInstructions: payload.specialInstructions.trim().slice(0, 1500),
    referencePhotos: payload.referencePhotos.slice(0, 10).map((u) => u.slice(0, 1000)),
    logoUrl: payload.logoUrl.trim().slice(0, 1000),
    paymentMethod: payload.paymentMethod,
    paymentReference: (isVerifiedRazorpay
      ? payload.razorpayPaymentId || ''
      : payload.paymentReference
    )
      .trim()
      .slice(0, 80),
    paymentScreenshotUrl: payload.paymentScreenshotUrl.trim().slice(0, 1000),
    paymentStatus: initialPaymentStatus,
    status: initialStatus,
    adminNotes: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (isVerifiedRazorpay) {
    orderData.razorpayOrderId = payload.razorpayOrderId!.trim().slice(0, 80);
    orderData.razorpayPaymentId = payload.razorpayPaymentId!.trim().slice(0, 80);
    orderData.razorpaySignature = payload.razorpaySignature!.trim().slice(0, 128);
  }

  // Strictly sanitized public tracking doc — zero PII, zero files, zero UTR/Razorpay secrets
  const trackingData = {
    orderId,
    phoneKey,
    customerName: orderData.customerName,
    serviceName: orderData.serviceName,
    servicePrice,
    discountAmount,
    finalAmount,
    paymentStatus: initialPaymentStatus,
    status: initialStatus,
    deliveryStatus: getDeliveryStatusText(initialStatus),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    const phoneIndexRef = doc(db, 'phone_indexes', phoneKey);
    const existingPhoneSnap = await getDoc(phoneIndexRef);
    const existingKeys = existingPhoneSnap.exists()
      ? ((existingPhoneSnap.data() as PhoneOrderIndex).trackingKeys || [])
      : [];
    const nextTrackingKeys = existingKeys.includes(trackingKey)
      ? existingKeys.slice(0, 50)
      : [...existingKeys.slice(-49), trackingKey];

    const batch = writeBatch(db);
    batch.set(doc(db, 'orders', orderDocId), orderData);
    batch.set(doc(db, 'order_tracking', trackingKey), trackingData);
    if (existingPhoneSnap.exists()) {
      batch.update(phoneIndexRef, {
        phoneKey,
        trackingKeys: nextTrackingKeys,
        updatedAt: serverTimestamp(),
      });
    } else {
      batch.set(phoneIndexRef, {
        phoneKey,
        trackingKeys: [trackingKey],
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
    return {
      orderDocId,
      orderId,
      trackingKey,
      phoneKey,
      paymentStatus: initialPaymentStatus,
      orderStatus: initialStatus,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `orders/${orderDocId}`);
  }
}

export async function trackCustomerOrder(
  orderId: string,
  mobile: string
): Promise<OrderTrackingRecord | null> {
  const trackingKey = await computeTrackingKey(orderId, mobile);
  const path = `order_tracking/${trackingKey}`;
  try {
    const snap = await getDoc(doc(db, 'order_tracking', trackingKey));
    if (!snap.exists()) return null;
    const raw = snap.data() as OrderTrackingRecord;
    return {
      orderId: raw.orderId,
      phoneKey: raw.phoneKey,
      customerName: raw.customerName,
      serviceName: raw.serviceName,
      servicePrice: raw.servicePrice,
      discountAmount: raw.discountAmount,
      finalAmount: raw.finalAmount,
      paymentStatus: raw.paymentStatus || 'PAYMENT VERIFICATION PENDING',
      status: raw.status,
      deliveryStatus: raw.deliveryStatus,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

/**
 * Real-time listener for all sanitized orders matching a hashed WhatsApp mobile index.
 * Automatically updates live whenever Admin changes order or payment status.
 */
export function subscribeOrdersByPhoneKey(
  phoneKey: string,
  onData: (orders: OrderTrackingRecord[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const indexRef = doc(db, 'phone_indexes', phoneKey);
  const trackingListeners = new Map<string, Unsubscribe>();
  const recordMap = new Map<string, OrderTrackingRecord>();
  const pendingInitialKeys = new Set<string>();
  let hasCompletedInitialHydration = false;

  const emitSorted = () => {
    const sorted = Array.from(recordMap.values()).sort(
      (a, b) => timestampToMs(b.createdAt) - timestampToMs(a.createdAt)
    );
    onData(sorted);
  };

  const unsubIndex = onSnapshot(
    indexRef,
    (indexSnap) => {
      if (!indexSnap.exists()) {
        for (const unsub of trackingListeners.values()) unsub();
        trackingListeners.clear();
        recordMap.clear();
        pendingInitialKeys.clear();
        hasCompletedInitialHydration = true;
        onData([]);
        return;
      }

      const data = indexSnap.data() as Partial<PhoneOrderIndex>;
      const keys = Array.isArray(data.trackingKeys)
        ? data.trackingKeys.filter((k): k is string => typeof k === 'string' && /^[a-f0-9]{64}$/.test(k))
        : [];

      const activeKeySet = new Set(keys);
      let removedAny = false;

      for (const [oldKey, unsub] of trackingListeners.entries()) {
        if (!activeKeySet.has(oldKey)) {
          unsub();
          trackingListeners.delete(oldKey);
          recordMap.delete(oldKey);
          pendingInitialKeys.delete(oldKey);
          removedAny = true;
        }
      }

      if (keys.length === 0) {
        hasCompletedInitialHydration = true;
        onData([]);
        return;
      }

      for (const tk of keys) {
        if (trackingListeners.has(tk)) continue;
        if (!hasCompletedInitialHydration) {
          pendingInitialKeys.add(tk);
        }
        const unsubTrack = onSnapshot(
          doc(db, 'order_tracking', tk),
          (trackSnap) => {
            if (!trackSnap.exists()) {
              recordMap.delete(tk);
            } else {
              const raw = trackSnap.data() as OrderTrackingRecord;
              recordMap.set(tk, {
                orderId: raw.orderId,
                phoneKey: raw.phoneKey,
                customerName: raw.customerName,
                serviceName: raw.serviceName,
                servicePrice: raw.servicePrice,
                discountAmount: raw.discountAmount,
                finalAmount: raw.finalAmount,
                paymentStatus: raw.paymentStatus || 'PAYMENT VERIFICATION PENDING',
                status: raw.status,
                deliveryStatus: raw.deliveryStatus,
                createdAt: raw.createdAt,
                updatedAt: raw.updatedAt,
              });
            }
            pendingInitialKeys.delete(tk);
            if (!hasCompletedInitialHydration) {
              if (pendingInitialKeys.size === 0) {
                hasCompletedInitialHydration = true;
                emitSorted();
              }
            } else {
              emitSorted();
            }
          },
          (err) => {
            pendingInitialKeys.delete(tk);
            if (!hasCompletedInitialHydration && pendingInitialKeys.size === 0) {
              hasCompletedInitialHydration = true;
              emitSorted();
            }
            if (onError) onError(err);
          }
        );
        trackingListeners.set(tk, unsubTrack);
      }
      if (hasCompletedInitialHydration && removedAny) {
        emitSorted();
      }
    },
    (err) => {
      if (onError) onError(err);
    }
  );

  return () => {
    unsubIndex();
    for (const unsub of trackingListeners.values()) unsub();
    trackingListeners.clear();
    recordMap.clear();
    pendingInitialKeys.clear();
  };
}

/**
 * Admin-only backfill ensuring any older orders created before phone_indexes exist
 * are indexed so customers can retrieve them by WhatsApp number.
 */
export async function syncPhoneIndexesForAdmin(orders: OrderRecord[]): Promise<void> {
  const grouped = new Map<string, string[]>();
  for (const order of orders) {
    if (!order.mobile || !order.trackingKey) continue;
    const pk = await computePhoneKey(order.mobile);
    const list = grouped.get(pk) || [];
    if (!list.includes(order.trackingKey)) {
      list.push(order.trackingKey);
    }
    grouped.set(pk, list);
  }

  for (const [pk, trackingKeys] of grouped.entries()) {
    try {
      const refDoc = doc(db, 'phone_indexes', pk);
      const snap = await getDoc(refDoc);
      const existing = snap.exists()
        ? ((snap.data() as PhoneOrderIndex).trackingKeys || [])
        : [];
      const merged = Array.from(new Set([...existing, ...trackingKeys])).slice(0, 100);
      if (!snap.exists() || merged.length !== existing.length) {
        await setDoc(refDoc, {
          phoneKey: pk,
          trackingKeys: merged,
          updatedAt: serverTimestamp(),
        });
      }
    } catch {
      // Non-blocking background backfill
    }
  }
}

export async function updateOrderStatusAndNotes(
  orderDocId: string,
  trackingKey: string,
  status: OrderStatus,
  adminNotes: string,
  paymentStatus?: PaymentVerificationStatus
): Promise<void> {
  const path = `orders/${orderDocId}`;
  try {
    const batch = writeBatch(db);
    const orderPatch: Record<string, unknown> = {
      status,
      adminNotes: adminNotes.slice(0, 2000),
      updatedAt: serverTimestamp(),
    };
    const trackingPatch: Record<string, unknown> = {
      status,
      deliveryStatus: getDeliveryStatusText(status),
      updatedAt: serverTimestamp(),
    };
    if (paymentStatus) {
      orderPatch.paymentStatus = paymentStatus;
      trackingPatch.paymentStatus = paymentStatus;
    }

    batch.update(doc(db, 'orders', orderDocId), orderPatch);
    batch.set(doc(db, 'order_tracking', trackingKey), trackingPatch, { merge: true });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteOrderRecord(
  orderDocId: string,
  trackingKey: string,
  mobile?: string
): Promise<void> {
  const path = `orders/${orderDocId}`;
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'orders', orderDocId));
    batch.delete(doc(db, 'order_tracking', trackingKey));
    if (mobile) {
      const pk = await computePhoneKey(mobile);
      const indexRef = doc(db, 'phone_indexes', pk);
      const snap = await getDoc(indexRef);
      if (snap.exists()) {
        const existingKeys = ((snap.data() as PhoneOrderIndex).trackingKeys || []).filter(
          (k) => k !== trackingKey
        );
        batch.set(indexRef, {
          phoneKey: pk,
          trackingKeys: existingKeys,
          updatedAt: serverTimestamp(),
        });
      }
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function upsertService(service: ServiceItem): Promise<void> {
  const cleanId = service.id.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128);
  const path = `services/${cleanId}`;
  try {
    await setDoc(doc(db, 'services', cleanId), {
      id: cleanId,
      name: service.name.trim().slice(0, 120),
      category: service.category,
      price: Math.max(0, Math.min(1000000, Number(service.price) || 0)),
      description: service.description.trim().slice(0, 500),
      imageUrl: service.imageUrl.trim().slice(0, 1000),
      enabled: Boolean(service.enabled),
      displayOrder: Math.max(0, Math.min(10000, Number(service.displayOrder) || 0)),
      turnaround: (service.turnaround || '24 hrs').trim().slice(0, 60),
      deliverables: (service.deliverables || []).slice(0, 8).map((d) => d.slice(0, 120)),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteServiceItem(serviceId: string): Promise<void> {
  const path = `services/${serviceId}`;
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'services', serviceId));
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function batchUpdateServicePrices(
  updates: Array<{ service: ServiceItem; newPrice: number }>
): Promise<void> {
  const path = 'services';
  try {
    const batch = writeBatch(db);
    for (const { service, newPrice } of updates) {
      batch.update(doc(db, 'services', service.id), {
        price: Math.max(0, Math.min(1000000, Number(newPrice) || 0)),
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function reorderServices(orderedServices: ServiceItem[]): Promise<void> {
  const path = 'services';
  try {
    const batch = writeBatch(db);
    orderedServices.forEach((svc, idx) => {
      const nextOrder = idx + 1;
      if (svc.displayOrder !== nextOrder) {
        batch.update(doc(db, 'services', svc.id), {
          displayOrder: nextOrder,
          updatedAt: serverTimestamp(),
        });
      }
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function addGalleryItem(item: Omit<GalleryItem, 'createdAt'>): Promise<void> {
  const cleanId = item.id.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128);
  const path = `gallery/${cleanId}`;
  try {
    await setDoc(doc(db, 'gallery', cleanId), {
      id: cleanId,
      title: item.title.trim().slice(0, 120),
      category: item.category,
      imageUrl: item.imageUrl.trim().slice(0, 1000),
      description: item.description.trim().slice(0, 400),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteGalleryItem(itemId: string): Promise<void> {
  const path = `gallery/${itemId}`;
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'gallery', itemId));
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function updateSiteSettings(settings: SiteSettings): Promise<void> {
  const path = 'settings/site';
  try {
    await setDoc(doc(db, 'settings', 'site'), {
      brandName: settings.brandName.trim().slice(0, 80),
      logoUrl: settings.logoUrl.trim().slice(0, 1000),
      whatsappNumber: settings.whatsappNumber.trim().slice(0, 20),
      instagramUrl: settings.instagramUrl.trim().slice(0, 300),
      contactEmail: settings.contactEmail.trim().slice(0, 120),
      contactPhone: settings.contactPhone.trim().slice(0, 100),
      contactAddress: settings.contactAddress.trim().slice(0, 250),
      websiteDescription: settings.websiteDescription.trim().slice(0, 600),
      paymentQrUrl: settings.paymentQrUrl.trim().slice(0, 1000),
      upiId: settings.upiId.trim().slice(0, 100),
      razorpayEnabled: Boolean(settings.razorpayEnabled ?? true),
      razorpayKeyId: (settings.razorpayKeyId || '').trim().slice(0, 100),
      razorpayMerchantName: (settings.razorpayMerchantName || settings.brandName || 'gurudev_designs')
        .trim()
        .slice(0, 100),
      discountPercent: Math.max(0, Math.min(90, Number(settings.discountPercent) || 0)),
      discountFlat: Math.max(0, Math.min(100000, Math.round(Number(settings.discountFlat) || 0))),
      discountLabel: (settings.discountLabel || '').trim().slice(0, 80),
      bannerTitle: settings.bannerTitle.trim().slice(0, 120),
      bannerSubtitle: settings.bannerSubtitle.trim().slice(0, 200),
      bannerImageUrl: settings.bannerImageUrl.trim().slice(0, 1000),
      categories: normalizeCategories(settings.categories),
      menuVisibility: normalizeMenuVisibility(settings.menuVisibility, DEFAULT_MENU_VISIBILITY),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function seedDefaultsIfNeeded(force = false): Promise<void> {
  try {
    const existingServices = await getDocs(collection(db, 'services'));
    if (force || existingServices.empty) {
      const batch = writeBatch(db);
      for (const svc of SEED_SERVICES) {
        if (force || !existingServices.docs.some((d) => d.id === svc.id)) {
          batch.set(doc(db, 'services', svc.id), {
            ...svc,
            updatedAt: serverTimestamp(),
          });
        }
      }
      await batch.commit();
    }

    const existingGallery = await getDocs(collection(db, 'gallery'));
    if (force || existingGallery.empty) {
      const batch = writeBatch(db);
      for (const item of SEED_GALLERY) {
        if (force || !existingGallery.docs.some((d) => d.id === item.id)) {
          batch.set(doc(db, 'gallery', item.id), {
            ...item,
            createdAt: serverTimestamp(),
          });
        }
      }
      await batch.commit();
    }

    const existingSettings = await getDoc(doc(db, 'settings', 'site'));
    if (force || !existingSettings.exists()) {
      await setDoc(doc(db, 'settings', 'site'), {
        ...DEFAULT_SITE_SETTINGS,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'seedDefaultsIfNeeded');
  }
}
