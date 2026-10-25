import { describe, expect, it } from 'vitest';
import {
  canManageShop,
  registrationRoleFields,
  requestedRoleFromProfile,
} from './authRoles';

describe('account role handling', () => {
  it('persists customer registration with the customer role and no merchant status', () => {
    expect(registrationRoleFields('customer')).toEqual({
      role: 'customer',
      requestedRole: 'customer',
      shopkeeperStatus: 'none',
    });
  });

  it('persists shopkeeper registration as pending without granting merchant access', () => {
    expect(registrationRoleFields('shopkeeper')).toEqual({
      role: 'shopkeeper',
      requestedRole: 'shopkeeper',
      shopkeeperStatus: 'pending',
    });
    expect(canManageShop('shopkeeper', 'pending')).toBe(false);
    expect(canManageShop('shopkeeper', 'approved')).toBe(true);
    expect(canManageShop('customer', 'approved')).toBe(false);
  });

  it('rejects role values outside the registration allowlist', () => {
    expect(() => registrationRoleFields('admin')).toThrow('Select a valid account role.');
    expect(() => registrationRoleFields('consumer')).toThrow('Select a valid account role.');
  });

  it('restores existing shopkeeper applicants without trusting unsupported role values', () => {
    expect(requestedRoleFromProfile({ requestedRole: 'shopkeeper', role: 'consumer' })).toBe('shopkeeper');
    expect(requestedRoleFromProfile({ requestedRole: 'admin', role: 'consumer' })).toBe('customer');
    expect(requestedRoleFromProfile({ role: 'consumer' })).toBe('customer');
  });
});
