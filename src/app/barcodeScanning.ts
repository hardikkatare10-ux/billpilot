export type DeviceType = "phone" | "tablet" | "laptop" | "desktop";

export interface DeviceProfile {
  type: DeviceType;
  label: string;
  isMobileOrTablet: boolean;
  hasTouchInput: boolean;
  cameraSupported: boolean;
  cameraSecureContext: boolean;
}

type NavigatorWithHints = Navigator & {
  userAgentData?: { mobile?: boolean; platform?: string; model?: string };
  getBattery?: () => Promise<unknown>;
};

export function detectDeviceProfile(
  browserNavigator: NavigatorWithHints = navigator,
  secureContext = typeof window !== "undefined" && window.isSecureContext,
  coarsePointer = typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches,
): DeviceProfile {
  const userAgent = browserNavigator.userAgent || "";
  const platform = browserNavigator.userAgentData?.platform || browserNavigator.platform || "";
  const touchPoints = browserNavigator.maxTouchPoints || 0;
  const hasTouchInput = touchPoints > 0 || coarsePointer;
  const phone = browserNavigator.userAgentData?.mobile === true ||
    /iPhone|iPod|Android.*Mobile|Windows Phone/i.test(userAgent);
  const tablet = !phone && (
    /iPad|Tablet|Android(?!.*Mobile)/i.test(userAgent) ||
    (platform === "MacIntel" && touchPoints > 1)
  );
  const type: DeviceType = phone
    ? "phone"
    : tablet
      ? "tablet"
      : typeof browserNavigator.getBattery === "function" || touchPoints > 0
        ? "laptop"
        : "desktop";
  const cameraSecureContext = secureContext;
  const cameraSupported = cameraSecureContext &&
    typeof browserNavigator.mediaDevices?.getUserMedia === "function";

  return {
    type,
    label: type === "phone" ? "Mobile phone"
      : type === "tablet" ? "Tablet"
        : type === "laptop" ? "Laptop (estimated)"
          : "Desktop (estimated)",
    isMobileOrTablet: phone || tablet,
    hasTouchInput,
    cameraSupported,
    cameraSecureContext,
  };
}

export class ScanDeduplicator {
  private lastValue = "";
  private lastAcceptedAt = 0;

  constructor(private readonly intervalMs = 180) {}

  shouldAccept(value: string, now = Date.now()): boolean {
    const normalized = value.trim();
    if (!normalized) return false;
    if (normalized === this.lastValue && now - this.lastAcceptedAt < this.intervalMs) return false;
    this.lastValue = normalized;
    this.lastAcceptedAt = now;
    return true;
  }
}

export type ScannerMethod = "camera" | "keyboard";

const OPTIONAL_SCANNER_PREFERENCE_KEY = "billpilot_optional_scanner_preference";

export function readScannerPreference(optionalStorageAllowed: boolean): ScannerMethod | null {
  if (!optionalStorageAllowed || typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(OPTIONAL_SCANNER_PREFERENCE_KEY);
    return value === "camera" || value === "keyboard" ? value : null;
  } catch {
    return null;
  }
}

export function writeScannerPreference(
  method: ScannerMethod,
  optionalStorageAllowed: boolean,
): boolean {
  if (!optionalStorageAllowed || typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(OPTIONAL_SCANNER_PREFERENCE_KEY, method);
    return true;
  } catch {
    return false;
  }
}

export function clearScannerPreference(): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.removeItem(OPTIONAL_SCANNER_PREFERENCE_KEY);
    return true;
  } catch {
    return false;
  }
}
