import { describe, expect, it } from 'vitest';
import { pathToShopkeeperTab, shopkeeperTabToPath } from './shopkeeperRoutes';

describe('shopkeeper routes', () => {
  it('round-trips every sidebar tab through its direct URL', () => {
    const tabs = [
      'dashboard', 'demand', 'regular_demands', 'whatsapp_reports', 'barcode', 'inventory', 'invoice', 'invoices', 'cashsale',
      'posdevices', 'reminders', 'rates', 'bulk', 'backup', 'reports', 'sync',
      'gst', 'customers', 'settings', 'profile', 'ppi',
      'local_dashboard', 'local_orders', 'local_products',
    ] as const;

    for (const tab of tabs) {
      expect(pathToShopkeeperTab(shopkeeperTabToPath(tab))).toBe(tab);
    }
  });

  it('keeps invoice creation separate from invoice history', () => {
    expect(pathToShopkeeperTab('/shopkeeper/invoice')).toBe('invoice');
    expect(pathToShopkeeperTab('/shopkeeper/invoices')).toBe('invoices');
  });
});
