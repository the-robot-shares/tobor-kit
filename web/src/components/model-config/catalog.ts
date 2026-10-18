/**
 * Catalog / spec helpers for `<noizu-model-config>`.
 * Never log `apiKey` — it may be a live secret or a masked echo (`••••1234`).
 */

export const INHERIT_OPTION = '__inherit__';
export const CUSTOM_OPTION = '__custom__';
export const INHERIT_VALUE = 'inherit';
export const CUSTOM_PREFIX = 'custom:';

export interface ModelCatalogEntry {
  provider: string;
  model: string;
  label?: string;
  /** Exact spec to store; defaults to `provider:model`. */
  spec?: string;
}

export interface CustomEndpoint {
  baseUrl: string;
  model: string;
  /** Plaintext or masked echo (`••••1234`). Never log. */
  apiKey?: string;
}

export interface CatalogPayload {
  entries: ModelCatalogEntry[];
  custom?: CustomEndpoint;
}

export function specOf(entry: ModelCatalogEntry): string {
  const spec = entry.spec?.trim();
  return spec || `${entry.provider}:${entry.model}`;
}

export function isInheritValue(value: string): boolean {
  return value === '' || value === INHERIT_VALUE;
}

export function isCustomValue(value: string): boolean {
  return value === 'custom' || value.startsWith(CUSTOM_PREFIX);
}

export function customSpec(model: string): string {
  const trimmed = model.trim();
  return trimmed ? `${CUSTOM_PREFIX}${trimmed}` : 'custom';
}

/** True when the field is a host echo such as `••••1234`, not a new secret. */
export function isMaskedSecret(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  return /•/.test(v) || /^\*{3,}/.test(v) || /^x{4,}/i.test(v);
}

/**
 * Empty or masked input means "keep the stored key".
 * The emitted `apiKey` is `''` in that case — the host must not overwrite.
 */
export function apiKeyForSave(typed: string): string {
  const v = typed.trim();
  if (!v || isMaskedSecret(v)) return '';
  return v;
}

export function parseCatalogPayload(data: unknown): CatalogPayload {
  return {
    entries: parseCatalogEntries(data),
    custom: parseCustomEndpoint(data) ?? undefined,
  };
}

export function parseCatalogEntries(data: unknown): ModelCatalogEntry[] {
  const record = asRecord(data);
  const raw = Array.isArray(data)
    ? data
    : arrayOf(record, 'catalog') ?? arrayOf(record, 'models') ?? arrayOf(record, 'entries') ?? [];
  const out: ModelCatalogEntry[] = [];
  for (const item of raw) {
    const entry = parseEntry(item);
    if (entry) out.push(entry);
  }
  return out;
}

export function parseCustomEndpoint(data: unknown): CustomEndpoint | null {
  const record = asRecord(data);
  if (!record) return null;
  const raw = record.custom ?? record.customEndpoint ?? record.custom_endpoint;
  const c = asRecord(raw);
  if (!c) return null;
  const baseUrl = str(c.baseUrl) || str(c.base_url);
  const model = str(c.model);
  const apiKey = str(c.apiKey) || str(c.api_key);
  if (!baseUrl && !model && !apiKey) return null;
  return {baseUrl, model, ...(apiKey ? {apiKey} : {})};
}

function parseEntry(item: unknown): ModelCatalogEntry | null {
  const rec = asRecord(item);
  if (!rec) return null;
  const provider = str(rec.provider);
  const model = str(rec.model);
  if (!provider || !model) return null;
  const label = str(rec.label);
  const spec = str(rec.spec);
  return {
    provider,
    model,
    ...(label ? {label} : {}),
    ...(spec ? {spec} : {}),
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function arrayOf(record: Record<string, unknown> | null, key: string): unknown[] | null {
  if (!record) return null;
  return Array.isArray(record[key]) ? record[key] : null;
}

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}
