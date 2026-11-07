import { useEffect, useRef, useState } from "react";
import { Camera, RefreshCw, X } from "lucide-react";
import { detectDeviceProfile } from "./barcodeScanning";

type CameraState = "idle" | "requesting" | "scanning" | "error";

function cameraErrorMessage(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
      return "Camera permission was denied. Allow camera access in your browser settings, then try again.";
    }
    if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
      return "No camera is available on this device.";
    }
    if (error.name === "NotReadableError" || error.name === "TrackStartError") {
      return "The camera is already in use by another app. Close it and retry.";
    }
  }
  return error instanceof Error ? `Could not start the camera: ${error.message}` : "Could not start the camera. Please retry.";
}

export function BarcodeCameraScanner({
  onDetected,
  onMethodSelected,
}: {
  onDetected: (code: string) => void;
  onMethodSelected?: (method: "camera" | "keyboard") => void;
}) {
  const device = detectDeviceProfile();
  const [open, setOpen] = useState(false);
  const [cameraState, setCameraState] = useState<CameraState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [cameraId, setCameraId] = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const onDetectedRef = useRef(onDetected);
  const openRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  const stopCamera = () => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  useEffect(() => {
    if (!open) stopCamera();
    return () => stopCamera();
  }, [open]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      openRef.current = false;
      stopCamera();
    };
  }, []);

  if (!device.isMobileOrTablet) return null;

  const startCamera = async (requestedCameraId = "") => {
    if (!device.cameraSupported) {
      setCameraState("error");
      setErrorMessage(device.cameraSecureContext
        ? "This browser does not support camera access."
        : "Camera scanning requires a secure HTTPS connection (localhost is supported).");
      return;
    }
    if (!videoRef.current) return;

    stopCamera();
    setCameraState("requesting");
    setErrorMessage("");
    try {
      const videoConstraints: MediaTrackConstraints = requestedCameraId
        ? { deviceId: { exact: requestedCameraId } }
        : { facingMode: { ideal: "environment" } };
      const stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints, audio: false });
      if (!mountedRef.current || !openRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      const { BarcodeFormat, BrowserMultiFormatReader } = await import("@zxing/browser");
      if (!mountedRef.current || !openRef.current || streamRef.current !== stream || !videoRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const reader = new BrowserMultiFormatReader();
      reader.possibleFormats = [
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.CODE_128,
      ];
      const controls = await reader.decodeFromStream(stream, videoRef.current, (result) => {
        if (!result || streamRef.current !== stream) return;
        const code = result.getText().trim();
        if (!code) return;
        controlsRef.current?.stop();
        stream.getTracks().forEach((track) => track.stop());
        controlsRef.current = null;
        streamRef.current = null;
        openRef.current = false;
        setCameraState("idle");
        setOpen(false);
        onDetectedRef.current(code);
      });
      if (streamRef.current !== stream) {
        controls.stop();
        return;
      }
      controlsRef.current = controls;
      setCameraState("scanning");

      const availableCameras = (await BrowserMultiFormatReader.listVideoInputDevices())
        .filter((deviceInfo) => deviceInfo.deviceId);
      if (!mountedRef.current || !openRef.current || streamRef.current !== stream) return;
      setCameras(availableCameras);
      const activeId = requestedCameraId ||
        availableCameras.find((item) => /back|rear|environment/i.test(item.label))?.deviceId ||
        stream.getVideoTracks()[0]?.getSettings().deviceId ||
        "";
      setCameraId(activeId);
    } catch (error) {
      stopCamera();
      if (!mountedRef.current || !openRef.current) return;
      setCameraState("error");
      setErrorMessage(cameraErrorMessage(error));
    }
  };

  const handleOpen = () => {
    onMethodSelected?.("camera");
    setErrorMessage("");
    setCameraState("idle");
    openRef.current = true;
    setOpen(true);
  };

  const handleClose = () => {
    openRef.current = false;
    stopCamera();
    setOpen(false);
    setCameraState("idle");
  };

  const switchCamera = () => {
    if (cameras.length < 2) return;
    const currentIndex = cameras.findIndex((camera) => camera.deviceId === cameraId);
    const nextCamera = cameras[(currentIndex + 1) % cameras.length];
    void startCamera(nextCamera.deviceId);
  };

  return (
    <>
      {device.cameraSupported ? (
        <button type="button" onClick={handleOpen}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-primary px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary/40">
          <Camera className="h-4 w-4" /> Scan with camera
        </button>
      ) : (
        <p className="text-xs text-amber-700" role="status">
          {device.cameraSecureContext
            ? "Camera access is not supported here. Use a keyboard barcode scanner or enter the code manually."
            : "Camera scanning requires HTTPS (localhost is supported). Use a keyboard barcode scanner or enter the code manually."}
        </p>
      )}

      {open && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/80 p-3 sm:p-6"
          role="dialog" aria-modal="true" aria-labelledby="camera-scan-title">
          <div className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-4 dark:border-slate-700">
              <div>
                <h2 id="camera-scan-title" className="font-semibold text-slate-900 dark:text-white">Scan a barcode</h2>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                  Camera access is used only to read a barcode. No images or video are saved.
                </p>
              </div>
              <button type="button" onClick={handleClose}
                aria-label="Cancel camera scanning"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/40 dark:hover:bg-slate-800">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 p-4">
              <div className="relative overflow-hidden rounded-xl bg-black">
                <video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline />
                <div className="pointer-events-none absolute inset-[18%] rounded-lg border-2 border-emerald-400 shadow-[0_0_0_999px_rgba(0,0,0,0.2)]" />
                {cameraState === "requesting" && (
                  <div className="absolute inset-0 grid place-items-center bg-black/70 text-sm text-white" role="status">
                    Requesting camera access…
                  </div>
                )}
                {cameraState === "idle" && (
                  <div className="absolute inset-0 grid place-items-center text-center text-sm text-white">
                    <span>Position the barcode inside the frame.</span>
                  </div>
                )}
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Hold the device steady and keep the barcode well lit. EAN-13, EAN-8, UPC-A, UPC-E and Code 128 are supported.
              </p>
              {cameraState === "error" && (
                <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{errorMessage}</p>
              )}
              <div className="flex flex-wrap justify-end gap-2">
                {cameraState === "scanning" && cameras.length > 1 && (
                  <button type="button" onClick={switchCamera}
                    className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">
                    <RefreshCw className="h-4 w-4" /> Switch camera
                  </button>
                )}
                {cameraState !== "scanning" && (
                  <button type="button" onClick={() => void startCamera()}
                    className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
                    disabled={cameraState === "requesting"}>
                    {cameraState === "error" ? <RefreshCw className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
                    {cameraState === "error" ? "Try again" : "Start camera"}
                  </button>
                )}
                <button type="button" onClick={handleClose}
                  className="min-h-11 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
