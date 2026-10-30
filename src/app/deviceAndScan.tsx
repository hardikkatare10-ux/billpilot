// deviceAndScan.tsx
// Device detection, first-run setup (device + cookies/local storage + camera permission),
// camera barcode scanner and hardware-scanner (keyboard wedge) support.
//
// Camera scanning uses the native BarcodeDetector API (Chrome/Edge/Android) and falls back to
// ZXing (loaded from a CDN at runtime, only when needed) for iOS Safari / Firefox.
// No npm package needs to be installed.
import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Laptop, Smartphone, ShieldCheck, X, ScanLine, RefreshCw } from "lucide-react";

/* ───────────────────────── Storage keys ───────────────────────── */
const DEVICE_KEY = "billpilot_device_type";       // "desktop" | "mobile"
const CONSENT_KEY = "billpilot_storage_consent";  // "granted" | "declined"
const CAMERA_KEY = "billpilot_camera_permission"; // "granted" | "denied" | "skipped"
const COOKIE_NAME = "billpilot_consent";

export type DeviceType = "desktop" | "mobile";

/* ───────────────────────── Safe storage helpers ───────────────────────── */
const lsGet = (k: string): string | null => {
  try { return localStorage.getItem(k); } catch { return null; }
};
const lsSet = (k: string, v: string) => {
  try { localStorage.setItem(k, v); } catch { /* storage blocked */ }
};

export const setConsentCookie = (value: "granted" | "declined") => {
  try {
    const maxAge = 60 * 60 * 24 * 365;
    const secure = typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${COOKIE_NAME}=${value}; max-age=${maxAge}; path=/; SameSite=Lax${secure}`;
  } catch { /* cookies blocked */ }
};

export const hasConsentCookie = (): boolean => {
  try { return document.cookie.split("; ").some((c) => c.startsWith(`${COOKIE_NAME}=`)); } catch { return false; }
};

/* ───────────────────────── Device detection ───────────────────────── */
/** Best-guess device type from user agent, touch support and screen size. */
export function detectDeviceType(): DeviceType {
  if (typeof navigator === "undefined" || typeof window === "undefined") return "desktop";
  const ua = navigator.userAgent || "";
  const uaMobile = /Android|iPhone|iPad|iPod|Mobile|Tablet|Silk|Kindle|BlackBerry|Opera Mini|IEMobile/i.test(ua);
  // iPadOS 13+ reports itself as a Mac but has touch points
  const iPadOs = /Macintosh/i.test(ua) && (navigator.maxTouchPoints || 0) > 1;
  const coarse = typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
  const narrow = window.innerWidth < 900;
  if (uaMobile || iPadOs) return "mobile";
  if (coarse && narrow) return "mobile";
  return "desktop";
}

/** Returns the confirmed device type (user's choice wins over auto-detection). */
export function useDeviceType(): { device: DeviceType; isMobile: boolean; setDevice: (d: DeviceType) => void } {
  const [device, setDeviceState] = useState<DeviceType>(() => {
    const saved = lsGet(DEVICE_KEY);
    return saved === "desktop" || saved === "mobile" ? saved : detectDeviceType();
  });

  useEffect(() => {
    const onChange = (e: Event) => {
      const next = (e as CustomEvent<DeviceType>).detail;
      if (next === "desktop" || next === "mobile") setDeviceState(next);
    };
    window.addEventListener("billpilot-device-change", onChange);
    return () => window.removeEventListener("billpilot-device-change", onChange);
  }, []);

  const setDevice = useCallback((d: DeviceType) => {
    lsSet(DEVICE_KEY, d);
    setDeviceState(d);
    window.dispatchEvent(new CustomEvent("billpilot-device-change", { detail: d }));
  }, []);

  return { device, isMobile: device === "mobile", setDevice };
}

/* ───────────────────────── Camera permission ───────────────────────── */
export type CameraPermission = "granted" | "denied" | "prompt" | "unsupported";

export async function queryCameraPermission(): Promise<CameraPermission> {
  if (!navigator.mediaDevices?.getUserMedia) return "unsupported";
  try {
    const status = await (navigator.permissions as Permissions | undefined)?.query({ name: "camera" as PermissionName });
    if (status) return status.state as CameraPermission;
  } catch { /* Safari/Firefox do not support camera in permissions.query */ }
  return (lsGet(CAMERA_KEY) as CameraPermission | null) === "granted" ? "granted" : "prompt";
}

/** Triggers the browser's camera permission dialog, then releases the camera again. */
export async function requestCameraPermission(): Promise<CameraPermission> {
  if (!navigator.mediaDevices?.getUserMedia) return "unsupported";
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
    stream.getTracks().forEach((t) => t.stop());
    lsSet(CAMERA_KEY, "granted");
    return "granted";
  } catch (err) {
    const name = (err as DOMException)?.name;
    if (name === "NotAllowedError" || name === "SecurityError" || name === "PermissionDeniedError") {
      lsSet(CAMERA_KEY, "denied");
      return "denied";
    }
    return "unsupported"; // NotFoundError etc.
  }
}

/* ───────────────────────── Hardware scanner (keyboard wedge) ───────────────────────── */
/**
 * USB / Bluetooth barcode scanners type the code very fast and finish with Enter.
 * This listens globally (when no text field is focused) and reports complete scans.
 * Works on both PC and mobile/tablet (Bluetooth scanners paired as keyboards).
 */
export function useHardwareScanner(onScan: (code: string) => void, enabled = true) {
  const handlerRef = useRef(onScan);
  handlerRef.current = onScan;

  useEffect(() => {
    if (!enabled) return;
    let buffer = "";
    let lastTime = 0;

    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
      if (typing || e.ctrlKey || e.metaKey || e.altKey) return;

      const now = Date.now();
      if (now - lastTime > 60) buffer = ""; // slow typing = human, restart buffer
      lastTime = now;

      if (e.key === "Enter") {
        if (buffer.length >= 4) {
          const code = buffer;
          buffer = "";
          e.preventDefault();
          handlerRef.current(code);
        }
        buffer = "";
        return;
      }
      if (e.key.length === 1) buffer += e.key;
    };

    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [enabled]);
}

/* ───────────────────────── ZXing fallback (runtime CDN load, no npm needed) ───────────────────────── */
const ZXING_URL = "https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ZXingNS = any;
let zxingPromise: Promise<ZXingNS> | null = null;

function loadZXing(): Promise<ZXingNS> {
  const w = window as unknown as { ZXing?: ZXingNS };
  if (w.ZXing) return Promise.resolve(w.ZXing);
  if (!zxingPromise) {
    zxingPromise = new Promise((resolve, reject) => {
      const el = document.createElement("script");
      el.src = ZXING_URL;
      el.async = true;
      el.onload = () => (w.ZXing ? resolve(w.ZXing) : reject(new Error("ZXing missing")));
      el.onerror = () => { zxingPromise = null; reject(new Error("ZXing failed to load")); };
      document.head.appendChild(el);
    });
  }
  return zxingPromise;
}

/** Decodes frames from a <video> with ZXing; returns a stop() function. */
async function startZXingDecoding(video: HTMLVideoElement, onCode: (code: string) => void): Promise<() => void> {
  const Z = await loadZXing();
  const hints = new Map();
  hints.set(Z.DecodeHintType.POSSIBLE_FORMATS, [
    Z.BarcodeFormat.EAN_13, Z.BarcodeFormat.EAN_8, Z.BarcodeFormat.UPC_A, Z.BarcodeFormat.UPC_E,
    Z.BarcodeFormat.CODE_128, Z.BarcodeFormat.CODE_39, Z.BarcodeFormat.CODE_93, Z.BarcodeFormat.ITF,
    Z.BarcodeFormat.CODABAR, Z.BarcodeFormat.QR_CODE, Z.BarcodeFormat.DATA_MATRIX,
  ]);
  hints.set(Z.DecodeHintType.TRY_HARDER, true);
  const reader = new Z.MultiFormatReader();
  reader.setHints(hints);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true } as CanvasRenderingContext2DSettings);
  const timer = window.setInterval(() => {
    if (!ctx || video.readyState < 2 || !video.videoWidth) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    try {
      const bitmap = new Z.BinaryBitmap(new Z.HybridBinarizer(new Z.HTMLCanvasElementLuminanceSource(canvas)));
      const result = reader.decode(bitmap);
      if (result) onCode(result.getText());
    } catch { /* no code in this frame */ }
  }, 140);
  return () => window.clearInterval(timer);
}

/* ───────────────────────── Camera scanner modal ───────────────────────── */
type DetectorLike = { detect: (src: CanvasImageSource) => Promise<Array<{ rawValue: string }>> };

const BARCODE_FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "code_93", "itf", "codabar", "qr_code", "data_matrix"];

export function CameraScannerModal({
  open, onClose, onDetected, title = "Scan barcode / QR", keepOpen = false,
}: {
  open: boolean;
  onClose: () => void;
  onDetected: (code: string) => void;
  title?: string;
  /** keepOpen: stay open after a scan for continuous billing */
  keepOpen?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const zxingControlsRef = useRef<{ stop: () => void } | null>(null);
  const lastRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;
  const keepOpenRef = useRef(keepOpen);
  keepOpenRef.current = keepOpen;

  const [status, setStatus] = useState<"starting" | "scanning" | "denied" | "error">("starting");
  const [message, setMessage] = useState("");
  const [manual, setManual] = useState("");
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const stopAll = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    try { zxingControlsRef.current?.stop(); } catch { /* noop */ }
    zxingControlsRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const handleResult = useCallback((raw: string) => {
    const code = raw.trim();
    if (!code) return;
    const now = Date.now();
    if (code === lastRef.current.code && now - lastRef.current.at < 1800) return; // de-bounce repeats
    lastRef.current = { code, at: now };
    try { navigator.vibrate?.(60); } catch { /* noop */ }
    onDetectedRef.current(code);
    if (!keepOpenRef.current) onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setStatus("starting");
    setMessage("");
    setTorchOn(false);
    setTorchSupported(false);

    const start = async () => {
      if (!window.isSecureContext) {
        setStatus("error");
        setMessage("Camera needs a secure (https) connection. Use manual entry below.");
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus("error");
        setMessage("This browser cannot access the camera. Use manual entry below.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        lsSet(CAMERA_KEY, "granted");

        const track = stream.getVideoTracks()[0];
        const caps = (track?.getCapabilities?.() ?? {}) as MediaTrackCapabilities & { torch?: boolean };
        setTorchSupported(!!caps.torch);

        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        video.setAttribute("playsinline", "true");
        await video.play().catch(() => undefined);
        if (cancelled) return;
        setStatus("scanning");

        const BD = (window as unknown as { BarcodeDetector?: new (o?: { formats?: string[] }) => DetectorLike & { constructor: { getSupportedFormats?: () => Promise<string[]> } } }).BarcodeDetector;
        if (BD) {
          let formats = BARCODE_FORMATS;
          try {
            const supported = await (BD as unknown as { getSupportedFormats: () => Promise<string[]> }).getSupportedFormats();
            formats = BARCODE_FORMATS.filter((f) => supported.includes(f));
          } catch { /* use defaults */ }
          const detector = new BD({ formats });
          let busy = false;
          const tick = async () => {
            if (cancelled) return;
            if (!busy && video.readyState >= 2) {
              busy = true;
              try {
                const found = await detector.detect(video);
                if (found.length && !cancelled) handleResult(found[0].rawValue);
              } catch { /* frame not ready */ }
              busy = false;
            }
            rafRef.current = requestAnimationFrame(tick);
          };
          rafRef.current = requestAnimationFrame(tick);
          return;
        }

        // Fallback: ZXing (iOS Safari, Firefox, older browsers) — loaded on demand
        try {
          const stop = await startZXingDecoding(video, (code) => { if (!cancelled) handleResult(code); });
          if (cancelled) { stop(); return; }
          zxingControlsRef.current = { stop };
        } catch {
          setMessage("Auto-detect needs internet on this browser. Use manual entry below.");
        }
      } catch (err) {
        if (cancelled) return;
        const name = (err as DOMException)?.name;
        if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError") {
          lsSet(CAMERA_KEY, "denied");
          setStatus("denied");
        } else if (name === "NotFoundError" || name === "OverconstrainedError") {
          setStatus("error");
          setMessage("No camera found on this device.");
        } else {
          setStatus("error");
          setMessage("Could not start the camera. Close other apps using it and try again.");
        }
      }
    };

    start();
    return () => { cancelled = true; stopAll(); };
  }, [open, facing, attempt, handleResult, stopAll]);

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !torchOn } as MediaTrackConstraintSet] });
      setTorchOn((v) => !v);
    } catch { /* torch not controllable */ }
  };

  if (!open) return null;

  return (
    <div data-camera-scanner="true" className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="w-full sm:max-w-md bg-card rounded-t-2xl sm:rounded-2xl overflow-hidden shadow-2xl border border-border">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2 font-semibold text-foreground text-sm"><ScanLine className="w-4 h-4" /> {title}</div>
          <button onClick={onClose} aria-label="Close scanner" className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>

        <div className="relative bg-black aspect-[4/3]">
          <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
          {status === "scanning" && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-3/4 h-1/2 rounded-xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)] relative overflow-hidden">
                <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-red-500/90" />
              </div>
            </div>
          )}
          {status === "starting" && <div className="absolute inset-0 flex items-center justify-center text-white/80 text-sm">Starting camera…</div>}
          {status === "denied" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-5 text-center text-white text-sm bg-black/80">
              <Camera className="w-8 h-8 opacity-80" />
              <p className="font-semibold">Camera permission is blocked</p>
              <p className="text-white/75 text-xs">Tap the lock/tune icon in the address bar → Site settings → allow Camera, then press Retry.</p>
              <button onClick={() => setAttempt((n) => n + 1)} className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-black text-xs font-semibold"><RefreshCw className="w-3.5 h-3.5" /> Retry</button>
            </div>
          )}
          {status === "error" && (
            <div className="absolute inset-0 flex items-center justify-center p-5 text-center text-white/90 text-sm bg-black/80">{message}</div>
          )}
        </div>

        <div className="p-4 space-y-3">
          {status === "scanning" && message && <p className="text-xs text-amber-600">{message}</p>}
          <div className="flex gap-2">
            <button onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))} className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-border text-xs text-muted-foreground hover:bg-muted">
              <RefreshCw className="w-3.5 h-3.5" /> Switch camera
            </button>
            {torchSupported && (
              <button onClick={toggleTorch} className={`flex-1 px-3 py-2 rounded-lg border text-xs ${torchOn ? "bg-amber-100 border-amber-300 text-amber-800" : "border-border text-muted-foreground hover:bg-muted"}`}>
                {torchOn ? "Torch on" : "Torch"}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <input
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && manual.trim()) { handleResult(manual); setManual(""); } }}
              placeholder="Or type / paste code"
              inputMode="text"
              className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <button onClick={() => { if (manual.trim()) { handleResult(manual); setManual(""); } }} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium">Add</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Small reusable camera button — renders only on mobile/tablet. */
export function CameraScanButton({
  onDetected, label = "Camera", title, keepOpen, className, alwaysShow = false,
}: {
  onDetected: (code: string) => void;
  label?: string;
  title?: string;
  keepOpen?: boolean;
  className?: string;
  alwaysShow?: boolean;
}) {
  const { isMobile } = useDeviceType();
  const [open, setOpen] = useState(false);
  if (!isMobile && !alwaysShow) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Scan with camera"
        title="Scan with camera"
        className={className || "inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground hover:bg-muted transition-colors"}
      >
        <Camera className="w-4 h-4" />
        {label && <span>{label}</span>}
      </button>
      <CameraScannerModal open={open} onClose={() => setOpen(false)} onDetected={onDetected} title={title} keepOpen={keepOpen} />
    </>
  );
}

/* ───────────────────────── First-run setup (device + cookies + camera) ───────────────────────── */
export function FirstRunSetup() {
  const { setDevice } = useDeviceType();
  const needsDevice = () => !(lsGet(DEVICE_KEY) === "desktop" || lsGet(DEVICE_KEY) === "mobile");
  const needsConsent = () => !(lsGet(CONSENT_KEY) === "granted" || lsGet(CONSENT_KEY) === "declined");

  const [visible, setVisible] = useState<boolean>(() => needsDevice() || needsConsent());
  const [step, setStep] = useState<"device" | "permissions">(() => (needsDevice() ? "device" : "permissions"));
  const [chosen, setChosen] = useState<DeviceType>(() => detectDeviceType());
  const [camera, setCamera] = useState<CameraPermission | "idle">("idle");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    queryCameraPermission().then((s) => { if (s === "granted") setCamera("granted"); });
  }, [visible]);

  if (!visible) return null;

  const finish = (consent: "granted" | "declined") => {
    lsSet(CONSENT_KEY, consent);
    setConsentCookie(consent);
    if (consent === "granted") {
      // Ask the browser not to evict bills / inventory stored locally
      try { void navigator.storage?.persist?.(); } catch { /* noop */ }
    }
    setVisible(false);
  };

  const allowCamera = async () => {
    setBusy(true);
    setCamera(await requestCameraPermission());
    setBusy(false);
  };

  const confirmDevice = () => {
    setDevice(chosen);
    if (needsConsent()) setStep("permissions");
    else setVisible(false);
  };

  const cardCls = (active: boolean) =>
    `flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border-2 text-sm font-medium transition-all ${active ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground hover:border-primary/40"}`;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Set up this device">
      <div className="w-full max-w-md bg-card rounded-2xl shadow-2xl border border-border overflow-hidden">
        {step === "device" ? (
          <div className="p-6 space-y-5">
            <div>
              <h2 className="text-lg font-bold text-foreground">Which device are you using?</h2>
              <p className="text-xs text-muted-foreground mt-1">We pre-selected the best guess. Mobile/Tablet unlocks camera barcode scanning.</p>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setChosen("desktop")} className={cardCls(chosen === "desktop")}>
                <Laptop className="w-7 h-7" /> PC / Laptop
              </button>
              <button type="button" onClick={() => setChosen("mobile")} className={cardCls(chosen === "mobile")}>
                <Smartphone className="w-7 h-7" /> Mobile / Tablet
              </button>
            </div>
            <button onClick={confirmDevice} className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90">Continue</button>
            <p className="text-[11px] text-muted-foreground text-center">Barcode scanners (USB / Bluetooth) work on both device types.</p>
          </div>
        ) : (
          <div className="p-6 space-y-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0"><ShieldCheck className="w-5 h-5" /></div>
              <div>
                <h2 className="text-lg font-bold text-foreground">Permissions</h2>
                <p className="text-xs text-muted-foreground mt-1">Allow BillPilot to keep your data on this device.</p>
              </div>
            </div>
            <div className="rounded-xl border border-border p-3 text-xs text-muted-foreground space-y-1.5">
              <p className="font-semibold text-foreground text-sm">Cookies &amp; local storage</p>
              <p>We store your login session, bills, inventory and settings in this browser (cookies + local storage) so the app works quickly and offline. Nothing is sold or shared.</p>
            </div>
            {chosen === "mobile" || lsGet(DEVICE_KEY) === "mobile" ? (
              <div className="rounded-xl border border-border p-3 text-xs text-muted-foreground space-y-2">
                <p className="font-semibold text-foreground text-sm">Camera (optional)</p>
                <p>Used only to scan product barcodes and QR codes. Images are never saved or uploaded.</p>
                {camera === "granted" ? (
                  <p className="text-emerald-600 font-medium">Camera allowed ✓</p>
                ) : camera === "denied" ? (
                  <p className="text-red-600">Camera blocked. You can enable it later from your browser's site settings.</p>
                ) : camera === "unsupported" ? (
                  <p className="text-amber-600">Camera isn't available here. You can still use a barcode scanner or type codes.</p>
                ) : (
                  <button onClick={allowCamera} disabled={busy} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-foreground text-xs font-semibold hover:bg-muted disabled:opacity-60">
                    <Camera className="w-3.5 h-3.5" /> {busy ? "Waiting…" : "Allow camera"}
                  </button>
                )}
              </div>
            ) : null}
            <div className="flex gap-2">
              <button onClick={() => finish("declined")} className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted">Not now</button>
              <button onClick={() => finish("granted")} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90">Accept &amp; continue</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
