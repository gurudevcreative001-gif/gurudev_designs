import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
const blueprintPath = path.resolve(process.cwd(), 'firebase-blueprint.json');
const rulesContent = fs.readFileSync(rulesPath, 'utf-8');
const blueprint = JSON.parse(fs.readFileSync(blueprintPath, 'utf-8'));

test('firestore.rules enforces Eight Pillars and covers every collection in blueprint', () => {
  assert.ok(rulesContent.includes("rules_version = '2';"), 'Rules version 2 required');
  assert.ok(
    rulesContent.includes('match /{document=**} {\n      allow read, write: if false;'),
    'Global default-deny catch-all required'
  );

  for (const collectionPath of Object.keys(blueprint.firestore)) {
    const baseCollection = collectionPath.split('/')[1];
    assert.ok(
      rulesContent.includes(`match /${baseCollection}/`),
      `Missing match block for ${baseCollection}`
    );
  }
});

test('orders collection prevents non-admin PII reads and isolates manual vs Razorpay payment status', () => {
  assert.ok(rulesContent.includes('allow get, list: if isAdmin();'));
  assert.ok(rulesContent.includes('existsAfter(/databases/$(database)/documents/order_tracking/$(incoming().trackingKey))'));
  assert.ok(rulesContent.includes('existsAfter(/databases/$(database)/documents/phone_indexes/$(incoming().phoneKey))'));
  assert.ok(rulesContent.includes("data.paymentStatus == 'PAYMENT VERIFICATION PENDING'"));
  assert.ok(rulesContent.includes("data.paymentMethod == 'Razorpay'"));
  assert.ok(rulesContent.includes("data.adminNotes == ''"));
});

test('only admins can verify/reject manual payment statuses or advance order statuses', () => {
  assert.ok(rulesContent.includes('allow update: if isAdmin()'));
  assert.ok(rulesContent.includes("affectedKeys().hasOnly(['status', 'paymentStatus', 'adminNotes', 'phoneKey', 'updatedAt'])"));
  assert.ok(rulesContent.includes("affectedKeys().hasOnly(['status', 'paymentStatus', 'deliveryStatus', 'phoneKey', 'updatedAt'])"));
});

test('order_tracking and phone_indexes forbid listing, exclude PII, and enforce 64-char SHA-256 keys', () => {
  assert.ok(rulesContent.includes('match /order_tracking/{trackingKey}'));
  assert.ok(rulesContent.includes('match /phone_indexes/{phoneKey}'));
  assert.ok(rulesContent.includes('allow list: if false;'));
  assert.ok(rulesContent.includes('data.trackingKeys.hasAll(existing().trackingKeys)'));
  assert.ok(rulesContent.includes("key.matches('^[a-f0-9]{64}$')"));
  // OrderTracking schema must never expose private payment screenshots, UTRs, or reference photos
  assert.ok(!blueprint.entities.OrderTracking.properties.paymentReference);
  assert.ok(!blueprint.entities.OrderTracking.properties.referencePhotos);
});

test('isAdmin verifies email_verified == true and does not trust unverified claims', () => {
  assert.ok(rulesContent.includes('request.auth.token.email_verified == true'));
  assert.ok(!rulesContent.includes('request.auth.token.role'));
  assert.ok(!rulesContent.includes('request.auth.token.admin'));
});
