// Host apps: import '@noizu/tobor-kit/footer-brand.js' (+ the class from '@noizu/tobor-kit').
import '../../noizu-footer-brand.js';

export interface FooterBrandOptions {
  href?: string;
  target?: string;
  brand?: string;
  prefix?: string;
  suffix?: string;
  theme?: 'dark' | 'light' | 'auto';
  palette?: 'default' | 'mono' | 'accent';
  align?: 'start' | 'center' | 'end';
}

/**
 * Mount <noizu-footer-brand> into a host footer. The whole API is attributes
 * + CSS custom properties — no events, no backend. Host-owned: the link
 * destination and any analytics around it. Never put secrets on this island.
 */
export function mountFooterBrand(
  host: HTMLElement,
  options: FooterBrandOptions = {},
): HTMLElementTagNameMap['noizu-footer-brand'] {
  const el = document.createElement('noizu-footer-brand');
  el.href = options.href ?? 'https://derobot.is';
  el.target = options.target ?? '';
  el.brand = options.brand ?? 'The Robot Lives';
  el.prefix = options.prefix ?? 'A';
  el.suffix = options.suffix ?? 'Joint';
  el.theme = options.theme ?? 'dark';
  el.palette = options.palette ?? 'default';
  el.align = options.align ?? 'center';
  host.append(el);
  return el;
}
