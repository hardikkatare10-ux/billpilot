import { describe, expect, it } from "vitest";
import { detectDeviceProfile, ScanDeduplicator } from "./barcodeScanning";

const mediaDevices = { getUserMedia: () => Promise.resolve({} as MediaStream) };

describe("detectDeviceProfile", () => {
  it("uses mobile and tablet capabilities to select camera-eligible device types", () => {
    const phone = detectDeviceProfile({
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
      maxTouchPoints: 5,
      mediaDevices,
    } as unknown as Navigator, true, true);
    const tablet = detectDeviceProfile({
      userAgent: "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)",
      maxTouchPoints: 5,
      mediaDevices,
    } as unknown as Navigator, true, true);

    expect(phone).toMatchObject({ type: "phone", isMobileOrTablet: true, cameraSupported: true });
    expect(tablet).toMatchObject({ type: "tablet", isMobileOrTablet: true, cameraSupported: true });
  });

  it("disables camera scanning outside secure contexts or without getUserMedia", () => {
    const profile = detectDeviceProfile({
      userAgent: "Mozilla/5.0 (iPhone)",
      maxTouchPoints: 5,
    } as unknown as Navigator, false, true);

    expect(profile.cameraSupported).toBe(false);
    expect(profile.cameraSecureContext).toBe(false);
  });
});

describe("ScanDeduplicator", () => {
  it("rejects a repeated Enter submission in its short duplicate window but accepts later repeated scans", () => {
    const deduplicator = new ScanDeduplicator(180);

    expect(deduplicator.shouldAccept("  012345  ", 1000)).toBe(true);
    expect(deduplicator.shouldAccept("012345", 1100)).toBe(false);
    expect(deduplicator.shouldAccept("012345", 1200)).toBe(true);
    expect(deduplicator.shouldAccept("", 1300)).toBe(false);
  });
});
