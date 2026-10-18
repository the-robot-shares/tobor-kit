// Host apps: import '@noizu/tobor-kit/plan-compare'.
import '../../noizu-plan-compare.js';
import type {Plan, PlanSelectDetail} from '../../noizu-plan-compare.js';

const SAMPLE_PLANS: Plan[] = [
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

export interface MountPlanCompareOptions {
  plans?: Plan[];
  layout?: 'cards' | 'table';
  billingToggle?: boolean;
  checkoutUrlTemplate?: string;
  onSelect?: (detail: PlanSelectDetail) => void;
}

/**
 * Mount <noizu-plan-compare> and listen for plan-select {planId, checkoutUrl, interval}.
 * Host-owned: navigate to checkoutUrl (Payment Link). No Stripe keys. No sessions here.
 */
export function mountPlanCompare(
  host: HTMLElement,
  options: MountPlanCompareOptions = {},
): HTMLElementTagNameMap['noizu-plan-compare'] {
  const el = document.createElement('noizu-plan-compare');
  el.layout = options.layout ?? 'cards';
  el.billingToggle = options.billingToggle ?? true;
  el.checkoutUrlTemplate = options.checkoutUrlTemplate ?? 'https://example.com/checkout/{planId}';
  el.plans = options.plans ?? SAMPLE_PLANS;
  el.addEventListener('plan-select', (event) => {
    const detail = event.detail;
    host.dataset.planId = detail.planId;
    host.dataset.checkoutUrl = detail.checkoutUrl;
    host.dataset.interval = detail.interval;
    options.onSelect?.(detail);
  });
  host.append(el);
  return el;
}
