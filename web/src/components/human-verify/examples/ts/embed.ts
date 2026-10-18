/**
 * Typed mount for noizu-human-verify.
 * Host: import {NoizuHumanVerify, type HumanVerifyDetail} from '@noizu/tobor-kit/human-verify';
 */
import '../../noizu-human-verify.js';
import type {HumanVerifyDetail, NoizuHumanVerify} from '../../noizu-human-verify.js';

export function mountHumanVerify(host: HTMLElement = document.body): NoizuHumanVerify {
  const el = (host.querySelector('noizu-human-verify') ??
    host.appendChild(document.createElement('noizu-human-verify'))) as NoizuHumanVerify;
  el.provider = 'none';
  el.action = 'signup';
  // Public site key only when using turnstile / recaptcha-v3:
  // el.provider = 'turnstile';
  // el.siteKey = 'PUBLIC_SITE_KEY';
  el.addEventListener('verified', ((event: CustomEvent<HumanVerifyDetail>) => {
    // NOT proof. Host must POST the token to siteverify (server-side secret).
    void fetch('/verify', {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify(event.detail),
    })
      .then((res) => res.json())
      .then((body: unknown) => console.info('verify', body))
      .catch(() => {});
  }) as EventListener);
  return el;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    mountHumanVerify();
  });
} else {
  mountHumanVerify();
}
