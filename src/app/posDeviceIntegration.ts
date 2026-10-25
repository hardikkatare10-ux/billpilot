export interface PosDeviceInfo {
  id: string;
  label: string;
  connectionType: "usb" | "hid" | "serial" | "unknown";
  productName?: string;
  vendorId?: number;
  productId?: number;
  serialNumber?: string;
  connected: boolean;
}

const normalizeLabel = (value?: string | null, fallback = "POS Device") => {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  return fallback;
};

const buildDevice = (raw: unknown, connectionType: PosDeviceInfo["connectionType"]): PosDeviceInfo | null => {
  if (!raw || typeof raw !== "object") return null;

  const device = raw as Record<string, unknown>;
  const productName = typeof device.productName === "string" ? device.productName : undefined;
  const serialNumber = typeof device.serialNumber === "string" ? device.serialNumber : undefined;
  const vendorId = typeof device.vendorId === "number" ? device.vendorId : undefined;
  const productId = typeof device.productId === "number" ? device.productId : undefined;

  return {
    id: `${connectionType}-${productId ?? vendorId ?? Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    label: normalizeLabel(productName, `${connectionType.toUpperCase()} POS Device`),
    connectionType,
    productName,
    vendorId,
    productId,
    serialNumber,
    connected: true,
  };
};

export const discoverPosDevices = async (): Promise<PosDeviceInfo[]> => {
  if (typeof navigator === "undefined") return [];

  const devices: PosDeviceInfo[] = [];

  const usbApi = (navigator as Navigator & { usb?: { getDevices: () => Promise<unknown[]> } }).usb;
  if (usbApi?.getDevices) {
    try {
      const usbDevices = await usbApi.getDevices();
      usbDevices.forEach((device) => {
        const parsed = buildDevice(device, "usb");
        if (parsed) devices.push(parsed);
      });
    } catch {
      // Ignore and continue.
    }
  }

  const hidApi = (navigator as Navigator & { hid?: { getDevices: () => Promise<unknown[]> } }).hid;
  if (hidApi?.getDevices) {
    try {
      const hidDevices = await hidApi.getDevices();
      hidDevices.forEach((device) => {
        const parsed = buildDevice(device, "hid");
        if (parsed) devices.push(parsed);
      });
    } catch {
      // Ignore and continue.
    }
  }

  return devices;
};

export const connectPosDevice = async (device: PosDeviceInfo): Promise<PosDeviceInfo> => {
  if (device.connectionType === "usb") {
    const usbApi = (navigator as Navigator & { usb?: { requestDevice: (options?: unknown) => Promise<unknown> } }).usb;
    if (usbApi?.requestDevice) {
      try {
        const selected = await usbApi.requestDevice({ filters: [] });
        return {
          ...device,
          connected: Boolean(selected),
          label: normalizeLabel((selected as Record<string, unknown>)?.productName as string | undefined, device.label),
        };
      } catch {
        return { ...device, connected: false };
      }
    }
  }

  if (device.connectionType === "hid") {
    const hidApi = (navigator as Navigator & { hid?: { requestDevice: (options?: unknown) => Promise<unknown> } }).hid;
    if (hidApi?.requestDevice) {
      try {
        const selected = await hidApi.requestDevice({ filters: [] });
        return {
          ...device,
          connected: Boolean(selected),
          label: normalizeLabel((selected as Record<string, unknown>)?.productName as string | undefined, device.label),
        };
      } catch {
        return { ...device, connected: false };
      }
    }
  }

  return { ...device, connected: true };
};
