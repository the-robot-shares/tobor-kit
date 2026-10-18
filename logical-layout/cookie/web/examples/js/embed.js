import '@noizu/tobor-kit/cookie';
import '@noizu/tobor-kit/cookie-settings';

const STORAGE_KEY = 'start-app.cookie-consent.v1';

const settings =
  document.querySelector('noizu-cookie-settings') ??
  document.createElement('noizu-cookie-settings');
const consent =
  document.querySelector('noizu-cookie-consent') ??
  document.createElement('noizu-cookie-consent');

consent.storageKey = STORAGE_KEY;
consent.mode = 'categories';

consent.addEventListener('cookie-consent-change', (event) => {
  const detail = event.detail;
  if (!detail) return;
  // Host-owned; examples echo POST /consent. Do not put secrets on the element.
  fetch('/consent', {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify(detail),
  }).catch(() => {});
});

if (!settings.isConnected) document.body.append(settings);
if (!consent.isConnected) document.body.append(consent);
