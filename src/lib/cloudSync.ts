/**
 * Cloud sync for BillPilot.
 *
 * localStorage stays the source of truth while the app runs (so billing keeps working offline).
 * Every `billpro_*` key is mirrored to Firestore under  users/{uid}/kv/{key}.
 *  - On sign-in:  hydrateFromCloud() pulls remote data into localStorage BEFORE the app mounts.
 *  - On change:   queuePush() writes the key to Firestore (debounced).
 *
 * Firestore documents are limited to 1 MiB, so large values (e.g. thousands of invoices) are split
 * into chunks:  {key}  holds part 0 and metadata,  {key}~1, {key}~2 ... hold the remaining parts.
 */
import {
  collection,
  doc,
  getDocs,
  writeBatch,
  deleteDoc,
  waitForPendingWrites,
} from "firebase/firestore";
import { db } from "./firebase";

const SYNC_PREFIX = "billpro_";
const META_KEY = "bp_sync_meta"; // { [key]: lastModifiedMs } — deliberately NOT prefixed, never synced
const CHUNK_SIZE = 240_000; // characters; keeps every document safely under 1 MiB
const DEBOUNCE_MS = 800;

let activeUid: string | null = null;
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const pending = new Map<string, string | null>(); // key -> serialized value (null = deleted)
const knownChunkCounts = new Map<string, number>();

const encodeKey = (k: string) => k.replace(/[/~]/g, "_");
const isSyncKey = (k: string) => k.startsWith(SYNC_PREFIX);

function readMeta(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(META_KEY) || "{}"); } catch { return {}; }
}
function writeMeta(meta: Record<string, number>) {
  try { localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch { /* noop */ }
}
function touchMeta(key: string, t: number) {
  const meta = readMeta();
  meta[key] = t;
  writeMeta(meta);
}

const kvCol = (uid: string) => collection(db!, "users", uid, "kv");

async function pushKey(uid: string, key: string, serialized: string | null, t: number) {
  if (!db) return;
  const id = encodeKey(key);
  const batch = writeBatch(db);
  const prevN = knownChunkCounts.get(key) ?? 1;

  if (serialized === null) {
    batch.delete(doc(kvCol(uid), id));
    for (let i = 1; i < prevN; i++) batch.delete(doc(kvCol(uid), `${id}~${i}`));
    knownChunkCounts.delete(key);
  } else {
    const parts: string[] = [];
    for (let i = 0; i < serialized.length; i += CHUNK_SIZE) parts.push(serialized.slice(i, i + CHUNK_SIZE));
    if (parts.length === 0) parts.push("");
    batch.set(doc(kvCol(uid), id), { key, t, n: parts.length, p: parts[0] });
    for (let i = 1; i < parts.length; i++) batch.set(doc(kvCol(uid), `${id}~${i}`), { p: parts[i] });
    for (let i = parts.length; i < prevN; i++) batch.delete(doc(kvCol(uid), `${id}~${i}`));
    knownChunkCounts.set(key, parts.length);
  }
  await batch.commit();
}

/** Call whenever a synced key changes. Safe to call when sync is off (does nothing). */
export function queuePush(key: string, value: unknown | undefined) {
  if (!activeUid || !db || !isSyncKey(key)) return;
  const serialized = value === undefined ? null : JSON.stringify(value);
  const t = Date.now();
  touchMeta(key, t);
  pending.set(key, serialized);
  const existing = timers.get(key);
  if (existing) clearTimeout(existing);
  const uid = activeUid;
  timers.set(
    key,
    setTimeout(() => {
      timers.delete(key);
      const v = pending.get(key);
      pending.delete(key);
      if (v === undefined) return;
      pushKey(uid, key, v, t).catch((e) => console.warn("[cloudSync] push failed:", key, e));
    }, DEBOUNCE_MS)
  );
}

/** Push anything still waiting on a debounce timer right now. */
async function flushDebounced() {
  const uid = activeUid;
  if (!uid) return;
  const jobs: Promise<void>[] = [];
  for (const [key, timer] of timers) {
    clearTimeout(timer);
    timers.delete(key);
    const v = pending.get(key);
    pending.delete(key);
    if (v === undefined) continue;
    jobs.push(pushKey(uid, key, v, readMeta()[key] ?? Date.now()));
  }
  await Promise.all(jobs);
}

/**
 * Make sure everything has reached the server. Returns false if it could not finish in time
 * (usually: no internet) so the caller can warn before wiping local data.
 */
export async function flushPending(timeoutMs = 6000): Promise<boolean> {
  if (!db || !activeUid) return true;
  try {
    await Promise.race([
      (async () => { await flushDebounced(); await waitForPendingWrites(db!); })(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), timeoutMs)),
    ]);
    return true;
  } catch {
    return false;
  }
}

/** Pull the user's cloud data into localStorage, merge by last-modified time, upload local-only data. */
export async function hydrateFromCloud(uid: string): Promise<void> {
  if (!db) return;
  activeUid = uid;

  const snap = await getDocs(kvCol(uid));
  const mains = new Map<string, { key: string; t: number; n: number; p: string }>();
  const extras = new Map<string, Map<number, string>>();

  snap.forEach((d) => {
    const data = d.data() as any;
    const m = d.id.match(/^(.*)~(\d+)$/);
    if (m) {
      const base = m[1];
      if (!extras.has(base)) extras.set(base, new Map());
      extras.get(base)!.set(Number(m[2]), data.p ?? "");
    } else {
      mains.set(d.id, { key: data.key, t: data.t ?? 0, n: data.n ?? 1, p: data.p ?? "" });
    }
  });

  const meta = readMeta();
  const remoteKeys = new Set<string>();

  for (const [id, main] of mains) {
    const key = main.key;
    if (!key || !isSyncKey(key)) continue;
    let text = main.p;
    let complete = true;
    for (let i = 1; i < main.n; i++) {
      const part = extras.get(id)?.get(i);
      if (part === undefined) { complete = false; break; }
      text += part;
    }
    if (!complete) continue; // never apply a half-downloaded value
    remoteKeys.add(key);
    knownChunkCounts.set(key, main.n);

    const localRaw = localStorage.getItem(key);
    const localT = meta[key] ?? 0;
    if (localRaw === null || main.t > localT) {
      if (localRaw !== null && localRaw !== text && meta[key] === undefined) {
        // Pre-Firebase local data that differs from the cloud copy: keep it, don't destroy it.
        try { localStorage.setItem(`bp_preSync_${key}`, localRaw); } catch { /* noop */ }
      }
      try { localStorage.setItem(key, text); meta[key] = main.t; } catch { /* quota */ }
    }
  }

  // Local data the cloud doesn't have (first sign-in on a device that already had data).
  const uploads: Promise<void>[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !isSyncKey(key)) continue;
    const raw = localStorage.getItem(key);
    if (raw === null) continue;
    const remoteMissing = !remoteKeys.has(key);
    const localNewer = (meta[key] ?? 0) > (mains.get(encodeKey(key))?.t ?? 0);
    if (remoteMissing || localNewer) {
      const t = meta[key] ?? Date.now();
      meta[key] = t;
      uploads.push(pushKey(uid, key, raw, t).catch((e) => console.warn("[cloudSync] upload failed:", key, e)));
    }
  }
  writeMeta(meta);
  await Promise.all(uploads);
}

/** Remove this device's copy of the business data (used on sign-out; data stays safe in the cloud). */
export function clearLocalBusinessData() {
  const toRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && (isSyncKey(k) || k.startsWith("bp_") || k === "billpilot_local_account")) toRemove.push(k);
  }
  toRemove.forEach((k) => localStorage.removeItem(k));
}

export function stopSync() {
  timers.forEach((t) => clearTimeout(t));
  timers.clear();
  pending.clear();
  knownChunkCounts.clear();
  activeUid = null;
}

/** Delete ALL of this user's cloud business data (used by "reset all data"). */
export async function wipeCloudData(): Promise<void> {
  if (!db || !activeUid) return;
  const uid = activeUid;
  stopSync();
  const snap = await getDocs(kvCol(uid));
  const ops: Promise<void>[] = [];
  snap.forEach((d) => ops.push(deleteDoc(d.ref)));
  await Promise.all(ops);
  activeUid = null;
}

export const isCloudSyncActive = () => activeUid !== null;
