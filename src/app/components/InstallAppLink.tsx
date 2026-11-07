import { Download } from "lucide-react";

export default function InstallAppLink() {
  return (
    <a
      href="/install"
      title="Install Dukan Yantra"
      aria-label="Install Dukan Yantra"
      className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 text-xs font-semibold text-blue-700 transition-colors hover:border-blue-300 hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 sm:px-3"
    >
      <Download className="h-4 w-4" aria-hidden="true" />
      <span>Install App</span>
    </a>
  );
}
