import { doc, getDocFromServer } from "firebase/firestore";
import { db, isFirebaseConfigured } from "./firebase";

const CHECK_CACHE_MS = 5_000;
const CHECK_TIMEOUT_MS = 8_000;

let lastCheckAt = 0;
let lastCheckResult = false;
let activeCheck: Promise<boolean> | null = null;

function isReachabilityError(error: unknown): boolean {
  const code = typeof error === "object" && error !== null && "code" in error
    ? String(error.code)
    : "";
  return ["permission-denied", "unauthenticated", "not-found", "invalid-argument"].some(
    (knownCode) => code.endsWith(knownCode)
  );
}

export async function checkFirebaseReachability(force = false): Promise<boolean> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    lastCheckAt = Date.now();
    lastCheckResult = false;
    return false;
  }
  if (!isFirebaseConfigured || !db) return false;
  if (activeCheck) return activeCheck;
  if (!force && Date.now() - lastCheckAt < CHECK_CACHE_MS) return lastCheckResult;

  const check = Promise.resolve().then(async () => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const request = getDocFromServer(doc(db, "test", "connectivity"))
        .then(() => true)
        .catch((error: unknown) => isReachabilityError(error));
      const reachable = await Promise.race([
        request,
        new Promise<boolean>((resolve) => {
          timeout = setTimeout(() => resolve(false), CHECK_TIMEOUT_MS);
        }),
      ]);
      lastCheckResult = reachable;
      return reachable;
    } catch {
      lastCheckResult = false;
      return false;
    } finally {
      if (timeout) clearTimeout(timeout);
      lastCheckAt = Date.now();
      activeCheck = null;
    }
  });
  activeCheck = check;

  return check;
}

export async function assertFirebaseReachable(): Promise<void> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    throw new Error("Internet connectivity is unavailable. Reconnect before saving cloud-dependent changes.");
  }
  const reachable = await checkFirebaseReachability();
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    throw new Error("Internet connectivity is unavailable. Reconnect before saving cloud-dependent changes.");
  }
  if (!reachable) {
    throw new Error("Firebase cloud services are unavailable. Reconnect and verify the cloud connection before saving.");
  }
}
