declare global {
  interface ImportMetaEnv {
    readonly VITE_WINDOWS_INSTALLER_URL?: string;
    readonly VITE_WINDOWS_INSTALLER_SIZE_BYTES?: string;
    readonly VITE_WINDOWS_INSTALLER_VERSION?: string;
    readonly VITE_WINDOWS_INSTALLER_RELEASE_DATE?: string;
    readonly VITE_WINDOWS_INSTALLER_RELEASE_NOTES_URL?: string;
  }
}

const defaultDownloadUrl =
  'https://github.com/hardikkatare10-ux/billpilot/releases/download/v0.0.1/Dukan.Yantra.Setup.exe';
const defaultReleaseNotesUrl =
  'https://github.com/hardikkatare10-ux/billpilot/releases/tag/v0.0.1';
const fileSizeBytes = Number(import.meta.env.VITE_WINDOWS_INSTALLER_SIZE_BYTES || '1065309');

if (!Number.isSafeInteger(fileSizeBytes) || fileSizeBytes <= 0) {
  throw new Error('VITE_WINDOWS_INSTALLER_SIZE_BYTES must be a positive integer.');
}

export const windowsInstaller = {
  appName: 'Dukan Yantra',
  version: import.meta.env.VITE_WINDOWS_INSTALLER_VERSION || '0.0.1',
  fileName: 'Dukan.Yantra.Setup.exe',
  downloadUrl: import.meta.env.VITE_WINDOWS_INSTALLER_URL || defaultDownloadUrl,
  fileSizeBytes,
  releaseDate: import.meta.env.VITE_WINDOWS_INSTALLER_RELEASE_DATE || '2026-11-08T05:18:39Z',
  releaseNotesUrl: import.meta.env.VITE_WINDOWS_INSTALLER_RELEASE_NOTES_URL || defaultReleaseNotesUrl,
  supportedOperatingSystems: ['Windows 10', 'Windows 11'],
} as const;

export function formatInstallerSize(sizeBytes: number): string {
  const mebibytes = (sizeBytes / (1024 * 1024)).toFixed(2);
  const formattedBytes = new Intl.NumberFormat('en-US').format(sizeBytes);
  return `${mebibytes} MiB (${formattedBytes} bytes)`;
}

export function formatInstallerReleaseDate(date: string): string {
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
    year: 'numeric',
  }).format(new Date(date));
}
