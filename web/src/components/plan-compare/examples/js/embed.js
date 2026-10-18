import '@noizu/tobor-kit/plan-compare';

const SAMPLE_PLANS = [
  {id: 'starter', name: 'Starter', priceMonthly: 9, priceYearly: 90, features: ['1 seat', 'Community support']},
  {
    id: 'pro',
    name: 'Pro',
    priceMonthly: 29,
    priceYearly: 290,
    features: ['5 seats', 'Priority support'],
    highlighted: true,
    ctaLabel: 'Go Pro',
  },
  {id: 'team', name: 'Team', priceMonthly: 99, priceYearly: 990, features: ['Unlimited seats', 'SSO']},
];

/**
 * Mount <noizu-plan-compare> and listen for plan-select {planId, checkoutUrl, interval}.
 * Host-owned: navigate to checkoutUrl (Payment Link). No Stripe keys. No sessions here.
 */
export function mountPlanCompare(host, options = {}) {
  const el = document.createElement('noizu-plan-compare');
  el.layout = options.layout ?? 'cards';
  el.billingToggle = options.billingToggle ?? true;
  el.checkoutUrlTemplate = options.checkoutUrlTemplate ?? 'https://example.com/checkout/{planId}';
  el.plans = options.plans ?? SAMPLE_PLANS;
  el.addEventListener('plan-select', (event) => {
    host.dataset.planId = event.detail.planId;
    host.dataset.checkoutUrl = event.detail.checkoutUrl;
    host.dataset.interval = event.detail.interval;
    options.onSelect?.(event.detail);
  });
  host.append(el);
  return el;
}
