import { describe, expect, it } from 'vitest';
import { canArchiveShopOrder } from './orderArchival';

describe('shop order archival', () => {
  it('allows rejected and cancelled orders without completed payment', () => {
    expect(canArchiveShopOrder({ status: 'rejected', paymentStatus: 'pending' })).toBe(true);
    expect(canArchiveShopOrder({ status: 'cancelled', paymentStatus: 'refunded' })).toBe(true);
  });

  it('allows unpaid pending orders and paid or delivered orders to be archived', () => {
    expect(canArchiveShopOrder({ status: 'pending_confirmation', paymentStatus: 'pending' })).toBe(true);
    expect(canArchiveShopOrder({ status: 'pending_confirmation', paymentStatus: 'failed' })).toBe(true);
    expect(canArchiveShopOrder({ status: 'pending_confirmation', paymentStatus: 'authorized' })).toBe(false);
    expect(canArchiveShopOrder({ status: 'pending_confirmation', paymentStatus: 'completed' })).toBe(true);
    expect(canArchiveShopOrder({ status: 'delivered', paymentStatus: 'pending' })).toBe(true);
    expect(canArchiveShopOrder({ status: 'delivered', paymentStatus: 'completed' })).toBe(true);
  });

  it('keeps active unpaid orders protected and prevents a second archive', () => {
    expect(canArchiveShopOrder({ status: 'accepted', paymentStatus: 'pending' })).toBe(false);
    expect(canArchiveShopOrder({ status: 'cancelled', paymentStatus: 'completed' })).toBe(true);
    expect(canArchiveShopOrder({ status: 'rejected', paymentStatus: 'pending', shopArchived: true })).toBe(false);
  });
});
