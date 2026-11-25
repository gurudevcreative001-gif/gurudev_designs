import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeAdminOrderStats,
  detectAdminOrderEvents,
  detectCustomerOrderEvents,
} from './adminStats';
import type { OrderRecord, OrderTrackingRecord, ServiceItem } from '../types/design';

function makeOrder(partial: Partial<OrderRecord> & { orderId: string }): OrderRecord {
  const { orderId, ...rest } = partial;
  return {
    orderId,
    trackingKey: 'a'.repeat(64),
    customerName: 'Rakesh Patel',
    mobile: '9876543210',
    serviceId: 'instagram-post',
    serviceName: 'Instagram Post',
    designSize: '1080 x 1080 px',
    language: 'Gujarati',
    designText: 'Sale',
    requirements: 'Gold theme',
    specialInstructions: '',
    referencePhotos: [],
    logoUrl: '',
    status: 'NEW ORDER',
    paymentStatus: 'PAYMENT VERIFICATION PENDING',
    adminNotes: '',
    ...rest,
  };
}

test('computeAdminOrderStats computes all 9 order dashboard counters accurately', () => {
  const orders: OrderRecord[] = [
    makeOrder({ orderId: 'GD-1', status: 'NEW ORDER', paymentStatus: 'PAYMENT VERIFICATION PENDING' }),
    makeOrder({ orderId: 'GD-2', status: 'PAYMENT PENDING', paymentStatus: 'PAYMENT VERIFICATION PENDING' }),
    makeOrder({ orderId: 'GD-3', status: 'PAYMENT RECEIVED', paymentStatus: 'PAYMENT VERIFIED' }),
    makeOrder({ orderId: 'GD-4', status: 'DESIGNING', paymentStatus: 'PAYMENT VERIFIED' }),
    makeOrder({ orderId: 'GD-5', status: 'DESIGN COMPLETED', paymentStatus: 'PAYMENT VERIFIED' }),
    makeOrder({ orderId: 'GD-6', status: 'DELIVERED', paymentStatus: 'PAYMENT VERIFIED' }),
    makeOrder({ orderId: 'GD-7', status: 'CANCELLED', paymentStatus: 'PAYMENT REJECTED' }),
  ];
  const services: Array<Pick<ServiceItem, 'id'>> = [{ id: 's1' }, { id: 's2' }];

  const stats = computeAdminOrderStats(orders, services);
  assert.equal(stats.totalOrders, 7);
  assert.equal(stats.newOrders, 1);
  assert.equal(stats.pendingOrders, 3);
  assert.equal(stats.paymentPending, 2);
  assert.equal(stats.paymentReceived, 4);
  assert.equal(stats.designing, 1);
  assert.equal(stats.completed, 1);
  assert.equal(stats.delivered, 1);
  assert.equal(stats.cancelled, 1);
  assert.equal(stats.totalServices, 2);
});

test('detectAdminOrderEvents detects new orders, verified payments, failures, cancellations, and requests', () => {
  const prev = [makeOrder({ orderId: 'GD-1', status: 'PAYMENT PENDING', paymentStatus: 'PAYMENT VERIFICATION PENDING' })];
  const next = [
    makeOrder({ orderId: 'GD-1', status: 'CANCELLED', paymentStatus: 'PAYMENT REJECTED' }),
    makeOrder({
      orderId: 'GD-2',
      status: 'PAYMENT RECEIVED',
      paymentStatus: 'PAYMENT VERIFIED',
      specialInstructions: 'Urgent today',
    }),
  ];

  const events = detectAdminOrderEvents(prev, next, 1000);
  const types = events.map((e) => e.type);
  assert.ok(types.includes('PAYMENT FAILED'));
  assert.ok(types.includes('ORDER CANCELLED'));
  assert.ok(types.includes('NEW ORDER RECEIVED'));
  assert.ok(types.includes('NEW PAYMENT RECEIVED'));
  assert.ok(types.includes('NEW CUSTOMER REQUEST'));
});

test('detectCustomerOrderEvents emits live transition notifications when admin updates status', () => {
  const prev: OrderTrackingRecord[] = [
    {
      orderId: 'GD-1',
      serviceName: 'Instagram Post',
      status: 'PAYMENT VERIFICATION PENDING',
      paymentStatus: 'PAYMENT VERIFICATION PENDING',
      deliveryStatus: 'Payment Pending',
    },
  ];
  const next: OrderTrackingRecord[] = [
    {
      orderId: 'GD-1',
      serviceName: 'Instagram Post',
      status: 'DESIGNING',
      paymentStatus: 'PAYMENT VERIFIED',
      deliveryStatus: 'Designing Started',
    },
  ];

  const events = detectCustomerOrderEvents(prev, next, 2000);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'Designing Started');
  assert.match(events[0].message, /Designing Started/);
});
