/**
 * Typed mount for noizu-phone-input.
 * Host (published): import {NoizuPhoneInput, type PhoneChangeDetail} from '@noizu/tobor-kit/phone-input';
 *
 * Host-owned: uniqueness / OTP. Never put secrets on the element.
 */
import '../../noizu-phone-input.js';
import type {
  CountryChangeDetail,
  NoizuPhoneInput,
  PhoneChangeDetail,
  PhoneInvalidDetail,
} from '../../noizu-phone-input.js';

export interface MountPhoneInputOptions {
  country?: string;
  mobileOnly?: boolean;
  name?: string;
  disabled?: boolean;
  value?: string;
  onCountryChange?: (detail: CountryChangeDetail) => void;
  onPhoneChange?: (detail: PhoneChangeDetail) => void;
  onPhoneInvalid?: (detail: PhoneInvalidDetail) => void;
}

export function mountPhoneInput(
  host: HTMLElement = document.body,
  options: MountPhoneInputOptions = {},
): NoizuPhoneInput {
  const el = (host.querySelector('noizu-phone-input') ??
    host.appendChild(document.createElement('noizu-phone-input'))) as NoizuPhoneInput;
  el.country = options.country ?? 'US';
  el.mobileOnly = options.mobileOnly ?? false;
  el.name = options.name ?? 'phone';
  el.disabled = options.disabled ?? false;
  if (options.value) el.value = options.value;
  el.addEventListener('country-change', ((event: CustomEvent<CountryChangeDetail>) => {
    host.dataset.country = event.detail.country;
    host.dataset.dial = event.detail.dial;
    options.onCountryChange?.(event.detail);
  }) as EventListener);
  el.addEventListener('phone-change', ((event: CustomEvent<PhoneChangeDetail>) => {
    host.dataset.value = event.detail.value;
    options.onPhoneChange?.(event.detail);
  }) as EventListener);
  el.addEventListener('phone-invalid', ((event: CustomEvent<PhoneInvalidDetail>) => {
    options.onPhoneInvalid?.(event.detail);
  }) as EventListener);
  return el;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    mountPhoneInput();
  });
} else {
  mountPhoneInput();
}
