// Host apps: import '@noizu/tobor-kit/cookie' and '@noizu/tobor-kit/cookie-settings'.
import {NoizuCookieConsent} from '../../noizu-cookie-consent.js';
import {NoizuCookieSettings} from '../../noizu-cookie-settings.js';

const STORAGE_KEY = 'start-app.cookie-consent.v1';

export type ConsentState = {
  version: number;
  categories: {
    necessary: true;
    analytics: boolean;
    marketing: boolean;
    preferences: boolean;
  };
  acceptedAt?: string;
  updatedAt?: string;
};

const settings =
  document.querySelector('noizu-cookie-settings') ?? new NoizuCookieSettings();
const consent =
  document.querySelector('noizu-cookie-consent') ?? new NoizuCookieConsent();

consent.storageKey = STORAGE_KEY;
consent.mode = 'categories';

consent.addEventListener('cookie-consent-change', (event: Event) => {
  const detail = (event as CustomEvent<ConsentState | null>).detail;
  if (!detail) return;
  // Host-owned; examples echo POST /consent. Do not put secrets on the element.
  void fetch('/consent', {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify(detail),
  });
});

if (!settings.isConnected) document.body.append(settings);
if (!consent.isConnected) document.body.append(consent);
