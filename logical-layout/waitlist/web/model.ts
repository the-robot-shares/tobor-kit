export const DEFAULT_API = 'https://foryou.therobotlives.com';
export const DEFAULT_SOURCE = 'widget';

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const GUID_RE =
  /^[0-9a-fA-F]{8}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{12}$/;

export const COPY = {
  required: 'This field is required.',
  email: 'Enter a valid email address.',
  int: 'Enter a whole number.',
  float: 'Enter a number.',
  date: 'Enter a valid date.',
  guid: 'Enter a valid identifier.',
  select: 'Choose one of the options.',
  multi: 'Invalid selection.',
  format: 'Invalid format.',
  rateLimit: 'Too many attempts — please wait a moment and try again.',
  generic: 'Something went wrong — please try again.',
  unavailable: "We couldn't load this form. Please try again later.",
  notFound: "This sign-up form isn't available right now.",
  successSingle: "You're on the list!",
  successDouble: 'Check your inbox to confirm your spot.',
  joining: 'Joining…',
  join: 'Join',
  loading: 'Loading…',
} as const;

export type WaitlistAttrType =
  | 'email'
  | 'string'
  | 'text'
  | 'int'
  | 'float'
  | 'date'
  | 'guid'
  | 'select'
  | 'multiselect';

export interface AttrOption {
  label: string;
  value: string;
}

export interface AttrValidation {
  pattern?: string;
  min?: number;
  max?: number;
  length?: number;
}

export interface WaitlistAttribute {
  slug: string;
  name: string;
  type: WaitlistAttrType;
  required: boolean;
  isIdentity: boolean;
  options: AttrOption[];
  validation: AttrValidation;
  sortOrder: number;
}

export interface WaitlistSuccessDetail {
  values: Record<string, unknown>;
  status: number;
  source: string;
}

export interface WaitlistErrorDetail {
  error: string;
  status: number | null;
  values?: Record<string, unknown>;
}

const KNOWN_TYPES: Record<string, WaitlistAttrType> = {
  email: 'email',
  string: 'string',
  text: 'text',
  int: 'int',
  float: 'float',
  date: 'date',
  guid: 'guid',
  select: 'select',
  multiselect: 'multiselect',
};

export const FALLBACK_EMAIL: WaitlistAttribute = {
  slug: 'email',
  name: 'Email',
  type: 'email',
  required: true,
  isIdentity: true,
  options: [],
  validation: {},
  sortOrder: 0,
};

export function firstNonempty(...vals: Array<string | null | undefined>): string {
  for (const v of vals) {
    const s = (v ?? '').trim();
    if (s) return s;
  }
  return '';
}

export function stripSlash(api: string): string {
  return api.replace(/\/$/, '');
}

export function publicListUrl(api: string, slug: string, service: string, list: string): string {
  const base = stripSlash(api);
  if (slug) return `${base}/api/v1/public/lists/${encodeURIComponent(slug)}`;
  if (service && list) {
    return `${base}/api/v1/public/services/${encodeURIComponent(service)}/lists/${encodeURIComponent(list)}`;
  }
  return '';
}

export function normalizeOptions(options: unknown): AttrOption[] {
  if (!Array.isArray(options)) return [];
  return options.slice(0, 200).map((o) => {
    if (o && typeof o === 'object') {
      const rec = o as {value?: unknown; label?: unknown};
      const value =
        rec.value != null ? String(rec.value) : String(rec.label != null ? rec.label : '');
      const label = rec.label != null ? String(rec.label) : value;
      return {label, value};
    }
    return {label: String(o), value: String(o)};
  });
}

export function normalizeAttributes(raw: unknown): WaitlistAttribute[] {
  if (!Array.isArray(raw)) return [];
  const out: WaitlistAttribute[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const a = item as Record<string, unknown>;
    if (typeof a.slug !== 'string' || !a.slug) continue;
    const typeName = typeof a.type === 'string' ? a.type : '';
    const type = KNOWN_TYPES[typeName] ?? 'string';
    const validation =
      a.validation && typeof a.validation === 'object' ? (a.validation as AttrValidation) : {};
    out.push({
      slug: String(a.slug),
      name: a.name ? String(a.name) : String(a.slug),
      type,
      required: !!a.required,
      isIdentity: !!(a.is_identity ?? a.isIdentity),
      options: normalizeOptions(a.options),
      validation,
      sortOrder: typeof a.sort_order === 'number' ? a.sort_order : 0,
    });
  }
  out.sort((x, y) => x.sortOrder - y.sortOrder);
  return out;
}

export function urlPrefill(attr: WaitlistAttribute): string | null {
  try {
    const q = new URLSearchParams(window.location.search);
    if (q.has(attr.slug)) return q.get(attr.slug);
    if (attr.type === 'guid') {
      const keys = ['invite_token', 'token', 'ref', 'invite'];
      for (const k of keys) {
        if (q.has(k)) return q.get(k);
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function readRaw(form: HTMLFormElement, attr: WaitlistAttribute): string | string[] {
  if (attr.type === 'multiselect') {
    const boxes = form.querySelectorAll<HTMLInputElement>(
      `input[type="checkbox"][name="${CSS.escape(attr.slug)}"]`,
    );
    const vals: string[] = [];
    for (const b of boxes) {
      if (b.checked) vals.push(b.value);
    }
    return vals;
  }
  const control = form.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
    `[name="${CSS.escape(attr.slug)}"]`,
  );
  const raw = control?.value ?? '';
  return typeof raw === 'string' ? raw.trim() : String(raw);
}

export function controlFor(
  form: HTMLFormElement,
  attr: WaitlistAttribute,
): HTMLElement | null {
  if (attr.type === 'multiselect') {
    return form.querySelector(`[name="${CSS.escape(attr.slug)}"]`);
  }
  return form.querySelector(`[name="${CSS.escape(attr.slug)}"]`);
}

export function coerceValue(attr: WaitlistAttribute, raw: string | string[]): unknown {
  if (attr.type === 'multiselect') return raw;
  if (raw === '' || raw == null) return raw;
  const s = String(raw);
  if (attr.type === 'int') return parseInt(s, 10);
  if (attr.type === 'float') return Number(s);
  return s;
}

export function collectValues(
  form: HTMLFormElement,
  attrs: WaitlistAttribute[],
): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const attr of attrs) {
    const raw = readRaw(form, attr);
    const tv = coerceValue(attr, raw);
    if (attr.type === 'multiselect') {
      if (Array.isArray(tv) && tv.length) values[attr.slug] = tv;
    } else if (tv !== '' && tv != null) {
      values[attr.slug] = tv;
    }
  }
  return values;
}

export function validateField(attr: WaitlistAttribute, value: string | string[]): string | null {
  const v = attr.validation || {};
  const empty = attr.type === 'multiselect' ? (value as string[]).length === 0 : value === '' || value == null;
  if (empty) return attr.required ? COPY.required : null;

  switch (attr.type) {
    case 'email':
      if (!EMAIL_RE.test(String(value))) return COPY.email;
      break;
    case 'int': {
      if (!/^-?\d+$/.test(String(value))) return COPY.int;
      const iv = parseInt(String(value), 10);
      if (typeof v.min === 'number' && iv < v.min) return `Must be at least ${v.min}.`;
      if (typeof v.max === 'number' && iv > v.max) return `Must be at most ${v.max}.`;
      break;
    }
    case 'float': {
      if (isNaN(Number(value))) return COPY.float;
      const fv = Number(value);
      if (typeof v.min === 'number' && fv < v.min) return `Must be at least ${v.min}.`;
      if (typeof v.max === 'number' && fv > v.max) return `Must be at most ${v.max}.`;
      break;
    }
    case 'date':
      if (isNaN(Date.parse(String(value)))) return COPY.date;
      break;
    case 'guid':
      if (!GUID_RE.test(String(value))) return COPY.guid;
      break;
    case 'select': {
      const ok = attr.options.some((o) => o.value === value);
      if (!ok) return COPY.select;
      break;
    }
    case 'multiselect': {
      const allowed = attr.options.map((o) => o.value);
      const bad = (value as string[]).some((x) => allowed.indexOf(x) === -1);
      if (bad) return COPY.multi;
      break;
    }
    default: {
      const s = String(value);
      if (typeof v.length === 'number' && s.length > v.length) {
        return `Must be ${v.length} characters or fewer.`;
      }
      if (v.pattern) {
        try {
          if (!new RegExp(v.pattern).test(s)) return COPY.format;
        } catch {
          /* ignore invalid pattern */
        }
      }
    }
  }
  return null;
}

export function successCopy(successMessage: string, optInMode: 'single' | 'double'): string {
  if (successMessage) return successMessage;
  return optInMode === 'double' ? COPY.successDouble : COPY.successSingle;
}

export function errorCopy(status: number | null): string {
  if (status === 429) return COPY.rateLimit;
  return COPY.generic;
}
