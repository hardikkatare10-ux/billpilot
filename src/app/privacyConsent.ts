export interface PrivacyConsent {
  optionalStorage: boolean;
  savedAt: string;
}

export const PRIVACY_CONSENT_KEY = "billpilot_privacy_consent_v1";

export function readPrivacyConsent(): PrivacyConsent | null {
  try {
    if (typeof window === "undefined") return null;
    const value: unknown = JSON.parse(window.localStorage.getItem(PRIVACY_CONSENT_KEY) || "null");
    if (
      !value ||
      typeof value !== "object" ||
      typeof (value as PrivacyConsent).optionalStorage !== "boolean" ||
      typeof (value as PrivacyConsent).savedAt !== "string"
    ) return null;
    return value as PrivacyConsent;
  } catch {
    return null;
  }
}

export function writePrivacyConsent(optionalStorage: boolean): PrivacyConsent | null {
  const consent = { optionalStorage, savedAt: new Date().toISOString() };
  try {
    if (typeof window === "undefined") return null;
    window.localStorage.setItem(PRIVACY_CONSENT_KEY, JSON.stringify(consent));
    return consent;
  } catch {
    return null;
  }
}
