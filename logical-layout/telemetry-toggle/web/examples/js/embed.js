import {ToborKitClient} from '@noizu/tobor-kit/client.js';
import '@noizu/tobor-kit/telemetry-toggle.js';

/**
 * Vanilla mount. The element GETs /api/tobor-kit/telemetry/consent on connect
 * and PUTs on toggle. Do not reimplement consent.
 *
 * Host-owned: bearer token. 403 → the element reverts to inert and renders nothing.
 */
export function mountTelemetryToggle(root = document.body) {
  const el = document.createElement('tobor-telemetry-toggle');
  el.client = new ToborKitClient({
    baseUrl: '/api/tobor-kit',
    token: () => sessionStorage.getItem('tobor-access-token'),
  });
  el.addEventListener('tobor-telemetry-change', (event) => {
    console.log('tobor-telemetry-change', event.detail.consent);
  });
  root.append(el);
  return el;
}
