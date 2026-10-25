import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { discoverPosDevices } from "./posDeviceIntegration";

describe("discoverPosDevices", () => {
  const originalNavigator = globalThis.navigator;

  beforeEach(() => {
    Object.defineProperty(globalThis, "navigator", {
      value: { ...originalNavigator },
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "navigator", {
      value: originalNavigator,
      configurable: true,
    });
  });

  it("returns no devices when browser POS APIs are unavailable", async () => {
    const nav = globalThis.navigator as Navigator & { usb?: unknown; hid?: unknown };
    delete (nav as Record<string, unknown>).usb;
    delete (nav as Record<string, unknown>).hid;

    await expect(discoverPosDevices()).resolves.toEqual([]);
  });

  it("returns USB and HID devices when supported", async () => {
    const usbDevice = { productName: "USB POS Terminal", vendorId: 1, productId: 2 };
    const hidDevice = { productName: "HID POS Terminal", productId: 3 };

    const nav = globalThis.navigator as Navigator & {
      usb?: { getDevices: () => Promise<unknown[]> };
      hid?: { getDevices: () => Promise<unknown[]> };
    };

    nav.usb = { getDevices: vi.fn().mockResolvedValue([usbDevice]) };
    nav.hid = { getDevices: vi.fn().mockResolvedValue([hidDevice]) };

    const devices = await discoverPosDevices();

    expect(devices).toHaveLength(2);
    expect(devices[0]).toMatchObject({ connectionType: "usb", label: "USB POS Terminal" });
    expect(devices[1]).toMatchObject({ connectionType: "hid", label: "HID POS Terminal" });
  });
});
