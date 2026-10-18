// Host apps: import from '@noizu/tobor-kit' (+ '@noizu/tobor-kit/telemetry-toggle.js').
import {ToborKitClient} from '../../../../client.js';
import {ToborTelemetryToggle} from '../../telemetry-toggle.js';
import type {TelemetryConsent} from '../../../../types.js';

/**
 * Typed mount. `getTelemetryConsent()` is GET /telemetry/consent;
 * `setTelemetryConsent()` maps PUT 403 to `{ok:false, reason:"forbidden"}`.
 * Host-owned: token provider. The element renders nothing when not overridable.
 */
export function mountTelemetryToggle(root: ParentNode = document.body): ToborTelemetryToggle {
  const el = document.createElement('tobor-telemetry-toggle') as ToborTelemetryToggle;
  el.client = new ToborKitClient({
    baseUrl: '/api/tobor-kit',
    token: () => sessionStorage.getItem('tobor-access-token'),
  });
  el.addEventListener('tobor-telemetry-change', (event: Event) => {
    const consent = (event as CustomEvent<{consent: TelemetryConsent}>).detail.consent;
    console.log('tobor-telemetry-change', consent);
  });
  root.append(el);
  return el;
}
