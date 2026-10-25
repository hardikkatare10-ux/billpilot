import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, type Auth } from "firebase/auth";
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

// Fallback config from firebase-applet-config.json (loaded synchronously at build time).
// NOTE: this used to be a dynamic `import().then(...)`, which resolves AFTER the config below was
// built, so the app always started with the dummy placeholder API key. import.meta.glob with
// `eager: true` inlines the JSON, and tolerates the file being absent.
const appletModules = import.meta.glob("../../firebase-applet-config.json", { eager: true }) as Record<string, any>;
const appletFirst = Object.values(appletModules)[0];
const appletConfig: Record<string, any> = (appletFirst && (appletFirst.default || appletFirst)) || {};

const env = (import.meta as any).env as Record<string, string | undefined>;

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || appletConfig.apiKey || "AIzaSyDummyKeyForBuildValidation12345",
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || appletConfig.authDomain || "billpilot.firebaseapp.com",
  projectId: env.VITE_FIREBASE_PROJECT_ID || appletConfig.projectId || "billpilot-merged",
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || appletConfig.storageBucket || "billpilot-merged.appspot.com",
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || appletConfig.messagingSenderId || "1234567890",
  appId: env.VITE_FIREBASE_APP_ID || appletConfig.appId || "1:1234567890:web:abcdef123456",
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || appletConfig.measurementId || undefined,
};

// Named Firestore database (AI Studio provisions one instead of "(default)").
// Leave empty to use the default database.
const firestoreDatabaseId: string =
  env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || appletConfig.firestoreDatabaseId || "";

/** True when Firebase credentials are configured in env or config file */
export const isFirebaseConfigured = Boolean(
  (env.VITE_FIREBASE_API_KEY && env.VITE_FIREBASE_PROJECT_ID && env.VITE_FIREBASE_APP_ID) ||
  (appletConfig.apiKey && appletConfig.projectId && appletConfig.appId)
);

export const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth: Auth = getAuth(app);
export const googleAuthProvider = new GoogleAuthProvider();

let dbInstance: Firestore;
try {
  const settings = {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    // Firestore rejects documents containing `undefined` (e.g. a blank GSTIN / shopId).
    // Without this, shop + profile writes failed silently.
    ignoreUndefinedProperties: true,
  };
  dbInstance = firestoreDatabaseId
    ? initializeFirestore(app, settings, firestoreDatabaseId)
    : initializeFirestore(app, settings);
} catch {
  dbInstance = firestoreDatabaseId ? getFirestore(app, firestoreDatabaseId) : getFirestore(app);
}

export const db: Firestore = dbInstance;

let storageInstance: FirebaseStorage | null = null;
try {
  storageInstance = getStorage(app);
} catch (e) {
  console.warn("Firebase Storage initialization skipped or unavailable:", e);
}

export const storage = storageInstance;

export async function signInWithGoogle() {
  if (!auth) throw new Error("Firebase Auth is not initialized");
  const result = await signInWithPopup(auth, googleAuthProvider);
  return result.user;
}
