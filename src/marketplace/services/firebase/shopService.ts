/**
 * Live shop directory sync: Firestore `shops` -> local dbStore.
 * Registration writes shops to Firestore, but the marketplace UI reads from dbStore,
 * so without this listener no registered shop ever appeared in the marketplace or admin panel.
 */
import { collection, doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from './config';
import { dbStore } from '../db/store';
import type { Shop } from '../../types';

export async function updateFirestoreShopLocation(
  shopId: string,
  coordinates: { latitude: number; longitude: number },
  serviceRadiusKm?: number
): Promise<void> {
  if (!isFirebaseConfigured) {
    throw new Error('Shop location cannot be saved because cloud sync is not configured.');
  }
  await updateDoc(doc(db, 'shops', shopId), {
    'address.coordinates': coordinates,
    ...(serviceRadiusKm === undefined
      ? {}
      : { 'deliverySettings.serviceRadiusKm': Math.min(Number(serviceRadiusKm) || 10, 10) }),
  });
}

export function startShopSync(): () => void {
  try {
    return onSnapshot(
      collection(db, 'shops'),
      (snap) => {
        const shops = snap.docs.map((d) => ({ ...(d.data() as Shop), id: d.id }));
        dbStore.syncShopsFromFirestore(shops);
      },
      (err) => console.warn('Shop sync unavailable:', err)
    );
  } catch (err) {
    console.warn('Shop sync could not start:', err);
    return () => {};
  }
}
