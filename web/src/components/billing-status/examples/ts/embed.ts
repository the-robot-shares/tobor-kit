// Host apps: import '@noizu/tobor-kit/billing-status'.
import '../../noizu-billing-status.js';
import type {
  BillingSubscription,
  NoizuBillingStatus,
} from '../../noizu-billing-status.js';

const el = (document.querySelector('noizu-billing-status') ??
  document.createElement('noizu-billing-status')) as NoizuBillingStatus;

const subscription: BillingSubscription = {
  status: 'active',
  planName: 'Pro',
  renewsAt: '2026-10-01',
};

// Host-owned snapshot. Never a Stripe secret on the element.
el.subscription = subscription;

el.addEventListener('portal-open', () => {
  // Host-owned: create a Billing Portal session and redirect.
  void openHostPortal();
});

if (!el.isConnected) document.body.append(el);

/** Host route — Stripe secret stays on the server. */
async function openHostPortal(): Promise<void> {
  const res = await fetch('/billing/portal', {
    method: 'POST',
    credentials: 'same-origin',
  });
  if (!res.ok) return;
  const body = (await res.json()) as {url?: string};
  if (body.url) globalThis.location.assign(body.url);
}
