/**
 * `<noizu-model-config>` — model picker island.
 *
 * Properties down, events up. The host persists (e.g. TRK `GET`/`PATCH`
 * `/api/v1/ai/settings`). This element never stores secrets and never logs keys.
 */

import {LitElement, css, html, nothing, type PropertyValues, type TemplateResult} from 'lit';
import {property, state} from 'lit/decorators.js';
import {live} from 'lit/directives/live.js';

import {emit} from '../../events.js';
import {toborKitControls, toborKitTokens} from '../mode-toggle/theme.js';
import {
  CUSTOM_OPTION,
  INHERIT_OPTION,
  apiKeyForSave,
  customSpec,
  isCustomValue,
  isInheritValue,
  isMaskedSecret,
  parseCatalogPayload,
  specOf,
  type CustomEndpoint,
  type ModelCatalogEntry,
} from './catalog.js';
import {defineElement} from '../../define.js';

export type {CustomEndpoint, ModelCatalogEntry} from './catalog.js';
export {
  CUSTOM_OPTION,
  CUSTOM_PREFIX,
  INHERIT_OPTION,
  INHERIT_VALUE,
  apiKeyForSave,
  customSpec,
  isCustomValue,
  isInheritValue,
  isMaskedSecret,
  parseCatalogPayload,
  specOf,
} from './catalog.js';

export interface ModelChangeDetail {
  value: string;
}

export interface CustomEndpointSaveDetail {
  baseUrl: string;
  model: string;
  /** Empty string means keep the stored key. Never log. */
  apiKey: string;
}

export interface BudgetChangeDetail {
  amount: number;
}

@defineElement('noizu-model-config')
export class NoizuModelConfig extends LitElement {
  static override styles = [
    toborKitTokens,
    toborKitControls,
    css`
      :host {
        display: block;
      }

      .stack {
        display: grid;
        gap: var(--_gap);
      }

      .field {
        display: grid;
        gap: 4px;
      }

      .field span,
      legend {
        font-size: 0.85em;
        color: var(--_muted);
      }

      select,
      input {
        font: inherit;
        color: inherit;
        background: var(--_surface);
        border: 1px solid var(--_border);
        border-radius: calc(var(--_radius) / 2);
        padding: 6px 10px;
      }

      fieldset {
        margin: 0;
        padding: var(--_gap);
        border: 1px solid var(--_border);
        border-radius: var(--_radius);
        display: grid;
        gap: var(--_gap);
      }

      button[part='save'] {
        justify-self: start;
      }
    `,
  ];

  /** Catalog entries. Property-only — not an HTML attribute. */
  @property({attribute: false})
  catalog: ModelCatalogEntry[] = [];

  /** GET JSON catalog (array, `{catalog}`, `{models}`, or `{entries}`). */
  @property({attribute: 'catalog-url'})
  catalogUrl = '';

  /** `provider:model` spec. Empty / `inherit` means inherit when `inherit` is on. */
  @property({type: String, reflect: true})
  value = '';

  /** When true, the picker includes an Inherit option. Host owns nearest-ancestor-wins. */
  @property({type: Boolean})
  inherit = false;

  /** OpenAI-compatible base URL + model + key. */
  @property({type: Boolean, attribute: 'allow-custom'})
  allowCustom = false;

  /** Simple budget number input. */
  @property({type: Boolean, attribute: 'allow-budget'})
  allowBudget = false;

  /** Current budget amount (unit is host-owned). */
  @property({type: Number})
  budget: number | null = null;

  /** Optional custom endpoint (may include a masked `apiKey`). Property-only. */
  @property({attribute: false})
  customEndpoint: CustomEndpoint | null = null;

  @state()
  private loaded: ModelCatalogEntry[] = [];

  @state()
  private catalogError = '';

  private draftBaseUrl = '';
  private draftModel = '';
  private draftApiKey = '';

  private readonly uid = `mc-${Math.random().toString(36).slice(2, 8)}`;
  private abort: AbortController | null = null;

  override disconnectedCallback(): void {
    this.abort?.abort();
    super.disconnectedCallback();
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('customEndpoint')) {
      this.applyCustom(this.customEndpoint);
    }
  }

  protected override updated(changed: PropertyValues<this>): void {
    if (changed.has('catalogUrl')) {
      void this.fetchCatalog(this.catalogUrl);
    }
  }

  override render(): TemplateResult {
    const entries = this.entries();
    const selected = this.selectValue(entries);
    const showCustom = this.allowCustom && selected === CUSTOM_OPTION;
    const pickerId = `${this.uid}-picker`;
    const budgetId = `${this.uid}-budget`;

    return html`
      <div class="stack">
        <label class="field" for=${pickerId}>
          <span>Model</span>
          <select
            id=${pickerId}
            part="picker"
            data-cy="model.picker"
            aria-label="Model"
            .value=${live(selected)}
            @change=${this.onPick}
          >
            ${this.inherit
              ? html`<option value=${INHERIT_OPTION}>Inherit</option>`
              : nothing}
            ${!this.inherit && !this.value
              ? html`<option value="" disabled>Select a model…</option>`
              : nothing}
            ${entries.map((entry) => {
              const spec = specOf(entry);
              return html`<option value=${spec}>${entry.label?.trim() || spec}</option>`;
            })}
            ${this.allowCustom ? html`<option value=${CUSTOM_OPTION}>Custom…</option>` : nothing}
            ${this.orphanOption(entries, selected)
              ? html`<option value=${this.value}>${this.value}</option>`
              : nothing}
          </select>
        </label>
        ${this.catalogError
          ? html`<div class="notice notice--error" role="status">${this.catalogError}</div>`
          : nothing}
        ${showCustom ? this.renderCustom() : nothing}
        ${this.allowBudget
          ? html`
              <label class="field" for=${budgetId}>
                <span>Budget</span>
                <input
                  id=${budgetId}
                  part="budget"
                  data-cy="model.budget"
                  type="number"
                  min="0"
                  step="any"
                  inputmode="decimal"
                  aria-label="Budget"
                  .value=${live(this.budget == null || Number.isNaN(this.budget) ? '' : String(this.budget))}
                  @change=${this.onBudget}
                />
              </label>
            `
          : nothing}
      </div>
    `;
  }

  private renderCustom(): TemplateResult {
    const baseId = `${this.uid}-base`;
    const modelId = `${this.uid}-model`;
    const keyId = `${this.uid}-key`;
    const masked = isMaskedSecret(this.draftApiKey);
    return html`
      <fieldset part="custom" data-cy="model.custom">
        <legend>Custom endpoint</legend>
        <label class="field" for=${baseId}>
          <span>Base URL</span>
          <input
            id=${baseId}
            name="baseUrl"
            type="url"
            autocomplete="off"
            placeholder="https://api.openai.com/v1"
            .value=${live(this.draftBaseUrl)}
            @input=${this.onBaseUrl}
          />
        </label>
        <label class="field" for=${modelId}>
          <span>Model</span>
          <input
            id=${modelId}
            name="model"
            type="text"
            autocomplete="off"
            .value=${live(this.draftModel)}
            @input=${this.onCustomModel}
          />
        </label>
        <label class="field" for=${keyId}>
          <span>API key</span>
          <input
            id=${keyId}
            name="apiKey"
            type=${masked ? 'text' : 'password'}
            autocomplete="off"
            spellcheck="false"
            .value=${live(this.draftApiKey)}
            @input=${this.onApiKey}
          />
        </label>
        <button part="save" type="button" data-cy="model.save" @click=${this.onSave}>
          Save endpoint
        </button>
      </fieldset>
    `;
  }

  private entries(): ModelCatalogEntry[] {
    return this.catalog.length ? this.catalog : this.loaded;
  }

  private selectValue(entries: ModelCatalogEntry[]): string {
    if (this.inherit && isInheritValue(this.value)) return INHERIT_OPTION;
    if (this.allowCustom && this.isCustomSelection(entries)) return CUSTOM_OPTION;
    return this.value;
  }

  private isCustomSelection(entries: ModelCatalogEntry[]): boolean {
    if (isCustomValue(this.value)) return true;
    if (!this.value || isInheritValue(this.value)) return false;
    return !entries.some((entry) => specOf(entry) === this.value);
  }

  private orphanOption(entries: ModelCatalogEntry[], selected: string): boolean {
    if (!this.value || isInheritValue(this.value) || selected === CUSTOM_OPTION) return false;
    if (selected === INHERIT_OPTION) return false;
    return !entries.some((entry) => specOf(entry) === this.value);
  }

  private onPick(event: Event): void {
    const select = event.currentTarget;
    if (!(select instanceof HTMLSelectElement)) return;
    const picked = select.value;
    if (picked === INHERIT_OPTION) {
      this.value = '';
      emit<ModelChangeDetail>(this, 'model-change', {value: ''});
      return;
    }
    if (picked === CUSTOM_OPTION) {
      const next = customSpec(this.draftModel);
      this.value = next;
      emit<ModelChangeDetail>(this, 'model-change', {value: next});
      return;
    }
    this.value = picked;
    emit<ModelChangeDetail>(this, 'model-change', {value: picked});
  }

  private onBudget(event: Event): void {
    const input = event.currentTarget;
    if (!(input instanceof HTMLInputElement)) return;
    const amount = input.value === '' ? 0 : Number(input.value);
    if (!Number.isFinite(amount)) return;
    this.budget = amount;
    emit<BudgetChangeDetail>(this, 'budget-change', {amount});
  }

  private onBaseUrl(event: Event): void {
    const input = event.currentTarget;
    if (!(input instanceof HTMLInputElement)) return;
    this.draftBaseUrl = input.value;
    this.requestUpdate();
  }

  private onCustomModel(event: Event): void {
    const input = event.currentTarget;
    if (!(input instanceof HTMLInputElement)) return;
    this.draftModel = input.value;
    this.requestUpdate();
  }

  private onApiKey(event: Event): void {
    const input = event.currentTarget;
    if (!(input instanceof HTMLInputElement)) return;
    this.draftApiKey = input.value;
    this.requestUpdate();
  }

  private onSave(): void {
    const baseUrl = this.draftBaseUrl.trim();
    const model = this.draftModel.trim();
    const apiKey = apiKeyForSave(this.draftApiKey);
    const spec = customSpec(model);
    this.value = spec;
    emit<CustomEndpointSaveDetail>(this, 'custom-endpoint-save', {baseUrl, model, apiKey});
    emit<ModelChangeDetail>(this, 'model-change', {value: spec});
    if (apiKey) {
      this.draftApiKey = '';
      this.requestUpdate();
    }
  }

  private applyCustom(endpoint: CustomEndpoint | null): void {
    if (!endpoint) return;
    this.draftBaseUrl = endpoint.baseUrl ?? '';
    this.draftModel = endpoint.model ?? '';
    if (endpoint.apiKey != null) this.draftApiKey = endpoint.apiKey;
  }

  private async fetchCatalog(url: string): Promise<void> {
    this.abort?.abort();
    this.catalogError = '';
    if (!url.trim()) {
      this.loaded = [];
      return;
    }
    const ac = new AbortController();
    this.abort = ac;
    try {
      const href = resolveUrl(url.trim());
      const res = await fetch(href, {
        method: 'GET',
        headers: {Accept: 'application/json'},
        credentials: 'same-origin',
        signal: ac.signal,
      });
      if (!res.ok) {
        this.loaded = [];
        this.catalogError = 'Could not load the model catalog.';
        return;
      }
      const payload = parseCatalogPayload(await res.json());
      if (ac.signal.aborted) return;
      this.loaded = payload.entries;
      if (!this.customEndpoint && payload.custom) this.applyCustom(payload.custom);
    } catch {
      if (ac.signal.aborted) return;
      this.loaded = [];
      this.catalogError = 'Could not load the model catalog.';
    }
  }
}

function resolveUrl(url: string): string {
  try {
    return new URL(url, globalThis.location?.href ?? 'https://localhost/').href;
  } catch {
    return url;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'noizu-model-config': NoizuModelConfig;
  }
}
