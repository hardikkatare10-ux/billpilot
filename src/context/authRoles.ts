export type AccountRole = 'customer' | 'shopkeeper' | 'admin';
export type RegistrationRole = 'customer' | 'shopkeeper';
export type ShopkeeperStatus = 'none' | 'pending' | 'approved' | 'rejected';

export interface RegistrationRoleFields {
  role: RegistrationRole;
  requestedRole: RegistrationRole;
  shopkeeperStatus: ShopkeeperStatus;
}

export function registrationRoleFields(role: unknown): RegistrationRoleFields {
  if (role === 'customer') {
    return { role, requestedRole: role, shopkeeperStatus: 'none' };
  }
  if (role === 'shopkeeper') {
    return { role, requestedRole: role, shopkeeperStatus: 'pending' };
  }
  throw new Error('Select a valid account role.');
}

export function requestedRoleFromProfile(profile: {
  requestedRole?: unknown;
  role?: unknown;
  shopId?: unknown;
}): RegistrationRole {
  if (profile.requestedRole === 'shopkeeper') {
    return profile.requestedRole;
  }
  if (profile.role === 'shopkeeper' || Boolean(profile.shopId)) {
    return 'shopkeeper';
  }
  if (profile.requestedRole === 'customer' || profile.requestedRole === 'consumer') {
    return 'customer';
  }
  return 'customer';
}

export function canManageShop(role: AccountRole, status: ShopkeeperStatus): boolean {
  return (role === 'shopkeeper' || role === 'admin') && status === 'approved';
}
