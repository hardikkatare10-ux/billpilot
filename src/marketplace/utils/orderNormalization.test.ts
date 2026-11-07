import { describe, expect, it } from 'vitest';
import { normalizeFirestoreDate, normalizeOrderStatus, normalizePaymentStatus } from './orderNormalization';

describe('marketplace order normalization',()=>{
  it('maps displayed legacy fulfillment labels to canonical order statuses',()=>{
    expect(normalizeOrderStatus('Out For Delivery')).toBe('out_for_delivery');
    expect(normalizeOrderStatus('Packed')).toBe('ready_for_dispatch');
    expect(normalizeOrderStatus('Processing')).toBe('preparing');
    expect(normalizeOrderStatus('Cancelled')).toBe('cancelled');
  });
  it('maps paid and unpaid aliases without confusing payment and fulfillment status',()=>{
    expect(normalizePaymentStatus('paid')).toBe('completed');
    expect(normalizePaymentStatus('unpaid')).toBe('pending');
    expect(normalizeOrderStatus('delivered')).toBe('delivered');
  });
  it('normalizes ISO dates, Firestore Timestamp values and timestamp objects',()=>{
    const instant=new Date('2026-11-08T04:00:00.000Z');
    expect(normalizeFirestoreDate(instant)).toBe(instant.toISOString());
    expect(normalizeFirestoreDate({toDate:()=>instant})).toBe(instant.toISOString());
    expect(normalizeFirestoreDate({seconds:instant.getTime()/1000})).toBe(instant.toISOString());
    expect(normalizeFirestoreDate('invalid-date')).toBe(new Date(0).toISOString());
  });
});
