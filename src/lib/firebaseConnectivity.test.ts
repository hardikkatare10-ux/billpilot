import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const firestoreMocks = vi.hoisted(() => ({
  doc: vi.fn((...parts: unknown[]) => parts),
  getDocFromServer: vi.fn(),
}));

vi.mock("./firebase", () => ({ db: {}, isFirebaseConfigured: true }));
vi.mock("firebase/firestore", () => firestoreMocks);

beforeEach(() => {
  firestoreMocks.doc.mockClear();
  firestoreMocks.getDocFromServer.mockReset();
  vi.stubGlobal("navigator", { onLine: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function loadConnectivity() {
  vi.resetModules();
  return import("./firebaseConnectivity");
}

describe("Firebase connectivity probe", () => {
  it("uses a server-only read of the existing health-check path", async () => {
    firestoreMocks.getDocFromServer.mockResolvedValue({ exists: () => false });
    const { checkFirebaseReachability } = await loadConnectivity();

    await expect(checkFirebaseReachability()).resolves.toBe(true);
    expect(firestoreMocks.doc).toHaveBeenCalledWith({}, "test", "connectivity");
    expect(firestoreMocks.getDocFromServer).toHaveBeenCalledTimes(1);
  });

  it("distinguishes browser disconnection without making a Firebase request", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    const { assertFirebaseReachable, checkFirebaseReachability } = await loadConnectivity();

    await expect(checkFirebaseReachability()).resolves.toBe(false);
    await expect(assertFirebaseReachable()).rejects.toThrow(/Internet connectivity is unavailable/);
    expect(firestoreMocks.getDocFromServer).not.toHaveBeenCalled();
  });

  it("blocks a write if the browser goes offline during the server probe", async () => {
    firestoreMocks.getDocFromServer.mockImplementation(async () => {
      vi.stubGlobal("navigator", { onLine: false });
      return { exists: () => false };
    });
    const { assertFirebaseReachable } = await loadConnectivity();

    await expect(assertFirebaseReachable()).rejects.toThrow(/Internet connectivity is unavailable/);
    expect(firestoreMocks.getDocFromServer).toHaveBeenCalledTimes(1);
  });

  it("reports Firebase transport failures as cloud unavailable", async () => {
    firestoreMocks.getDocFromServer.mockRejectedValue({ code: "unavailable" });
    const { checkFirebaseReachability } = await loadConnectivity();

    await expect(checkFirebaseReachability()).resolves.toBe(false);
  });

  it("treats a server authorization response as proof that Firebase is reachable", async () => {
    firestoreMocks.getDocFromServer.mockRejectedValue({ code: "firestore/permission-denied" });
    const { checkFirebaseReachability } = await loadConnectivity();

    await expect(checkFirebaseReachability()).resolves.toBe(true);
  });
});
