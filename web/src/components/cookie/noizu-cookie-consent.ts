import {LitElement, html, css, nothing} from 'lit';
import type {PropertyValues} from 'lit';
import {property, state} from 'lit/decorators.js';
import {
  SETTINGS_OPEN_EVENT,
  acceptAllConsent,
  consentCategoryDetails,
  defaultConsentPreferences,
  dispatchConsentChange,
  getConsentState,
  rejectOptionalConsent,
  setConsentPreferences,
  DEFAULT_STORAGE_KEY,
  type ConsentCategory,
  type ConsentPreferences,
  type ConsentState,
} from './consent.js';
import {defineElement} from '../../define.js';

/** Light DOM. Registry: noizu-cookie-consent. */
@defineElement('noizu-cookie-consent')
export class NoizuCookieConsent extends LitElement {
  static override styles = css`
    :host {
      display: block;
    }
  `;

  @property({attribute: 'storage-key'})
  storageKey = DEFAULT_STORAGE_KEY;

  @property()
  mode = 'categories';

  @state()
  private decision: ConsentState | null = null;

  @state()
  private settingsOpen = false;

  @state()
  private draft: ConsentPreferences = {...defaultConsentPreferences};

  protected override createRenderRoot() {
    return this;
  }

  override connectedCallback() {
    super.connectedCallback();
    this.syncFromStorage();
    window.addEventListener('storage', this.onStorage);
    window.addEventListener(SETTINGS_OPEN_EVENT, this.onSettingsOpen);
  }

  override disconnectedCallback() {
    window.removeEventListener('storage', this.onStorage);
    window.removeEventListener(SETTINGS_OPEN_EVENT, this.onSettingsOpen);
    super.disconnectedCallback();
  }

  protected override updated(changed: PropertyValues<this>) {
    if (changed.has('storageKey') && changed.get('storageKey') !== undefined) {
      this.syncFromStorage();
    }
  }

  private readonly onSettingsOpen = () => {
    this.settingsOpen = true;
    this.draft = this.decision?.categories ?? {...defaultConsentPreferences};
  };

  private readonly onStorage = (event: StorageEvent) => {
    if (event.key !== this.storageKey) return;
    this.syncFromStorage();
    dispatchConsentChange(this, this.decision);
  };

  private syncFromStorage() {
    this.decision = getConsentState(this.storageKey);
    this.draft = this.decision?.categories ?? {...defaultConsentPreferences};
  }

  private commit(state: ConsentState) {
    this.decision = state;
    this.draft = state.categories;
    this.settingsOpen = false;
    dispatchConsentChange(this, state);
  }

  private readonly onAcceptAll = () => {
    this.commit(acceptAllConsent(this.storageKey));
  };

  private readonly onRejectOptional = () => {
    this.commit(rejectOptionalConsent(this.storageKey));
  };

  private readonly onSave = () => {
    this.commit(setConsentPreferences(this.storageKey, this.draft));
  };

  private readonly onCancelSettings = () => {
    this.settingsOpen = false;
    this.draft = this.decision?.categories ?? {...defaultConsentPreferences};
  };

  private onDraftChange(id: ConsentCategory, event: Event) {
    if (id === 'necessary') return;
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    this.draft = {...this.draft, necessary: true, [id]: target.checked};
  }

  private get showBanner() {
    return !this.decision || this.settingsOpen;
  }

  private get categoriesMode() {
    return this.mode !== 'essential-all';
  }

  override render() {
    if (!this.showBanner) return nothing;

    return html`
      <section class="card" role="dialog" aria-modal="false" data-cy="cookie.banner">
        <p>Cookie choices</p>
        <p>
          We use necessary storage to keep this app working. Optional categories are
          disabled until you approve them, and you can change your choice later.
        </p>
        ${this.categoriesMode
          ? consentCategoryDetails.map(
              (category) => html`
                <label class="hui checkbox-wrap">
                  <input
                    type="checkbox"
                    data-cy="cookie.category"
                    aria-label="${category.label} cookies"
                    .checked=${this.draft[category.id]}
                    ?disabled=${category.required}
                    @change=${(event: Event) => this.onDraftChange(category.id, event)}
                  />
                  ${category.label}
                </label>
              `,
            )
          : nothing}
        <div>
          ${this.settingsOpen && this.decision
            ? html`
                <button
                  type="button"
                  class="btn btn-outline"
                  @click=${this.onCancelSettings}
                >
                  Cancel
                </button>
              `
            : nothing}
          <button type="button" class="btn" data-cy="cookie.accept-all" @click=${this.onAcceptAll}>
            Accept all
          </button>
          <button
            type="button"
            class="btn btn-outline"
            data-cy="cookie.reject-optional"
            @click=${this.onRejectOptional}
          >
            ${this.categoriesMode ? 'Reject optional' : 'Necessary only'}
          </button>
          ${this.categoriesMode
            ? html`
                <button
                  type="button"
                  class="btn btn-outline"
                  data-cy="cookie.save"
                  @click=${this.onSave}
                >
                  Save
                </button>
              `
            : nothing}
        </div>
      </section>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'noizu-cookie-consent': NoizuCookieConsent;
  }
}
