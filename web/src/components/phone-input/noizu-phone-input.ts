/**
 * `<noizu-phone-input>` — country selector + national number, E.164 `value`.
 *
 * Events up via `emit()`: `country-change`, `phone-change`, `phone-invalid`.
 * Hosts own uniqueness / OTP. No libphonenumber-js.
 */

import {LitElement, html, css, nothing, type PropertyValues, type TemplateResult} from 'lit';
import {property, state} from 'lit/decorators.js';
import {toborKitControls, toborKitTokens} from '../mode-toggle/theme.js';
import {emit} from '../../events.js';
import {
  DEFAULT_COUNTRY,
  DIAL_CODES,
  digitsOnly,
  isValidE164,
  lookupCountry,
  parseE164,
  toE164,
  type DialEntry,
} from './dial-codes.js';
import {defineElement} from '../../define.js';

export {
  DEFAULT_COUNTRY,
  DIAL_CODES,
  digitsOnly,
  flagEmoji,
  isValidE164,
  lookupCountry,
  parseE164,
  toE164,
} from './dial-codes.js';
export type {DialEntry, ParsedPhone} from './dial-codes.js';

export interface CountryChangeDetail {
  country: string;
  dial: string;
}

export interface PhoneChangeDetail {
  value: string;
}

export interface PhoneInvalidDetail {
  value: string;
}

@defineElement('noizu-phone-input')
export class NoizuPhoneInput extends LitElement {
  static override styles = [
    toborKitTokens,
    toborKitControls,
    css`
      :host {
        display: inline-block;
        width: 100%;
        max-width: 28rem;
      }

      .row {
        display: flex;
        align-items: stretch;
        gap: 6px;
        background: var(--_surface);
        border: 1px solid var(--_border);
        border-radius: var(--_radius);
        padding: 4px 6px;
      }

      .row[data-invalid='true'] {
        border-color: var(--_danger);
      }

      select,
      input {
        font: inherit;
        color: inherit;
        background: transparent;
        border: 0;
        min-width: 0;
      }

      select {
        max-width: 9.5rem;
        padding: 6px 4px;
        cursor: pointer;
      }

      .dial {
        display: flex;
        align-items: center;
        color: var(--_muted);
        white-space: nowrap;
        padding: 0 2px;
      }

      input {
        flex: 1;
        padding: 6px 8px;
      }

      :host([disabled]) {
        opacity: 0.5;
      }
    `,
  ];

  /** ISO-3166 alpha-2. Unknown values fall back to US. */
  @property({type: String, reflect: true})
  country = DEFAULT_COUNTRY;

  /** Digit-only national input; `inputmode=tel`, `autocomplete=tel-national`. */
  @property({type: Boolean, attribute: 'mobile-only', reflect: true})
  mobileOnly = false;

  @property({type: String, reflect: true})
  name = '';

  /** ID(s) of a description element that lives in the **same tree scope** as this element's
   * light-DOM host tag (e.g. a sibling `<p id="…">` in the parent's shadow root). Forwarded onto
   * the inner `<input>` so cross-shadow `aria-describedby` from a host like `<noizu-auth>`
   * resolves — an `aria-describedby` set directly on the `<noizu-phone-input>` host tag would
   * not reach this element's own inner shadow DOM. */
  @property({type: String, attribute: 'described-by', reflect: true})
  describedBy = '';

  @property({type: Boolean, reflect: true})
  disabled = false;

  /** E.164 `+<dial><national-digits>`. */
  @property({type: String, reflect: true})
  value = '';

  @state()
  private national = '';

  /** True when `value` / `country` were written from user input this turn. */
  private skipSync = false;
  private booted = false;

  private get entry(): DialEntry {
    return lookupCountry(this.country);
  }

  override render(): TemplateResult {
    const entry = this.entry;
    const invalid = Boolean(this.value) && !isValidE164(this.value);
    return html`
      <div class="row" part="field" data-invalid=${invalid ? 'true' : 'false'}>
        <select
          part="country"
          data-cy="phone.country"
          aria-label="Country"
          ?disabled=${this.disabled}
          @change=${this.onCountryChange}
        >
          ${DIAL_CODES.map(
            (row) => html`
              <option value=${row.iso2} ?selected=${row.iso2 === entry.iso2}>
                ${row.flag} ${row.iso2} +${row.dial}
              </option>
            `,
          )}
        </select>
        <span class="dial" part="dial" data-cy="phone.dial">+${entry.dial}</span>
        <input
          part="input"
          data-cy="phone.input"
          type="tel"
          inputmode="tel"
          autocomplete=${this.mobileOnly ? 'tel-national' : 'tel'}
          name=${this.name || ''}
          aria-label="Phone number"
          aria-invalid=${invalid ? 'true' : 'false'}
          aria-describedby=${this.describedBy || nothing}
          .value=${this.national}
          ?disabled=${this.disabled}
          @input=${this.onInput}
        />
      </div>
    `;
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('country')) {
      const next = lookupCountry(this.country).iso2;
      if (next !== this.country) this.country = next;
    }
    if (this.skipSync) return;
    if (!this.booted || changed.has('value')) {
      this.applyIncomingValue();
      return;
    }
    if (changed.has('country')) {
      const e164 = toE164(this.country, this.national);
      if (this.value !== e164) this.value = e164;
    }
  }

  protected override updated(): void {
    this.skipSync = false;
    this.booted = true;
  }

  private applyIncomingValue(): void {
    if (!this.value) {
      this.national = '';
      return;
    }
    const parsed = parseE164(this.value, this.country);
    if (!parsed) return;
    this.national = parsed.national;
    if (parsed.country !== this.country) this.country = parsed.country;
  }

  private onCountryChange(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;
    const entry = lookupCountry(target.value);
    this.skipSync = true;
    this.country = entry.iso2;
    emit<CountryChangeDetail>(this, 'country-change', {
      country: entry.iso2,
      dial: `+${entry.dial}`,
    });
    this.pushValue(toE164(entry.iso2, this.national), Boolean(digitsOnly(this.national)));
  }

  private onInput(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    let next = target.value;
    if (this.mobileOnly) next = digitsOnly(next);
    const trimmed = next.trim();
    if (trimmed.startsWith('+') || trimmed.startsWith('00')) {
      const parsed = parseE164(trimmed, this.country);
      if (parsed) {
        if (parsed.country !== this.country) {
          this.skipSync = true;
          this.country = parsed.country;
          emit<CountryChangeDetail>(this, 'country-change', {
            country: parsed.country,
            dial: `+${parsed.dial}`,
          });
        }
        this.national = parsed.national;
        this.pushValue(
          parsed.national ? `+${parsed.dial}${parsed.national}` : '',
          true,
        );
        return;
      }
    }
    this.national = next;
    this.pushValue(toE164(this.country, next), true);
  }

  private pushValue(e164: string, reportInvalid: boolean): void {
    if (this.value !== e164) {
      this.skipSync = true;
      this.value = e164;
      emit<PhoneChangeDetail>(this, 'phone-change', {value: e164});
    }
    if (reportInvalid && !isValidE164(e164)) {
      emit<PhoneInvalidDetail>(this, 'phone-invalid', {value: e164});
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'noizu-phone-input': NoizuPhoneInput;
  }
  interface HTMLElementEventMap {
    'country-change': CustomEvent<CountryChangeDetail>;
    'phone-change': CustomEvent<PhoneChangeDetail>;
    'phone-invalid': CustomEvent<PhoneInvalidDetail>;
  }
}
