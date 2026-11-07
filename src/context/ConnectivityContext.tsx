import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { assertFirebaseReachable, checkFirebaseReachability } from "../lib/firebaseConnectivity";
import { isCloudSyncActive } from "../lib/cloudSync";

export type ConnectivityStatus = "ONLINE" | "OFFLINE" | "RECONNECTING" | "CLOUD_UNAVAILABLE";

interface ConnectivityContextValue {
  status: ConnectivityStatus;
  checkConnectivity: () => Promise<boolean>;
  assertCloudSyncAvailable: () => Promise<void>;
}

const ConnectivityContext = createContext<ConnectivityContextValue | undefined>(undefined);

export function ConnectivityProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<ConnectivityStatus>(
    typeof navigator !== "undefined" && !navigator.onLine ? "OFFLINE" : "RECONNECTING"
  );
  const statusRef = useRef(status);

  const updateStatus = useCallback((nextStatus: ConnectivityStatus) => {
    statusRef.current = nextStatus;
    setStatus(nextStatus);
  }, []);

  const checkConnectivity = useCallback(async (force = false, showReconnecting = false) => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      updateStatus("OFFLINE");
      return false;
    }
    if (showReconnecting || statusRef.current !== "ONLINE") updateStatus("RECONNECTING");
    const reachable = await checkFirebaseReachability(force);
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      updateStatus("OFFLINE");
      return false;
    }
    updateStatus(reachable ? "ONLINE" : "CLOUD_UNAVAILABLE");
    return reachable;
  }, [updateStatus]);

  const assertCloudSyncAvailable = useCallback(async () => {
    try {
      await assertFirebaseReachable();
      updateStatus("ONLINE");
    } catch (error) {
      updateStatus(typeof navigator !== "undefined" && !navigator.onLine ? "OFFLINE" : "CLOUD_UNAVAILABLE");
      throw error;
    }

    if (!isCloudSyncActive()) {
      throw new Error("Dukan Yantra cloud sync is not active. Sign in again before saving this change.");
    }
  }, [updateStatus]);

  useEffect(() => {
    const handleOffline = () => updateStatus("OFFLINE");
    const handleOnline = () => { void checkConnectivity(true, true); };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void checkConnectivity();
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibility);
    void checkConnectivity(true, true);
    const interval = window.setInterval(() => { void checkConnectivity(); }, 30_000);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.clearInterval(interval);
    };
  }, [checkConnectivity, updateStatus]);

  return (
    <ConnectivityContext.Provider value={{ status, checkConnectivity: () => checkConnectivity(true, true), assertCloudSyncAvailable }}>
      {children}
    </ConnectivityContext.Provider>
  );
}

export function useConnectivity(): ConnectivityContextValue {
  const context = useContext(ConnectivityContext);
  if (!context) throw new Error("useConnectivity must be used within a ConnectivityProvider.");
  return context;
}

export function ConnectivityBanner() {
  const { status } = useConnectivity();
  if (status === "ONLINE") return null;

  const content = {
    OFFLINE: {
      title: "OFFLINE",
      message: "Internet access is unavailable. Cloud-dependent billing, sales, customer, and inventory changes are paused.",
      classes: "border-rose-300 bg-rose-700 text-white",
    },
    RECONNECTING: {
      title: "RECONNECTING",
      message: "Verifying the Firebase cloud connection. Cloud-dependent changes remain paused until it is confirmed.",
      classes: "border-amber-300 bg-amber-100 text-amber-950",
    },
    CLOUD_UNAVAILABLE: {
      title: "CLOUD UNAVAILABLE",
      message: "Internet access is available, but Firebase cannot be reached. Cloud-dependent changes are paused.",
      classes: "border-amber-300 bg-amber-100 text-amber-950",
    },
    ONLINE: {
      title: "ONLINE",
      message: "",
      classes: "",
    },
  }[status];

  return (
    <div role="status" aria-live="polite" className={`sticky top-0 z-[70] border-b px-4 py-2.5 text-sm ${content.classes}`}>
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-2 gap-y-1">
        <strong className="font-bold tracking-wide">{content.title}</strong>
        <span>{content.message}</span>
      </div>
    </div>
  );
}
