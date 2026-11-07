import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
}

interface NavigatorWithStandalone extends Navigator {
  standalone?: boolean;
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as NavigatorWithStandalone).standalone === true
  );
}

function isUnsupportedWindows(): boolean {
  const userAgent = navigator.userAgent;
  const windowsVersion = userAgent.match(/Windows NT ([\d.]+)/i)?.[1];
  return (
    Boolean(windowsVersion && Number.parseFloat(windowsVersion) < 10) ||
    /Windows (?:95|98|ME|2000|XP|Vista)/i.test(userAgent)
  );
}

export default function InstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [supportsInstallPrompt, setSupportsInstallPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isStandaloneDisplay, setIsStandaloneDisplay] = useState(false);
  const [isUnsupportedWindowsPlatform] = useState(isUnsupportedWindows);

  useEffect(() => {
    const updateStandaloneDisplay = () => setIsStandaloneDisplay(isStandalone());
    const standaloneQuery = window.matchMedia('(display-mode: standalone)');
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setSupportsInstallPrompt(true);
    };
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    updateStandaloneDisplay();
    standaloneQuery.addEventListener('change', updateStandaloneDisplay);
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      standaloneQuery.removeEventListener('change', updateStandaloneDisplay);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    const promptEvent = deferredPrompt;
    setDeferredPrompt(null);

    try {
      await promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      if (outcome === 'accepted') setIsInstalled(true);
    } catch (error) {
      console.error('DukanYantra installation prompt failed:', error);
    }
  };

  if (!supportsInstallPrompt || isStandaloneDisplay || isInstalled || isUnsupportedWindowsPlatform) return null;

  return (
    <button
      type="button"
      onClick={handleInstall}
      className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-40 inline-flex h-11 items-center gap-2 rounded-full bg-[#1e40af] px-4 text-sm font-semibold text-white shadow-lg transition duration-200 hover:-translate-y-0.5 hover:bg-[#1d4ed8] hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] focus-visible:ring-offset-2 sm:bottom-6 sm:right-6"
      aria-label="Install DukanYantra"
    >
      <Download size={18} aria-hidden="true" />
      <span>Install DukanYantra</span>
    </button>
  );
}
