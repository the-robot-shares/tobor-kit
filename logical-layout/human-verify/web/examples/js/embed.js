/**
 * Vanilla mount for noizu-human-verify.
 * Host: import '@noizu/tobor-kit/human-verify';
 */
import '../../noizu-human-verify.js';

export function mountHumanVerify(host = document.body) {
  const el =
    host.querySelector('noizu-human-verify') ??
    host.appendChild(document.createElement('noizu-human-verify'));
  el.provider = 'none';
  el.action = 'signup';
  // Public site key only when using turnstile / recaptcha-v3:
  // el.provider = 'turnstile';
  // el.siteKey = 'PUBLIC_SITE_KEY';
  el.addEventListener('verified', (event) => {
    // NOT proof. Host must POST the token to siteverify (server-side secret).
    fetch('/verify', {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify(event.detail),
    })
      .then((res) => res.json())
      .then((body) => console.info('verify', body))
      .catch(() => {});
  });
  return el;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => mountHumanVerify());
} else {
  mountHumanVerify();
}
