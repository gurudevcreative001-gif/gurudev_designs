import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  computeServerPhoneKey,
  maskMobileNumber,
  normalizeIndianMobileLast10,
  SlidingWindowRateLimiter,
  verifyRazorpaySignature,
} from './securityUtils';
import { computePhoneKey } from '../src/utils/orderUtils';

test('normalizeIndianMobileLast10 accepts +91/0/plain 10-digit formats and rejects invalid input', () => {
  assert.equal(normalizeIndianMobileLast10('+91 63538 94486'), '6353894486');
  assert.equal(normalizeIndianMobileLast10('09876543210'), '9876543210');
  assert.equal(normalizeIndianMobileLast10('9876543210'), '9876543210');
  assert.equal(normalizeIndianMobileLast10('12345'), null);
  assert.equal(normalizeIndianMobileLast10('abc9876543210'), null);
});

test('computeServerPhoneKey matches client-side computePhoneKey identically', async () => {
  const clientHash = await computePhoneKey('+91 63538 94486');
  const serverHash = computeServerPhoneKey('6353894486');
  assert.equal(serverHash, clientHash);
  assert.equal(maskMobileNumber('6353894486'), '+91 ******4486');
});

test('SlidingWindowRateLimiter blocks requests past limit and resets after window', () => {
  const limiter = new SlidingWindowRateLimiter();
  assert.equal(limiter.check('ip:1', 2, 60000, 1000).allowed, true);
  assert.equal(limiter.check('ip:1', 2, 60000, 2000).allowed, true);
  const blocked = limiter.check('ip:1', 2, 60000, 3000);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterSeconds >= 1);

  const afterWindow = limiter.check('ip:1', 2, 60000, 62000);
  assert.equal(afterWindow.allowed, true);
});

test('verifyRazorpaySignature performs constant-time HMAC-SHA256 verification', () => {
  const secret = 'rzp_test_secret_12345';
  const orderId = 'order_ABC123456';
  const paymentId = 'pay_XYZ987654';
  const validSig = crypto
    .createHmac('sha256', secret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  assert.equal(
    verifyRazorpaySignature({
      razorpayOrderId: orderId,
      razorpayPaymentId: paymentId,
      razorpaySignature: validSig,
      keySecret: secret,
    }),
    true
  );

  assert.equal(
    verifyRazorpaySignature({
      razorpayOrderId: orderId,
      razorpayPaymentId: paymentId,
      razorpaySignature: '0'.repeat(64),
      keySecret: secret,
    }),
    false
  );
});
