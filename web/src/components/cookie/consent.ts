export const CONSENT_VERSION = 1;
export const DEFAULT_STORAGE_KEY = 'start-app.cookie-consent.v1';
export const CONSENT_CHANGE_EVENT = 'cookie-consent-change';
export const CONSENT_CHANGE_ALIAS = 'start-app:cookie-consent-change';
export const SETTINGS_OPEN_EVENT = 'cookie-settings-open';

export interface ConsentPreferences {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  preferences: boolean;
}

export type ConsentCategory = keyof ConsentPreferences;
export type OptionalConsentCategory = Exclude<ConsentCategory, 'necessary'>;

export interface ConsentState {
  version: number;
  categories: ConsentPreferences;
  acceptedAt?: string;
  updatedAt?: string;
}

export const consentCategoryDetails: ReadonlyArray<{
  id: ConsentCategory;
  label: string;
  description: string;
  required: boolean;
}> = [
  {
    id: 'necessary',
    label: 'Necessary',
    description: 'Required for sign-in, security, and core app behavior.',
    required: true,
  },
  {
    id: 'analytics',
    label: 'Analytics',
    description: 'Helps us understand page usage and improve the product.',
    required: false,
  },
  {
    id: 'marketing',
    label: 'Marketing',
    description: 'Reserved for optional campaign attribution or advertising tools.',
    required: false,
  },
  {
    id: 'preferences',
    label: 'Preferences',
    description: 'Stores optional display and personalization choices.',
    required: false,
  },
];

export const defaultConsentPreferences: ConsentPreferences = {
  necessary: true,
  analytics: false,
  marketing: false,
  preferences: false,
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizePreferences(
  preferences?: Partial<Record<ConsentCategory, boolean>>,
): ConsentPreferences {
  return {
    necessary: true,
    analytics: Boolean(preferences?.analytics),
    marketing: Boolean(preferences?.marketing),
    preferences: Boolean(preferences?.preferences),
  };
}

export function getConsentState(storageKey: string): ConsentState | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (!isObject(parsed) || parsed.version !== CONSENT_VERSION) return null;
    if (!isObject(parsed.categories)) return null;

    return {
      version: CONSENT_VERSION,
      categories: normalizePreferences(
        parsed.categories as Partial<Record<ConsentCategory, boolean>>,
      ),
      acceptedAt: typeof parsed.acceptedAt === 'string' ? parsed.acceptedAt : undefined,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : undefined,
    };
  } catch {
    return null;
  }
}

export function setConsentPreferences(
  storageKey: string,
  preferences: Partial<Record<ConsentCategory, boolean>>,
): ConsentState {
  const timestamp = new Date().toISOString();
  const existing = getConsentState(storageKey);
  const state: ConsentState = {
    version: CONSENT_VERSION,
    categories: normalizePreferences(preferences),
    acceptedAt: existing?.acceptedAt ?? timestamp,
    updatedAt: timestamp,
  };

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    // Keep the in-memory choice for this page view when storage is unavailable.
  }

  return state;
}

export function acceptAllConsent(storageKey: string): ConsentState {
  return setConsentPreferences(storageKey, {
    necessary: true,
    analytics: true,
    marketing: true,
    preferences: true,
  });
}

export function rejectOptionalConsent(storageKey: string): ConsentState {
  return setConsentPreferences(storageKey, defaultConsentPreferences);
}

export function dispatchConsentChange(target: EventTarget, state: ConsentState | null) {
  target.dispatchEvent(
    new CustomEvent<ConsentState | null>(CONSENT_CHANGE_EVENT, {
      detail: state,
      bubbles: true,
      composed: true,
    }),
  );
  window.dispatchEvent(
    new CustomEvent<ConsentState | null>(CONSENT_CHANGE_ALIAS, {
      detail: state,
      bubbles: true,
      composed: true,
    }),
  );
}
