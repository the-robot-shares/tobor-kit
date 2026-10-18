/** Plan row the island renders. Host-owned Stripe Payment Links stay off this type. */
export interface Plan {
  id: string;
  name: string;
  priceMonthly: number | string;
  priceYearly: number | string;
  features: string[];
  ctaLabel?: string;
  highlighted?: boolean;
}

export type BillingInterval = 'monthly' | 'yearly';

export interface PlanSelectDetail {
  planId: string;
  checkoutUrl: string;
  interval: BillingInterval;
}

export function interpolateCheckoutUrl(template: string, planId: string): string {
  return template.split('{planId}').join(planId);
}

export function priceOf(plan: Plan, interval: BillingInterval): number | string {
  return interval === 'yearly' ? plan.priceYearly : plan.priceMonthly;
}

export function formatPrice(value: number | string, interval: BillingInterval): string {
  const suffix = interval === 'yearly' ? '/yr' : '/mo';
  if (typeof value === 'string') {
    return /\/(mo|yr|month|year)\b/i.test(value) ? value : `${value}${suffix}`;
  }
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
  }).format(value);
  return `${formatted}${suffix}`;
}

export function parsePlansJson(raw: string): Plan[] {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (Array.isArray(data)) return data.flatMap(normalizePlan);
  if (data && typeof data === 'object' && Array.isArray((data as {plans?: unknown}).plans)) {
    return (data as {plans: unknown[]}).plans.flatMap(normalizePlan);
  }
  return [];
}

function normalizePlan(value: unknown): Plan[] {
  if (!value || typeof value !== 'object') return [];
  const row = value as Record<string, unknown>;
  const id = typeof row.id === 'string' ? row.id.trim() : '';
  const name = typeof row.name === 'string' ? row.name.trim() : '';
  if (!id || !name) return [];
  const features = Array.isArray(row.features)
    ? row.features.filter((item): item is string => typeof item === 'string')
    : [];
  return [
    {
      id,
      name,
      priceMonthly: asPrice(row.priceMonthly),
      priceYearly: asPrice(row.priceYearly),
      features,
      ctaLabel: typeof row.ctaLabel === 'string' ? row.ctaLabel : undefined,
      highlighted: row.highlighted === true,
    },
  ];
}

function asPrice(value: unknown): number | string {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') return value;
  return 0;
}
