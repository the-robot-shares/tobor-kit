/**
 * Typed mount for noizu-waitlist.
 * Host: import {NoizuWaitlist, type WaitlistErrorDetail, type WaitlistSuccessDetail} from '@noizu/tobor-kit/waitlist';
 */
import '../../noizu-waitlist.js';
import type {
  NoizuWaitlist,
  WaitlistErrorDetail,
  WaitlistSuccessDetail,
} from '../../noizu-waitlist.js';

const FORYOU = 'https://foryou.therobotlives.com';

export function mountWaitlist(host: HTMLElement = document.body): NoizuWaitlist {
  const el = (host.querySelector('noizu-waitlist') ??
    host.appendChild(document.createElement('noizu-waitlist'))) as NoizuWaitlist;
  el.slug = 'my-site';
  el.source = 'landing';
  el.api = FORYOU;
  el.addEventListener('waitlist-success', ((event: CustomEvent<WaitlistSuccessDetail>) => {
    console.info('waitlist-success', event.detail.status, event.detail.source, event.detail.values);
  }) as EventListener);
  el.addEventListener('waitlist-error', ((event: CustomEvent<WaitlistErrorDetail>) => {
    console.warn('waitlist-error', event.detail.status, event.detail.error, event.detail.values);
  }) as EventListener);
  return el;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    mountWaitlist();
  });
} else {
  mountWaitlist();
}
