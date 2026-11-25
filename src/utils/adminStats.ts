import type {
  OrderRecord,
  OrderStatus,
  OrderTrackingRecord,
  PaymentVerificationStatus,
  ServiceItem,
} from '../types/design';
import { getLiveOrderStepsState } from './orderUtils';

export interface AdminDashboardStats {
  totalOrders: number;
  newOrders: number;
  pendingOrders: number;
  paymentPending: number;
  paymentReceived: number;
  designing: number;
  completed: number;
  delivered: number;
  cancelled: number;
  totalServices: number;
}

export type AdminNotificationType =
  | 'NEW ORDER RECEIVED'
  | 'NEW PAYMENT RECEIVED'
  | 'PAYMENT FAILED'
  | 'ORDER CANCELLED'
  | 'NEW CUSTOMER REQUEST';

export interface AdminNotificationItem {
  id: string;
  type: AdminNotificationType;
  orderId: string;
  title: string;
  message: string;
  createdAtMs: number;
  read: boolean;
}

export type CustomerNotificationType =
  | 'Order Received'
  | 'Payment Verified'
  | 'Designing Started'
  | 'Design Completed'
  | 'Order Delivered'
  | 'Order Cancelled';

export interface CustomerNotificationItem {
  id: string;
  type: CustomerNotificationType;
  orderId: string;
  serviceName: string;
  message: string;
  createdAtMs: number;
}

export function computeAdminOrderStats(
  orders: ReadonlyArray<Pick<OrderRecord, 'status' | 'paymentStatus'>>,
  services: ReadonlyArray<Pick<ServiceItem, 'id'>>
): AdminDashboardStats {
  let newOrders = 0;
  let pendingOrders = 0;
  let paymentPending = 0;
  let paymentReceived = 0;
  let designing = 0;
  let completed = 0;
  let delivered = 0;
  let cancelled = 0;

  for (const order of orders) {
    const pStatus: PaymentVerificationStatus =
      order.paymentStatus || 'PAYMENT VERIFICATION PENDING';
    const status: OrderStatus = order.status;

    if (status === 'NEW ORDER') {
      newOrders += 1;
    }

    if (status === 'CANCELLED') {
      cancelled += 1;
      continue;
    }

    if (
      status === 'NEW ORDER' ||
      status === 'PAYMENT VERIFICATION PENDING' ||
      status === 'PAYMENT PENDING' ||
      status === 'PAYMENT RECEIVED'
    ) {
      pendingOrders += 1;
    }

    if (
      pStatus === 'PAYMENT VERIFICATION PENDING' ||
      status === 'PAYMENT VERIFICATION PENDING' ||
      status === 'PAYMENT PENDING'
    ) {
      paymentPending += 1;
    }

    if (pStatus === 'PAYMENT VERIFIED' || status === 'PAYMENT RECEIVED') {
      paymentReceived += 1;
    }

    if (status === 'DESIGNING') {
      designing += 1;
    } else if (status === 'DESIGN COMPLETED') {
      completed += 1;
    } else if (status === 'DELIVERED') {
      delivered += 1;
    }
  }

  return {
    totalOrders: orders.length,
    newOrders,
    pendingOrders,
    paymentPending,
    paymentReceived,
    designing,
    completed,
    delivered,
    cancelled,
    totalServices: services.length,
  };
}

export function detectAdminOrderEvents(
  prevOrders: ReadonlyArray<OrderRecord>,
  nextOrders: ReadonlyArray<OrderRecord>,
  nowMs = Date.now()
): AdminNotificationItem[] {
  const prevMap = new Map<string, OrderRecord>();
  for (const o of prevOrders) {
    prevMap.set(o.orderId, o);
  }

  const events: AdminNotificationItem[] = [];

  for (const next of nextOrders) {
    const prev = prevMap.get(next.orderId);
    const nextPaymentStatus = next.paymentStatus || 'PAYMENT VERIFICATION PENDING';

    if (!prev) {
      events.push({
        id: `adm_${next.orderId}_new_${nowMs}`,
        type: 'NEW ORDER RECEIVED',
        orderId: next.orderId,
        title: 'New Order Received',
        message: `${next.customerName} ordered ${next.serviceName} (${next.orderId})`,
        createdAtMs: nowMs,
        read: false,
      });

      if (nextPaymentStatus === 'PAYMENT VERIFIED') {
        events.push({
          id: `adm_${next.orderId}_pay_${nowMs}`,
          type: 'NEW PAYMENT RECEIVED',
          orderId: next.orderId,
          title: 'New Payment Received',
          message: `Verified Razorpay payment received for ${next.orderId} (${next.serviceName})`,
          createdAtMs: nowMs,
          read: false,
        });
      }

      if (next.specialInstructions && next.specialInstructions.trim().length > 0) {
        events.push({
          id: `adm_${next.orderId}_req_${nowMs}`,
          type: 'NEW CUSTOMER REQUEST',
          orderId: next.orderId,
          title: 'New Customer Request',
          message: `${next.customerName} included custom instructions on ${next.orderId}`,
          createdAtMs: nowMs,
          read: false,
        });
      }
      continue;
    }

    const prevPaymentStatus = prev.paymentStatus || 'PAYMENT VERIFICATION PENDING';

    if (prevPaymentStatus !== 'PAYMENT VERIFIED' && nextPaymentStatus === 'PAYMENT VERIFIED') {
      events.push({
        id: `adm_${next.orderId}_pver_${nowMs}`,
        type: 'NEW PAYMENT RECEIVED',
        orderId: next.orderId,
        title: 'New Payment Received',
        message: `Payment verified for ${next.orderId} (${next.customerName})`,
        createdAtMs: nowMs,
        read: false,
      });
    }

    if (prevPaymentStatus !== 'PAYMENT REJECTED' && nextPaymentStatus === 'PAYMENT REJECTED') {
      events.push({
        id: `adm_${next.orderId}_pfail_${nowMs}`,
        type: 'PAYMENT FAILED',
        orderId: next.orderId,
        title: 'Payment Failed / Rejected',
        message: `Payment marked rejected for ${next.orderId} (${next.customerName})`,
        createdAtMs: nowMs,
        read: false,
      });
    }

    if (prev.status !== 'CANCELLED' && next.status === 'CANCELLED') {
      events.push({
        id: `adm_${next.orderId}_cancel_${nowMs}`,
        type: 'ORDER CANCELLED',
        orderId: next.orderId,
        title: 'Order Cancelled',
        message: `Order ${next.orderId} (${next.serviceName}) was cancelled`,
        createdAtMs: nowMs,
        read: false,
      });
    }
  }

  return events;
}

export function mapTrackingToCustomerNotificationType(
  status: OrderStatus,
  paymentStatus?: PaymentVerificationStatus
): CustomerNotificationType | null {
  if (status === 'CANCELLED') return 'Order Cancelled';
  if (status === 'DELIVERED') return 'Order Delivered';
  if (status === 'DESIGN COMPLETED') return 'Design Completed';
  if (status === 'DESIGNING') return 'Designing Started';
  if (status === 'PAYMENT RECEIVED' || paymentStatus === 'PAYMENT VERIFIED') {
    return 'Payment Verified';
  }
  if (status === 'NEW ORDER') return 'Order Received';
  return null;
}

export function detectCustomerOrderEvents(
  prevOrders: ReadonlyArray<OrderTrackingRecord>,
  nextOrders: ReadonlyArray<OrderTrackingRecord>,
  nowMs = Date.now()
): CustomerNotificationItem[] {
  const prevMap = new Map<string, OrderTrackingRecord>();
  for (const o of prevOrders) {
    prevMap.set(o.orderId, o);
  }

  const events: CustomerNotificationItem[] = [];
  for (const next of nextOrders) {
    const prev = prevMap.get(next.orderId);
    const nextLabel = mapTrackingToCustomerNotificationType(next.status, next.paymentStatus);

    if (!prev) {
      const progress = getLiveOrderStepsState(next.status, next.paymentStatus);
      events.push({
        id: `cust_${next.orderId}_init_${nowMs}`,
        type: nextLabel || 'Order Received',
        orderId: next.orderId,
        serviceName: next.serviceName,
        message: `${next.serviceName} (${next.orderId}) is currently: ${progress.friendlyLabel}`,
        createdAtMs: nowMs,
      });
      continue;
    }

    const prevPayment = prev.paymentStatus || 'PAYMENT VERIFICATION PENDING';
    const nextPayment = next.paymentStatus || 'PAYMENT VERIFICATION PENDING';
    if (prev.status !== next.status || prevPayment !== nextPayment) {
      const progress = getLiveOrderStepsState(next.status, next.paymentStatus);
      const eventType: CustomerNotificationType =
        nextLabel ||
        (progress.isCancelled ? 'Order Cancelled' : 'Order Received');
      events.push({
        id: `cust_${next.orderId}_${next.status}_${nowMs}`,
        type: eventType,
        orderId: next.orderId,
        serviceName: next.serviceName,
        message: `${next.serviceName} (${next.orderId}) updated to: ${progress.friendlyLabel}`,
        createdAtMs: nowMs,
      });
    }
  }

  return events;
}
