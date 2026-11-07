import { afterEach, describe, expect, it } from "vitest";
import {
  clearScannerPreference, readScannerPreference, writeScannerPreference,
} from "./barcodeScanning";
import { readPrivacyConsent, writePrivacyConsent } from "./privacyConsent";

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const storage = new Map<string, string>();
const storageApi = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
};

afterEach(() => {
  storage.clear();
  if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
  else Reflect.deleteProperty(globalThis, "window");
});

describe("privacy storage choices", () => {
  it("persists only the consent choice as a necessary record", () => {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { localStorage: storageApi },
    });

    expect(writePrivacyConsent(false)).toMatchObject({ optionalStorage: false });
    expect(readPrivacyConsent()).toMatchObject({ optionalStorage: false });
    expect(readScannerPreference(false)).toBeNull();
    expect(writeScannerPreference("camera", false)).toBe(false);
    expect(readScannerPreference(false)).toBeNull();
  });

  it("stores, reads, and removes scanner preference only after consent", () => {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { localStorage: storageApi },
    });

    expect(writeScannerPreference("camera", true)).toBe(true);
    expect(readScannerPreference(true)).toBe("camera");
    expect(clearScannerPreference()).toBe(true);
    expect(readScannerPreference(true)).toBeNull();
  });
});
