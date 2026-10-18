/**
 * Vanilla mount for noizu-phone-input.
 * Host: import '@noizu/tobor-kit/phone-input';
 *
 * Host-owned: uniqueness / OTP. Never put secrets on the element.
 */
import '../../noizu-phone-input.js';

export function mountPhoneInput(host = document.body, options = {}) {
  const el =
    host.querySelector('noizu-phone-input') ??
    host.appendChild(document.createElement('noizu-phone-input'));
  el.country = options.country ?? 'US';
  el.mobileOnly = options.mobileOnly ?? false;
  el.name = options.name ?? 'phone';
  el.disabled = options.disabled ?? false;
  if (options.value) el.value = options.value;
  el.addEventListener('country-change', (event) => {
    host.dataset.country = event.detail.country;
    host.dataset.dial = event.detail.dial;
    options.onCountryChange?.(event.detail);
  });
  el.addEventListener('phone-change', (event) => {
    host.dataset.value = event.detail.value;
    options.onPhoneChange?.(event.detail);
  });
  el.addEventListener('phone-invalid', (event) => {
    options.onPhoneInvalid?.(event.detail);
  });
  return el;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => mountPhoneInput());
} else {
  mountPhoneInput();
}
