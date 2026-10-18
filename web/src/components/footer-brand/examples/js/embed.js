import '@noizu/tobor-kit/footer-brand.js';

/**
 * Mount <noizu-footer-brand> into a host footer. The whole API is attributes
 * + CSS custom properties — no events, no backend. Host-owned: the link
 * destination and any analytics around it. Never put secrets on this island.
 */
export function mountFooterBrand(host, options = {}) {
  const el = document.createElement('noizu-footer-brand');
  el.href = options.href ?? 'https://derobot.is';
  el.target = options.target ?? '';
  el.brand = options.brand ?? 'The Robot Lives';
  el.prefix = options.prefix ?? 'A';
  el.suffix = options.suffix ?? 'Joint';
  el.theme = options.theme ?? 'dark'; // dark | light | auto
  el.palette = options.palette ?? 'default'; // default | mono | accent
  el.align = options.align ?? 'center'; // start | center | end
  host.append(el);
  return el;
}
