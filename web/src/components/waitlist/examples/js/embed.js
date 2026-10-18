/**
 * Vanilla mount for noizu-waitlist.
 * Host: import '@noizu/tobor-kit/waitlist';
 */
import '../../noizu-waitlist.js';

const FORYOU = 'https://foryou.therobotlives.com';

export function mountWaitlist(host = document.body) {
  const el =
    host.querySelector('noizu-waitlist') ?? host.appendChild(document.createElement('noizu-waitlist'));
  el.slug = 'my-site';
  el.source = 'landing';
  el.api = FORYOU;
  el.addEventListener('waitlist-success', (event) => {
    console.info('waitlist-success', event.detail.status, event.detail.source, event.detail.values);
  });
  el.addEventListener('waitlist-error', (event) => {
    console.warn('waitlist-error', event.detail.status, event.detail.error, event.detail.values);
  });
  return el;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => mountWaitlist());
} else {
  mountWaitlist();
}
