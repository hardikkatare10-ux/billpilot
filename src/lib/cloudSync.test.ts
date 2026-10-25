import { describe, it, expect, beforeEach, vi } from "vitest";

// ---- in-memory fake of the bits of Firestore that cloudSync uses ----
const store = new Map<string, any>(); // path -> data
vi.mock("./firebase", () => ({ db: {} }));
vi.mock("firebase/firestore", () => {
  const collection = (_db: any, ...segs: string[]) => ({ path: segs.join("/") });
  const doc = (col: { path: string }, id: string) => ({ path: `${col.path}/${id}`, id });
  const makeBatch = () => {
    const ops: Array<() => void> = [];
    return {
      set: (ref: any, data: any) => ops.push(() => store.set(ref.path, data)),
      delete: (ref: any) => ops.push(() => store.delete(ref.path)),
      commit: async () => ops.forEach((o) => o()),
    };
  };
  return {
    collection,
    doc,
    writeBatch: () => makeBatch(),
    deleteDoc: async (ref: any) => { store.delete(ref.path); },
    waitForPendingWrites: async () => {},
    getDocs: async (col: { path: string }) => {
      const docs = [...store.entries()]
        .filter(([p]) => p.startsWith(col.path + "/"))
        .map(([p, data]) => ({ id: p.slice(col.path.length + 1), data: () => data, ref: { path: p } }));
      return { forEach: (fn: (d: any) => void) => docs.forEach(fn) };
    },
  };
});

// ---- localStorage stub ----
class MemStorage {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
}

import {
  hydrateFromCloud, queuePush, flushPending, stopSync, wipeCloudData, clearLocalBusinessData,
} from "./cloudSync";

beforeEach(() => {
  store.clear();
  stopSync();
  (globalThis as any).localStorage = new MemStorage();
});

describe("cloudSync", () => {
  it("uploads local-only data on first sign-in", async () => {
    localStorage.setItem("billpro_account_x_products", JSON.stringify([{ id: 1 }]));
    await hydrateFromCloud("u1");
    expect([...store.keys()].some((k) => k.endsWith("billpro_account_x_products"))).toBe(true);
  });

  it("round-trips a value larger than one chunk and restores it on a fresh device", async () => {
    await hydrateFromCloud("u1");
    const big = Array.from({ length: 6000 }, (_, i) => ({ id: i, note: "invoice line ₹" + "x".repeat(60) }));
    expect(JSON.stringify(big).length).toBeGreaterThan(240_000 * 2);

    queuePush("billpro_account_x_invoices", big);
    expect(await flushPending()).toBe(true);
    const chunkDocs = [...store.keys()].filter((k) => k.includes("billpro_account_x_invoices"));
    expect(chunkDocs.length).toBeGreaterThan(2);

    // brand-new device
    stopSync();
    (globalThis as any).localStorage = new MemStorage();
    await hydrateFromCloud("u1");
    expect(JSON.parse(localStorage.getItem("billpro_account_x_invoices")!)).toEqual(big);
  });

  it("removes leftover chunks when a value shrinks", async () => {
    await hydrateFromCloud("u1");
    const big = "y".repeat(600_000);
    queuePush("billpro_k", big);
    await flushPending();
    const before = [...store.keys()].filter((k) => k.includes("billpro_k")).length;
    queuePush("billpro_k", "small");
    await flushPending();
    const after = [...store.keys()].filter((k) => k.includes("billpro_k")).length;
    expect(before).toBeGreaterThan(1);
    expect(after).toBe(1);
  });

  it("cloud copy wins over older legacy local data, and the local copy is kept as a backup", async () => {
    store.set("users/u1/kv/billpro_p", { key: "billpro_p", t: 5000, n: 1, p: JSON.stringify("cloud") });
    localStorage.setItem("billpro_p", JSON.stringify("legacy-local"));
    await hydrateFromCloud("u1");
    expect(JSON.parse(localStorage.getItem("billpro_p")!)).toBe("cloud");
    expect(JSON.parse(localStorage.getItem("bp_preSync_billpro_p")!)).toBe("legacy-local");
  });

  it("does not apply a value whose chunks are incomplete", async () => {
    store.set("users/u1/kv/billpro_q", { key: "billpro_q", t: 1, n: 3, p: "abc" }); // parts 1,2 missing
    await hydrateFromCloud("u1");
    expect(localStorage.getItem("billpro_q")).toBeNull();
  });

  it("only syncs billpro_ keys", async () => {
    await hydrateFromCloud("u1");
    queuePush("something_else", 1);
    await flushPending();
    expect([...store.keys()].some((k) => k.includes("something_else"))).toBe(false);
  });

  it("wipeCloudData deletes everything for the user; clearLocalBusinessData clears the device", async () => {
    await hydrateFromCloud("u1");
    queuePush("billpro_a", 1);
    await flushPending();
    expect(store.size).toBeGreaterThan(0);
    await wipeCloudData();
    expect(store.size).toBe(0);

    localStorage.setItem("billpro_a", "1");
    localStorage.setItem("bp_sync_meta", "{}");
    localStorage.setItem("unrelated", "keep");
    clearLocalBusinessData();
    expect(localStorage.getItem("billpro_a")).toBeNull();
    expect(localStorage.getItem("bp_sync_meta")).toBeNull();
    expect(localStorage.getItem("unrelated")).toBe("keep");
  });
});
