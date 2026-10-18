/** Host-owned asset snapshot. Kit never persists. */

export type AssetMeta = Record<string, unknown>;

export interface Asset {
  id: string;
  name: string;
  mime: string;
  src?: string;
  /** Inline text for `text/*` preview/edit. Host-loaded. Never HTML-injected. */
  body?: string;
  meta?: AssetMeta;
}

export interface AssetOpenDetail {
  id: string;
}

export interface AssetSaveDetail {
  id: string;
  name: string;
  body?: string;
}

export type AssetMimeKind = 'image' | 'text' | 'other';

export function essentialMime(mime: string): string {
  const raw = mime.split(';', 1)[0];
  return (raw ?? '').trim().toLowerCase();
}

export function mimeKind(mime: string): AssetMimeKind {
  const type = essentialMime(mime);
  if (type.startsWith('image/')) return 'image';
  if (type.startsWith('text/')) return 'text';
  return 'other';
}

export function isImageMime(mime: string): boolean {
  return mimeKind(mime) === 'image';
}

export function isTextMime(mime: string): boolean {
  return mimeKind(mime) === 'text';
}

export function textBody(asset: Asset | undefined): string {
  return typeof asset?.body === 'string' ? asset.body : '';
}

/** Reject `javascript:` URLs. Host `src` is otherwise passed through. */
export function previewSrc(src: string | undefined): string | undefined {
  if (typeof src !== 'string') return undefined;
  const value = src.trim();
  if (!value) return undefined;
  if (/^javascript:/i.test(value)) return undefined;
  return value;
}
