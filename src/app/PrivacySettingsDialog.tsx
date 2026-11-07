import { useEffect, useState } from "react";
import { ShieldCheck, X } from "lucide-react";
import type { PrivacyConsent } from "./privacyConsent";

export function PrivacySettingsDialog({
  open,
  consent,
  onSave,
  onClose,
}: {
  open: boolean;
  consent: PrivacyConsent | null;
  onSave: (optionalStorage: boolean) => void;
  onClose: () => void;
}) {
  const [optionalStorage, setOptionalStorage] = useState(consent?.optionalStorage ?? false);

  useEffect(() => {
    setOptionalStorage(consent?.optionalStorage ?? false);
  }, [consent, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/55 p-3 sm:p-6"
      role="dialog" aria-modal="true" aria-labelledby="privacy-settings-title">
      <section className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-blue-50 p-2 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 id="privacy-settings-title" className="font-semibold text-slate-900 dark:text-white">Privacy settings</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Choose whether BillPilot may remember an optional scanning preference on this device.</p>
            </div>
          </div>
          {consent && (
            <button type="button" onClick={onClose} aria-label="Close privacy settings"
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/40 dark:hover:bg-slate-800">
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        <div className="mt-5 space-y-3">
          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Essential app storage</h3>
            <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
              BillPilot stores your business account, products, invoices, and app settings in browser storage so core billing features can work. A minimal consent record is also kept so your choice is not repeatedly requested. These essential records are not optional preferences and are not removed when you decline optional storage. This app does not use cookies for these choices.
            </p>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
            <input type="checkbox" checked={optionalStorage} onChange={(event) => setOptionalStorage(event.target.checked)}
              className="mt-1 h-4 w-4 accent-primary" />
            <span>
              <span className="block text-sm font-semibold text-slate-900 dark:text-white">Allow optional local preferences</span>
              <span className="mt-1 block text-sm leading-6 text-slate-600 dark:text-slate-300">
                Remember whether I last chose the camera or an external keyboard scanner. If declined, this preference stays in memory only and is forgotten when the page is closed.
              </span>
            </span>
          </label>

          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Camera permission</h3>
            <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
              Camera access is separate from storage consent. Your browser requests it only after you press “Start camera” in the scanner, it is used only to read a barcode, and the camera stream is stopped as soon as scanning ends or is cancelled. No images or recordings are saved.
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={() => onSave(false)}
            className="min-h-11 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">
            Decline optional
          </button>
          <button type="button" onClick={() => onSave(optionalStorage)}
            className="min-h-11 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/40">
            Save choices
          </button>
        </div>
      </section>
    </div>
  );
}
