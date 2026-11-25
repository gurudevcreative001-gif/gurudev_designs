import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_MENU_VISIBILITY } from '../data/seedCatalog';
import {
  getActiveMenuKey,
  getVisibleMenuItems,
  MENU_ITEMS,
  normalizeMenuVisibility,
} from './menuConfig';

test('MENU_ITEMS exposes the exact 12 menu items with valid destinations', () => {
  assert.equal(MENU_ITEMS.length, 12);
  assert.deepEqual(
    MENU_ITEMS.map((item) => item.label),
    [
      'Home',
      'All Design Services',
      'Design Gallery',
      'My Orders',
      'About Us',
      'Contact Us',
      'WhatsApp Support',
      'Payment Information',
      'Terms & Conditions',
      'Privacy Policy',
      'Refund Policy',
      'Admin Login',
    ]
  );
  assert.ok(MENU_ITEMS.some((i) => i.key === 'whatsapp' && i.externalWhatsApp));
  assert.ok(MENU_ITEMS.some((i) => i.key === 'admin' && i.view === 'admin'));
});

test('getVisibleMenuItems filters hidden entries and preserves visible ones', () => {
  const filtered = getVisibleMenuItems({
    ...DEFAULT_MENU_VISIBILITY,
    refund: false,
  });
  assert.equal(filtered.length, 11);
  assert.equal(filtered.some((i) => i.key === 'refund'), false);
  assert.equal(filtered.some((i) => i.key === 'orders'), true);
});

test('normalizeMenuVisibility safely falls back to defaults for partial input', () => {
  const normalized = normalizeMenuVisibility({ gallery: false }, DEFAULT_MENU_VISIBILITY);
  assert.equal(normalized.gallery, false);
  assert.equal(normalized.home, true);
  assert.equal(normalized.paymentInfo, true);
  assert.equal(normalized.admin, true);
});

test('getActiveMenuKey highlights the right item for each view', () => {
  assert.equal(getActiveMenuKey('home'), 'home');
  assert.equal(getActiveMenuKey('services'), 'allServices');
  assert.equal(getActiveMenuKey('order-form'), 'allServices');
  assert.equal(getActiveMenuKey('payment'), 'allServices');
  assert.equal(getActiveMenuKey('gallery'), 'gallery');
  assert.equal(getActiveMenuKey('my-orders'), 'orders');
  assert.equal(getActiveMenuKey('about'), 'about');
  assert.equal(getActiveMenuKey('contact'), 'contact');
  assert.equal(getActiveMenuKey('payment-info'), 'paymentInfo');
  assert.equal(getActiveMenuKey('terms'), 'terms');
  assert.equal(getActiveMenuKey('privacy'), 'privacy');
  assert.equal(getActiveMenuKey('refund'), 'refund');
  assert.equal(getActiveMenuKey('admin'), 'admin');
});
