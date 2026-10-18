import '@noizu/tobor-kit/billing-status';

const el =
  document.querySelector('noizu-billing-status') ??
  document.createElement('noizu-billing-status');

// Host-owned snapshot. Never a Stripe secret on the element.
el.subscription = {
  status: 'active',
  planName: 'Pro',
  renewsAt: '2026-10-01',
};

el.addEventListener('portal-open', () => {
  // Host-owned: create a Billing Portal session and redirect.
  fetch('/billing/portal', {method: 'POST', credentials: 'same-origin'})
    .then((res) => res.json())
    .then((body) => {
      if (body.url) location.assign(body.url);
    })
    .catch(() => {});
});

if (!el.isConnected) document.body.append(el);
