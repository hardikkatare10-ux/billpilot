import { doc, getDoc, onSnapshot, setDoc, type Unsubscribe } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import {
  isValidGstin,
  type GstRegistrationStatus,
  type VerifiedGstRegistration,
} from './invoiceRules';

const GST_STATUSES: GstRegistrationStatus[] = [
  'unregistered',
  'regular',
  'composition',
  'pending_verification',
  'suspended',
];

function registrationFromData(data: Record<string, unknown> | undefined): VerifiedGstRegistration | null {
  if (!data || !GST_STATUSES.includes(data.status as GstRegistrationStatus) ||
      typeof data.verified !== 'boolean') return null;
  const registration: VerifiedGstRegistration = {
    status: data.status as GstRegistrationStatus,
    verified: data.verified,
    ...(typeof data.gstin === 'string' ? { gstin: data.gstin.trim().toUpperCase() } : {}),
  };
  if ((registration.status === 'regular' || registration.status === 'composition') &&
      (!registration.verified || !isValidGstin(registration.gstin))) {
    return { ...registration, verified: false };
  }
  return registration;
}

export async function submitShopGstRegistration(
  shopId: string,
  expectedOwnerUid: string,
  gstin: string,
  requestedScheme: 'regular' | 'composition'
): Promise<void> {
  if (!shopId || !expectedOwnerUid || auth.currentUser?.uid !== expectedOwnerUid) {
    throw new Error('Sign in as the authenticated owner of this shop to submit GST registration.');
  }
  const normalizedGstin = gstin.trim().toUpperCase();
  if (!isValidGstin(normalizedGstin)) {
    throw new Error('Enter a GSTIN in the correct format before submitting for admin verification.');
  }
  if (requestedScheme !== 'regular' && requestedScheme !== 'composition') {
    throw new Error('Select the GST scheme you are requesting verification for.');
  }
  await setDoc(doc(db, 'shops', shopId, 'private', 'gstRegistration'), {
    status: 'pending_verification',
    verified: false,
    gstin: normalizedGstin,
    requestedScheme,
    submittedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }, { merge: true });
}

export async function loadShopGstRegistration(
  shopId: string,
  expectedOwnerUid: string
): Promise<VerifiedGstRegistration | null> {
  if (!shopId || !expectedOwnerUid || auth.currentUser?.uid !== expectedOwnerUid) {
    throw new Error('Cannot verify GST registration for the active authenticated shop.');
  }

  const snapshot = await getDoc(doc(db, 'shops', shopId, 'private', 'gstRegistration'));
  if (!snapshot.exists()) return null;

  return registrationFromData(snapshot.data());
}

export function subscribeToShopGstRegistration(
  shopId: string,
  expectedOwnerUid: string,
  onChange: (registration: VerifiedGstRegistration | null) => void,
  onError: (error: Error) => void
): Unsubscribe {
  if (!shopId || !expectedOwnerUid || auth.currentUser?.uid !== expectedOwnerUid) {
    throw new Error('Cannot subscribe to GST registration for the active authenticated shop.');
  }
  return onSnapshot(
    doc(db, 'shops', shopId, 'private', 'gstRegistration'),
    (snapshot) => onChange(snapshot.exists() ? registrationFromData(snapshot.data()) : null),
    onError
  );
}
