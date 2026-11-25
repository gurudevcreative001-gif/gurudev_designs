import type { AppView, MenuItemKey, MenuVisibility, ServiceCategory } from '../types/design';

export interface MenuDefinition {
  key: MenuItemKey;
  label: string;
  view?: AppView;
  category?: ServiceCategory | 'ALL';
  externalWhatsApp?: boolean;
  group: 'main' | 'support' | 'legal' | 'system';
}

/**
 * Complete 12-item Menu System matching the Three-Button Bottom Navigation specification.
 */
export const MENU_ITEMS: MenuDefinition[] = [
  { key: 'home', label: 'Home', view: 'home', group: 'main' },
  {
    key: 'allServices',
    label: 'All Design Services',
    view: 'services',
    category: 'ALL',
    group: 'main',
  },
  { key: 'gallery', label: 'Design Gallery', view: 'gallery', group: 'main' },
  { key: 'orders', label: 'My Orders', view: 'my-orders', group: 'main' },
  { key: 'about', label: 'About Us', view: 'about', group: 'support' },
  { key: 'contact', label: 'Contact Us', view: 'contact', group: 'support' },
  {
    key: 'whatsapp',
    label: 'WhatsApp Support',
    externalWhatsApp: true,
    group: 'support',
  },
  {
    key: 'paymentInfo',
    label: 'Payment Information',
    view: 'payment-info',
    group: 'legal',
  },
  {
    key: 'terms',
    label: 'Terms & Conditions',
    view: 'terms',
    group: 'legal',
  },
  {
    key: 'privacy',
    label: 'Privacy Policy',
    view: 'privacy',
    group: 'legal',
  },
  {
    key: 'refund',
    label: 'Refund Policy',
    view: 'refund',
    group: 'legal',
  },
  { key: 'admin', label: 'Admin Login', view: 'admin', group: 'system' },
];

export function normalizeMenuVisibility(
  partial: Partial<MenuVisibility> | undefined,
  defaults: MenuVisibility
): MenuVisibility {
  const merged: MenuVisibility = { ...defaults };
  if (!partial) return merged;
  (Object.keys(defaults) as MenuItemKey[]).forEach((key) => {
    if (typeof partial[key] === 'boolean') {
      merged[key] = partial[key] as boolean;
    }
  });
  return merged;
}

export function getVisibleMenuItems(visibility: Partial<MenuVisibility> | undefined): MenuDefinition[] {
  if (!visibility) return MENU_ITEMS;
  return MENU_ITEMS.filter((item) => visibility[item.key] !== false);
}

export function getActiveMenuKey(activeView: AppView): MenuItemKey {
  switch (activeView) {
    case 'home':
      return 'home';
    case 'services':
    case 'order-form':
    case 'payment':
      return 'allServices';
    case 'gallery':
      return 'gallery';
    case 'my-orders':
    case 'confirm':
      return 'orders';
    case 'about':
      return 'about';
    case 'contact':
      return 'contact';
    case 'payment-info':
      return 'paymentInfo';
    case 'terms':
      return 'terms';
    case 'privacy':
      return 'privacy';
    case 'refund':
      return 'refund';
    case 'admin':
      return 'admin';
  }
}
