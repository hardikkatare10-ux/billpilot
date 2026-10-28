/**
 * NearBasket - Firebase Client SDK Re-Export & Security Handlers
 * 
 * Re-uses unified Firebase App, Authentication, and Firestore instances from src/lib/firebase.ts.
 * Eliminates duplicate Firebase app initializations.
 */

import { GoogleAuthProvider, signInWithPopup, signOut, signInAnonymously } from 'firebase/auth';
import { doc, getDocFromServer } from 'firebase/firestore';
import { app, auth, db, googleAuthProvider, storage, isFirebaseConfigured } from '../../../lib/firebase';

export { app, auth, db, googleAuthProvider, storage, isFirebaseConfigured };

// Operation types for security error reporting
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

/**
 * Standard security error handler complying with Firebase Integration guidelines
 */
export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
      tenantId: auth?.currentUser?.tenantId,
      providerInfo:
        auth?.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Security / Operation Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Validates connection to Firestore from server/client
 */
export async function validateFirestoreConnection(): Promise<boolean> {
  if (!db) return false;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore offline: running in local persistent cache mode.');
      return false;
    }
    return true;
  }
}

/**
 * Google Sign-In with Popup
 */
export async function signInWithGoogle() {
  if (!auth) throw new Error("Firebase Auth is not initialized");
  try {
    const result = await signInWithPopup(auth, googleAuthProvider);
    return result.user;
  } catch (error) {
    console.error('Google Sign-In failed:', error);
    throw error;
  }
}

export async function logOutFirebase() {
  if (auth) {
    await signOut(auth);
  }
}

/**
 * Ensures a valid session for Firestore operations
 */
export async function ensureFirebaseSession(): Promise<string | null> {
  if (!auth) return null;
  try {
    if (auth.currentUser) return auth.currentUser.uid;
    const cred = await signInAnonymously(auth);
    return cred.user.uid;
  } catch (err) {
    console.warn('Firebase session unavailable, using local store:', err);
    return null;
  }
}
