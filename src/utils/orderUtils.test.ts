import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWhatsAppUrl,
  calculatePricingSummary,
  computePhoneKey,
  computeTrackingKey,
  formatPriceINR,
  formatWhatsAppMessage,
  generateOrderId,
  getDeliveryStatusText,
  getLiveOrderStepsState,
  normalizeMobileLast10,
  validateDesignDetailsInput,
  validateOrderInput,
} from './orderUtils';

test('generateOrderId produces valid uppercase alphanumeric ID with GD prefix', () => {
  const id = generateOrderId(new Date('2026-11-25T10:00:00Z'), 4829);
  assert.equal(id, 'GD-261125-4829');
  assert.match(id, /^[A-Z0-9-]+$/);
});

test('normalizeMobileLast10 handles country codes and spaces', () => {
  assert.equal(normalizeMobileLast10('+91 98765 43210'), '9876543210');
  assert.equal(normalizeMobileLast10('09876543210'), '9876543210');
  assert.equal(normalizeMobileLast10('9876543210'), '9876543210');
});

test('computeTrackingKey and computePhoneKey produce deterministic 64-char SHA-256 hex', async () => {
  const keyA = await computeTrackingKey('GD-261125-4829', '+91 98765 43210');
  const keyB = await computeTrackingKey('gd-261125-4829', '9876543210');
  const keyDifferentMobile = await computeTrackingKey('GD-261125-4829', '9876543211');
  const keyDifferentOrder = await computeTrackingKey('GD-261125-4830', '9876543210');

  assert.equal(keyA.length, 64);
  assert.match(keyA, /^[a-f0-9]{64}$/);
  assert.equal(keyA, keyB);
  assert.notEqual(keyA, keyDifferentMobile);
  assert.notEqual(keyA, keyDifferentOrder);

  const phoneKeyA = await computePhoneKey('+91 98765 43210');
  const phoneKeyB = await computePhoneKey('9876543210');
  const phoneKeyOther = await computePhoneKey('9876543211');
  assert.equal(phoneKeyA.length, 64);
  assert.equal(phoneKeyA, phoneKeyB);
  assert.notEqual(phoneKeyA, phoneKeyOther);
});

test('calculatePricingSummary computes percentage and flat discounts safely', () => {
  assert.deepEqual(calculatePricingSummary(500, { discountPercent: 0, discountFlat: 0 }), {
    totalPrice: 500,
    discountAmount: 0,
    finalPayable: 500,
  });

  assert.deepEqual(calculatePricingSummary(500, { discountPercent: 10, discountFlat: 50 }), {
    totalPrice: 500,
    discountAmount: 100,
    finalPayable: 400,
  });

  assert.deepEqual(calculatePricingSummary(100, { discountPercent: 50, discountFlat: 200 }), {
    totalPrice: 100,
    discountAmount: 100,
    finalPayable: 0,
  });
});

test('validateDesignDetailsInput and validateOrderInput handle Razorpay and QR/UPI modes', () => {
  const step1Invalid = validateDesignDetailsInput({
    customerName: 'A',
    mobile: '123',
    serviceId: '',
    serviceName: '',
    designSize: '',
    language: 'Gujarati',
    designText: '',
    requirements: '   ',
    specialInstructions: '',
  });
  assert.ok(step1Invalid.customerName);
  assert.ok(step1Invalid.mobile);
  assert.ok(step1Invalid.serviceId);
  assert.ok(step1Invalid.designSize);
  assert.ok(step1Invalid.requirements);

  // Manual QR/UPI requires UTR & checkbox
  const manualInvalid = validateOrderInput({
    customerName: 'Rakesh Patel',
    mobile: '+91 98765 43210',
    serviceId: 'instagram-post',
    serviceName: 'Instagram Post',
    designSize: '1080 x 1080 px (Square)',
    language: 'Gujarati',
    designText: 'શુભ દિવાળી',
    requirements: 'Festive gold and navy poster with shop logo',
    specialInstructions: 'Deliver PNG and PDF',
    paymentMethod: 'Scan & Pay QR',
    paymentReference: '12',
    paymentCompletedChecked: false,
  });
  assert.ok(manualInvalid.paymentReference);
  assert.ok(manualInvalid.paymentCompletedChecked);

  // Razorpay mode passes design validation without manual UTR input
  const razorpayValid = validateOrderInput({
    customerName: 'Rakesh Patel',
    mobile: '+91 98765 43210',
    serviceId: 'instagram-post',
    serviceName: 'Instagram Post',
    designSize: '1080 x 1080 px (Square)',
    language: 'Gujarati',
    designText: 'શુભ દિવાળી',
    requirements: 'Festive gold and navy poster with shop logo',
    specialInstructions: 'Deliver PNG and PDF',
    paymentMethod: 'Razorpay',
  });
  assert.deepEqual(razorpayValid, {});
});

test('getLiveOrderStepsState maps statuses cleanly to the 6 live order tracking steps', () => {
  const pending = getLiveOrderStepsState('PAYMENT VERIFICATION PENDING', 'PAYMENT VERIFICATION PENDING');
  assert.equal(pending.currentStepIndex, 1);
  assert.equal(pending.friendlyLabel, 'Payment Pending');
  assert.equal(pending.steps.length, 6);

  const verified = getLiveOrderStepsState('PAYMENT RECEIVED', 'PAYMENT VERIFIED');
  assert.equal(verified.currentStepIndex, 2);
  assert.equal(verified.friendlyLabel, 'Payment Verified');

  const designing = getLiveOrderStepsState('DESIGNING', 'PAYMENT VERIFIED');
  assert.equal(designing.currentStepIndex, 3);
  assert.equal(designing.friendlyLabel, 'Designing Started');

  const completed = getLiveOrderStepsState('DESIGN COMPLETED', 'PAYMENT VERIFIED');
  assert.equal(completed.currentStepIndex, 4);
  assert.equal(completed.friendlyLabel, 'Design Completed');

  const delivered = getLiveOrderStepsState('DELIVERED', 'PAYMENT VERIFIED');
  assert.equal(delivered.currentStepIndex, 5);
  assert.equal(delivered.friendlyLabel, 'Delivered');
  assert.equal(delivered.steps.every((s) => s.completed), true);
});

test('formatWhatsAppMessage and buildWhatsAppUrl include order ID, price, payment details, and requirements', () => {
  const msg = formatWhatsAppMessage({
    brandName: 'gurudev_designs',
    orderId: 'GD-261125-4829',
    customerName: 'Rakesh Patel',
    mobile: '9876543210',
    serviceName: 'લગ્નની આમંત્રણ પત્રિકા',
    servicePrice: 599,
    discountAmount: 50,
    finalAmount: 549,
    paymentMethod: 'Razorpay',
    paymentReference: 'pay_RZP123456',
    paymentStatus: 'PAYMENT VERIFIED',
    designSize: 'A4 Portrait',
    language: 'Gujarati',
    requirements: 'Royal gold wedding invite',
    designText: 'શુભ વિવાહ',
    specialInstructions: 'Include Ganesh motif',
  });

  assert.ok(msg.includes('Order ID: GD-261125-4829'));
  assert.ok(msg.includes('Customer Name: Rakesh Patel'));
  assert.ok(msg.includes('Price: ₹549'));
  assert.ok(msg.includes('Razorpay Payment ID: pay_RZP123456'));
  assert.ok(msg.includes('Payment Status: PAYMENT VERIFIED'));

  const url = buildWhatsAppUrl('98765 43210', msg);
  assert.ok(url.startsWith('https://wa.me/919876543210?text='));
});

test('getDeliveryStatusText and formatPriceINR handle states cleanly', () => {
  assert.equal(
    getDeliveryStatusText('PAYMENT VERIFICATION PENDING'),
    'Payment Pending — Awaiting Payment Verification'
  );
  assert.equal(getDeliveryStatusText('DESIGNING'), 'Designing Started — Artwork in Progress');
  assert.equal(getDeliveryStatusText('DELIVERED'), 'Delivered — Final High-Res Files Sent');
  assert.equal(formatPriceINR(499), '₹499');
});
