import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  CircleHelp,
  Download,
  Globe,
  MonitorDown,
  Smartphone,
} from 'lucide-react';

type InstallPlatform =
  | 'windows-supported'
  | 'windows-older'
  | 'macos'
  | 'linux'
  | 'mobile'
  | 'other';

type InstallBrowser = 'edge' | 'chrome' | 'safari' | 'firefox' | 'other';

interface NavigatorWithUserAgentData extends Navigator {
  userAgentData?: {
    platform: string;
    getHighEntropyValues?: (hints: string[]) => Promise<{ platformVersion?: string }>;
  };
}

interface PlatformInfo {
  platform: InstallPlatform;
  windowsVersion?: 'Windows 10' | 'Windows 11' | 'Windows 10 or 11' | 'Windows 7' | 'Windows 8' | 'Windows 8.1' | 'Older Windows';
}

function detectBrowser(userAgent: string): InstallBrowser {
  if (/Edg\//i.test(userAgent)) return 'edge';
  if (/Firefox\//i.test(userAgent)) return 'firefox';
  if (/Chrome\//i.test(userAgent) && !/Chromium/i.test(userAgent)) return 'chrome';
  if (/Safari\//i.test(userAgent) && !/Chrome\//i.test(userAgent)) return 'safari';
  return 'other';
}

function detectPlatform(userAgent: string): PlatformInfo {
  const windowsVersion = userAgent.match(/Windows NT ([\d.]+)/i)?.[1];
  if (windowsVersion === '6.1') return { platform: 'windows-older', windowsVersion: 'Windows 7' };
  if (windowsVersion === '6.2') return { platform: 'windows-older', windowsVersion: 'Windows 8' };
  if (windowsVersion === '6.3') return { platform: 'windows-older', windowsVersion: 'Windows 8.1' };
  if ((windowsVersion && Number.parseFloat(windowsVersion) < 10) || /Windows (?:95|98|ME|2000|XP|Vista)/i.test(userAgent)) {
    return { platform: 'windows-older', windowsVersion: 'Older Windows' };
  }
  if (/Windows/i.test(userAgent)) {
    return { platform: 'windows-supported', windowsVersion: 'Windows 10 or 11' };
  }
  if (/Android|iPhone|iPad|iPod/i.test(userAgent)) return { platform: 'mobile' };
  if (/Macintosh|Mac OS X/i.test(userAgent)) return { platform: 'macos' };
  if (/Linux/i.test(userAgent)) return { platform: 'linux' };
  return { platform: 'other' };
}

async function getPlatformInfo(): Promise<PlatformInfo> {
  const nav = navigator as NavigatorWithUserAgentData;
  const userAgent = navigator.userAgent;
  const detected = detectPlatform(userAgent);

  if (detected.platform === 'windows-older') return detected;

  const hintedPlatform = nav.userAgentData?.platform;
  if (hintedPlatform === 'Windows' && nav.userAgentData?.getHighEntropyValues) {
    try {
      const { platformVersion } = await nav.userAgentData.getHighEntropyValues(['platformVersion']);
      const majorVersion = Number.parseInt(platformVersion?.split('.')[0] ?? '', 10);
      if (majorVersion >= 13) {
        return { platform: 'windows-supported', windowsVersion: 'Windows 11' };
      }
      if (majorVersion > 0 && majorVersion < 10) {
        return { platform: 'windows-older', windowsVersion: 'Older Windows' };
      }
      if (majorVersion > 0) {
        return { platform: 'windows-supported', windowsVersion: 'Windows 10' };
      }
    } catch {
      return detected.platform === 'windows-supported'
        ? detected
        : { platform: 'windows-supported', windowsVersion: 'Windows 10 or 11' };
    }
  }

  if (hintedPlatform === 'Windows') {
    return { platform: 'windows-supported', windowsVersion: 'Windows 10 or 11' };
  }
  if (hintedPlatform === 'macOS') return { platform: 'macos' };
  if (hintedPlatform === 'Linux') return { platform: 'linux' };
  if (hintedPlatform === 'Android' || hintedPlatform === 'iOS') return { platform: 'mobile' };

  return detected;
}

function getInstallationSteps(platform: InstallPlatform, browser: InstallBrowser): string[] {
  if (browser === 'edge' || browser === 'chrome') {
    if (platform === 'mobile') {
      return browser === 'chrome'
        ? ['Open the browser menu and choose Install app or Add to Home screen.']
        : ['Open the browser menu and choose Add to Home screen, if available.'];
    }
    return [
      'Look for the Install DukanYantra button on this page or the install icon in the address bar.',
      'If it is not shown, open the browser menu and choose Apps > Install this site as an app, or the equivalent Install page option.',
    ];
  }

  if (browser === 'safari' && platform === 'macos') {
    return ['In Safari, choose File > Add to Dock (available in supported macOS and Safari versions).'];
  }

  if (browser === 'safari' && platform === 'mobile') {
    return ['Tap Share in Safari, then choose Add to Home Screen.'];
  }

  return [];
}

interface InstallPageProps {
  onReturn: () => void;
}

export default function InstallPage({ onReturn }: InstallPageProps) {
  const [platformInfo, setPlatformInfo] = useState<PlatformInfo>(() => detectPlatform(navigator.userAgent));
  const [browser, setBrowser] = useState<InstallBrowser>(() => detectBrowser(navigator.userAgent));

  useEffect(() => {
    let active = true;
    setBrowser(detectBrowser(navigator.userAgent));
    void getPlatformInfo().then((info) => {
      if (active) setPlatformInfo(info);
    });

    return () => {
      active = false;
    };
  }, []);

  const instructions = getInstallationSteps(platformInfo.platform, browser);
  const browserName =
    browser === 'edge'
      ? 'Microsoft Edge'
      : browser === 'chrome'
        ? 'Google Chrome'
        : browser === 'safari'
          ? 'Safari'
          : browser === 'firefox'
            ? 'Mozilla Firefox'
            : 'this browser';
  const compatibilityTags =
    platformInfo.platform === 'windows-older'
          ? [platformInfo.windowsVersion || 'Older Windows', 'Browser access']
          : platformInfo.platform === 'windows-supported'
            ? ['Windows 10', 'Windows 11', 'Microsoft Edge', 'Google Chrome']
            : [browserName, 'Browser access'];

  return (
    <main className="min-h-screen bg-[#f0f4f8] px-4 py-8 text-[#0d1b3e] sm:px-6 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src="/assets/dukan-yantra-logo.png"
              alt="DukanYantra"
              className="h-12 w-12 rounded-xl object-contain"
            />
            <div>
              <p className="text-lg font-bold leading-tight">DukanYantra</p>
              <p className="text-xs text-slate-600">Business Management</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onReturn}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-[#1e40af] transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Back to DukanYantra
          </button>
        </header>

        <section className="overflow-hidden rounded-3xl border border-blue-100 bg-white shadow-sm">
          <div className="bg-[#1e40af] px-6 py-8 text-white sm:px-10 sm:py-10">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
              <MonitorDown size={15} aria-hidden="true" />
              DukanYantra for your device
            </div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Install DukanYantra</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-100 sm:text-base">
              Access your business management system directly from your desktop.
            </p>
          </div>

          <div className="grid gap-8 p-6 sm:p-10 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-7">
              {platformInfo.platform === 'windows-older' ? (
                <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                  <h2 className="flex items-center gap-2 font-bold text-amber-950">
                    <CircleHelp size={19} aria-hidden="true" />
                    {platformInfo.windowsVersion} compatibility
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-amber-950">
                    Desktop application installation is currently supported only on Windows 10 and Windows 11. However, you can continue using DukanYantra directly through your web browser whenever your browser supports it.
                  </p>
                  <button
                    type="button"
                    onClick={onReturn}
                    className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#1e40af] px-5 text-sm font-semibold text-white transition-colors hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] focus-visible:ring-offset-2"
                  >
                    Continue to DukanYantra Website
                  </button>
                </section>
              ) : (
                <>
                  <section className="rounded-2xl border border-blue-100 bg-blue-50/70 p-5">
                    <h2 className="flex items-center gap-2 font-bold text-slate-900">
                      <CheckCircle2 size={19} className="text-[#1e40af]" aria-hidden="true" />
                      Device compatibility
                    </h2>
                    <p className="mt-3 text-sm leading-6 text-slate-700">
                      {platformInfo.platform === 'windows-supported'
                        ? `${platformInfo.windowsVersion} is supported by the Windows desktop installer. Compatible browsers may also offer the separate PWA installation option.`
                        : platformInfo.platform === 'macos'
                          ? 'DukanYantra remains available in your browser. Supported browsers may also offer an add-to-dock or app installation option.'
                          : platformInfo.platform === 'linux'
                            ? 'DukanYantra remains available in your browser. Some Chromium-based browsers on Linux may offer an app installation option.'
                            : platformInfo.platform === 'mobile'
                              ? 'DukanYantra works in your mobile browser. Compatible browsers may let you add it to your home screen.'
                              : 'DukanYantra remains available through your browser. Installation options depend on browser support.'}
                    </p>
                    {platformInfo.platform === 'windows-supported' && (
                      <p className="mt-2 text-sm text-slate-700">
                        For the PWA, use the browser’s Install DukanYantra option when available. If your browser does not provide the native prompt, follow the browser menu instructions.
                      </p>
                    )}
                  </section>

                  <section>
                    <h2 className="text-lg font-bold text-slate-900">Browser Installation (PWA)</h2>
                    {instructions.length > 0 ? (
                      <>
                        <p className="mt-1 text-sm text-slate-600">
                          For {browserName}, use the browser’s built-in installation option:
                        </p>
                        <ol className="mt-4 space-y-3">
                          {instructions.map((instruction, index) => (
                            <li key={instruction} className="flex gap-3 text-sm leading-6 text-slate-700">
                              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-[#1e40af]">
                                {index + 1}
                              </span>
                              {instruction}
                            </li>
                          ))}
                        </ol>
                      </>
                    ) : (
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {browserName} does not expose a supported DukanYantra installation option here. You can continue using the website, or open this page in a current version of Microsoft Edge or Google Chrome to check for installation support.
                      </p>
                    )}
                  </section>
                </>
              )}
            </div>

            <aside className="space-y-5">
              <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
                <h2 className="flex items-center gap-2 font-bold text-slate-900">
                  <Download size={18} className="text-[#1e40af]" aria-hidden="true" />
                  Windows Desktop Installer
                </h2>
                <h3 className="mt-3 text-base font-bold text-slate-900">Dukan Yantra for Windows</h3>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  Install Dukan Yantra on your Windows computer and access your business management system directly from your desktop.
                </p>
                <dl className="mt-4 grid gap-2 text-sm text-slate-700">
                  <div className="flex gap-2">
                    <dt className="font-semibold">Application:</dt>
                    <dd>Dukan Yantra</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="font-semibold">Version:</dt>
                    <dd>0.0.1</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="font-semibold">Installer:</dt>
                    <dd className="break-all">Dukan.Yantra.Setup.exe</dd>
                  </div>
                </dl>
                <div className="mt-4 flex flex-wrap gap-2" aria-label="Supported operating systems">
                  {['Windows 10', 'Windows 11'].map((version) => (
                    <span
                      key={version}
                      className="rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-medium text-slate-700"
                    >
                      {version}
                    </span>
                  ))}
                </div>
                <a
                  href="https://github.com/hardikkatare10-ux/billpilot/releases/download/v0.0.1/Dukan.Yantra.Setup.exe"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#1e40af] px-5 text-sm font-semibold text-white transition-colors hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] focus-visible:ring-offset-2"
                >
                  <Download size={16} aria-hidden="true" />
                  Download Dukan Yantra for Windows
                </a>
                <h3 className="mt-5 text-sm font-bold text-slate-900">Installation instructions</h3>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs leading-5 text-slate-600">
                  <li>Open the downloaded installer.</li>
                  <li>Follow the Windows installation wizard.</li>
                  <li>Complete installation.</li>
                  <li>Launch Dukan Yantra from the desktop shortcut or Start Menu.</li>
                </ol>
                <p className="mt-4 text-xs leading-5 text-slate-600">
                  The Windows desktop installer is separate from the browser-based PWA installation option.
                </p>
              </section>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <h2 className="font-bold text-slate-900">Browser compatibility</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  You are using {browserName}. The Windows installer above is the desktop application. Browser-based installation remains a separate option and appears only when your browser supports it.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {compatibilityTags.map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-blue-100 bg-white px-3 py-1 text-xs font-medium text-slate-700"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="flex items-center gap-2 font-bold text-slate-900">
                  {platformInfo.platform === 'mobile' ? (
                    <Smartphone size={18} className="text-[#1e40af]" aria-hidden="true" />
                  ) : (
                    <Globe size={18} className="text-[#1e40af]" aria-hidden="true" />
                  )}
                  Your website is always available
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Installation is optional. You can continue using DukanYantra in your browser at any time.
                </p>
                <button
                  type="button"
                  onClick={onReturn}
                  className="mt-4 min-h-10 text-sm font-semibold text-[#1e40af] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]"
                >
                  Continue to DukanYantra Website
                </button>
              </div>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}
