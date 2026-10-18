/**
 * `<tobor-configurator>` — schema-driven playground form.
 *
 * Consumes a ConfiguratorSchema via the `schema` property (JS-only), a child
 * `<script type="application/json">`, or `schema-src` (JSON fetch). Renders a
 * form, live-previews the target tag in `.demo-frame`, and emits a copyable
 * snippet. Hosts insert markup from `configurator-apply`; this island carries
 * no secrets.
 */

import {LitElement, css, html, nothing, type PropertyValues, type TemplateResult} from 'lit';
import {property, state} from 'lit/decorators.js';

import type {ConfiguratorField, ConfiguratorSchema} from '../../configurator-schema.js';
import {emit} from '../../events.js';
import {toborKitControls, toborKitTokens} from '../mode-toggle/theme.js';
import {defineElement} from '../../define.js';

export type {
  ConfiguratorBackend,
  ConfiguratorCssVariable,
  ConfiguratorEvent,
  ConfiguratorField,
  ConfiguratorFieldType,
  ConfiguratorGroup,
  ConfiguratorMethod,
  ConfiguratorSchema,
} from '../../configurator-schema.js';

export interface ConfiguratorSnapshot {
  tag: string;
  attributes: Record<string, unknown>;
  slots: Record<string, string>;
}

export type ConfiguratorChangeDetail = ConfiguratorSnapshot;
export type ConfiguratorApplyDetail = ConfiguratorSnapshot;

const JSON_SCRIPT = 'script[type="application/json"]';

@defineElement('tobor-configurator')
export class ToborConfigurator extends LitElement {
  static override styles = [
    toborKitTokens,
    toborKitControls,
    css`
      :host {
        display: block;
      }

      .layout {
        display: grid;
        gap: var(--_gap);
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        align-items: start;
      }

      @media (max-width: 800px) {
        .layout {
          grid-template-columns: 1fr;
        }
      }

      form,
      .side {
        display: grid;
        gap: var(--_gap);
        min-width: 0;
      }

      form {
        background: var(--_surface);
        border: 1px solid var(--_border);
        border-radius: var(--_radius);
        padding: var(--_gap);
      }

      fieldset {
        margin: 0;
        padding: var(--_gap);
        display: grid;
        gap: var(--_gap);
        border: 1px solid var(--_border);
        border-radius: calc(var(--_radius) / 2);
      }

      legend {
        color: var(--_muted);
        padding: 0 4px;
      }

      .field {
        display: grid;
        gap: 4px;
      }

      .field-head {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        align-items: baseline;
      }

      .req {
        color: var(--_danger);
      }

      .hint {
        margin: 0;
        font-size: 0.85em;
      }

      label {
        font-size: 0.9em;
      }

      input,
      select,
      textarea {
        font: inherit;
        color: inherit;
        background: var(--_bg);
        border: 1px solid var(--_border);
        border-radius: calc(var(--_radius) / 2);
        padding: 6px 10px;
        width: 100%;
      }

      input[type='checkbox'] {
        width: auto;
        accent-color: var(--_accent);
      }

      input[type='color'] {
        width: 2.5rem;
        height: 2rem;
        padding: 0;
        background: transparent;
      }

      textarea {
        min-height: 5rem;
        resize: vertical;
      }

      textarea.mono,
      pre {
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      }

      .checks {
        display: flex;
        flex-wrap: wrap;
        gap: 8px 12px;
      }

      .checks label {
        display: inline-flex;
        gap: 6px;
        align-items: center;
      }

      .color-row,
      .tag-row,
      .actions,
      .snippet-bar {
        display: flex;
        gap: 8px;
        align-items: center;
      }

      .snippet-bar {
        justify-content: space-between;
      }

      .tags {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        align-items: center;
      }

      .chip {
        display: inline-flex;
        gap: 4px;
        align-items: center;
        border: 1px solid var(--_border);
        border-radius: 999px;
        padding: 2px 8px;
        font-size: 0.85em;
      }

      .chip button {
        padding: 0 4px;
        border: none;
      }

      .demo-frame {
        min-height: 4rem;
        padding: var(--_gap);
        background: var(--_bg);
        border: 1px dashed var(--_border);
        border-radius: var(--_radius);
      }

      pre {
        margin: 0;
        overflow: auto;
        padding: 8px 10px;
        font-size: 0.85em;
        white-space: pre-wrap;
        background: var(--_surface);
        border: 1px solid var(--_border);
        border-radius: calc(var(--_radius) / 2);
      }

      .actions {
        justify-content: flex-end;
      }
    `,
  ];

  /** Declarative schema. JS property, not an HTML attribute. */
  @property({attribute: false})
  schema?: ConfiguratorSchema;

  /** URL of a JSON ConfiguratorSchema document. */
  @property({type: String, attribute: 'schema-src'})
  schemaSrc = '';

  @state()
  private _resolved?: ConfiguratorSchema;

  @state()
  private _values: Record<string, unknown> = {};

  @state()
  private _slots: Record<string, string> = {};

  @state()
  private _error = '';

  @state()
  private _loading = false;

  @state()
  private _copied = false;

  @state()
  private _jsonDrafts: Record<string, string> = {};

  @state()
  private _jsonErrors: Record<string, string> = {};

  @state()
  private _tagDrafts: Record<string, string> = {};

  #idBase = `cfg-${Math.random().toString(36).slice(2, 8)}`;
  #observer?: MutationObserver;
  #abort?: AbortController;
  #scriptText = '';
  #parsedScript?: ConfiguratorSchema;
  #scriptInvalid = false;
  #dirtySource = false;
  #fetched?: ConfiguratorSchema;
  #fetchedSrc = '';
  #failedSrc = '';
  #inFlightSrc = '';
  #pendingChange = false;
  #copyTimer?: number;
  #previewEl?: HTMLElement;
  #previewSlotHtml = '';

  override connectedCallback(): void {
    super.connectedCallback();
    this.#observer ??= new MutationObserver(() => {
      this.#dirtySource = true;
      this.requestUpdate();
    });
    this.#observer.observe(this, {childList: true, subtree: true, characterData: true});
  }

  override disconnectedCallback(): void {
    this.#observer?.disconnect();
    this.#cancelLoad();
    window.clearTimeout(this.#copyTimer);
    super.disconnectedCallback();
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    const schemaChanged = changed.has('schema') || changed.has('schemaSrc');
    if (schemaChanged || !this._resolved || this.#dirtySource) {
      this.#dirtySource = false;
      this.#beginResolve();
    }
    this.#syncPreview();
  }

  protected override updated(): void {
    if (!this.#pendingChange || !this._resolved) return;
    this.#pendingChange = false;
    emit(this, 'configurator-change', this.#snapshot());
  }

  /** Dispatch `configurator-apply` with the current `{tag, attributes, slots}`. */
  apply(): ConfiguratorSnapshot {
    const detail = this.#snapshot();
    emit(this, 'configurator-apply', detail);
    return detail;
  }

  override render(): TemplateResult | typeof nothing {
    if (this._error) {
      return html`<div class="notice notice--error" role="alert">${this._error}</div>`;
    }
    if (this._loading) {
      return html`<p class="muted" aria-busy="true">Loading schema</p>`;
    }
    if (!this._resolved) {
      return html`
        <p class="muted">
          Provide a <code>schema</code> property, a child
          <code>&lt;script type="application/json"&gt;</code>, or a
          <code>schema-src</code> URL.
        </p>
      `;
    }
    return html`
      <div class="layout">
        <form data-cy="configurator.form" part="form" novalidate @submit=${this.#onSubmit}>
          ${this.#renderGroups()}
          <div class="actions">
            <button type="submit" data-cy="configurator.apply" part="apply">Apply</button>
          </div>
        </form>
        <div class="side">
          <div
            class="demo-frame"
            data-cy="configurator.preview"
            part="preview"
            aria-label="Preview"
          >
            ${this.#previewEl ?? nothing}
          </div>
          <div>
            <div class="snippet-bar">
              <span class="muted">Snippet</span>
              <button type="button" @click=${this.#copySnippet}>
                ${this._copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <pre data-cy="configurator.snippet" part="snippet" aria-label="HTML snippet">${this.#snippetText()}</pre>
          </div>
        </div>
      </div>
    `;
  }

  #onSubmit = (event: Event): void => {
    event.preventDefault();
    this.apply();
  };

  #beginResolve(): void {
    if (isSchema(this.schema)) {
      this.#cancelLoad();
      this.#scriptInvalid = false;
      this.#adopt(this.schema);
      return;
    }
    const fromScript = this.#readScript();
    if (fromScript) {
      this.#cancelLoad();
      this.#adopt(fromScript);
      return;
    }
    if (this.#scriptInvalid) {
      this.#cancelLoad();
      return;
    }
    const src = this.schemaSrc.trim();
    if (src) {
      if (this.#fetched && this.#fetchedSrc === src) {
        this.#adopt(this.#fetched);
        return;
      }
      if (this.#failedSrc === src || this.#inFlightSrc === src) return;
      void this.#loadSrc(src);
      return;
    }
    this._resolved = undefined;
    this._values = {};
    this._slots = {};
    this._loading = false;
    this._error = '';
  }

  #readScript(): ConfiguratorSchema | undefined {
    const node = this.querySelector(JSON_SCRIPT);
    const text = node?.textContent?.trim() ?? '';
    if (!text) {
      this.#scriptInvalid = false;
      this.#scriptText = '';
      return undefined;
    }
    if (text === this.#scriptText) {
      return this.#scriptInvalid ? undefined : this.#parsedScript;
    }
    this.#scriptText = text;
    try {
      const schema = asSchema(JSON.parse(text) as unknown, 'inline script');
      this.#scriptInvalid = false;
      this.#parsedScript = schema;
      return schema;
    } catch (err) {
      this.#scriptInvalid = true;
      this.#parsedScript = undefined;
      this._resolved = undefined;
      this._error = err instanceof Error ? err.message : 'Invalid JSON schema';
      return undefined;
    }
  }

  async #loadSrc(src: string): Promise<void> {
    this.#cancelLoad();
    const ac = new AbortController();
    this.#abort = ac;
    this.#inFlightSrc = src;
    this._loading = true;
    this._error = '';
    try {
      const schema = await loadSchemaFromSrc(src, ac.signal);
      if (ac.signal.aborted) return;
      this.#fetched = schema;
      this.#fetchedSrc = src;
      this.#failedSrc = '';
      this.#inFlightSrc = '';
      this.#adopt(schema);
    } catch (err) {
      if (ac.signal.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
        return;
      }
      this.#inFlightSrc = '';
      this.#failedSrc = src;
      this._loading = false;
      this._resolved = undefined;
      this._error = err instanceof Error ? err.message : String(err);
    }
  }

  #cancelLoad(): void {
    this.#abort?.abort();
    this.#abort = undefined;
    this.#inFlightSrc = '';
  }

  #adopt(schema: ConfiguratorSchema): void {
    if (this._resolved === schema) return;
    const seeded = seedFromSchema(schema);
    this._resolved = schema;
    this._values = seeded.values;
    this._slots = seeded.slots;
    this._jsonDrafts = {};
    this._jsonErrors = {};
    this._tagDrafts = {};
    this._error = '';
    this._loading = false;
    this.#pendingChange = true;
  }

  #syncPreview(): void {
    const schema = this._resolved;
    if (!schema) {
      this.#previewEl = undefined;
      this.#previewSlotHtml = '';
      return;
    }
    if (!this.#previewEl || this.#previewEl.localName !== schema.tag) {
      this.#previewEl = document.createElement(schema.tag);
      this.#previewSlotHtml = '';
    }
    applyAttributes(this.#previewEl, schema, this._values);
    const inner = slotInnerHtml(this._slots);
    if (inner !== this.#previewSlotHtml) {
      this.#previewEl.innerHTML = inner;
      this.#previewSlotHtml = inner;
    }
  }

  #snapshot(): ConfiguratorSnapshot {
    const schema = this._resolved;
    if (!schema) return {tag: '', attributes: {}, slots: {}};
    return {
      tag: schema.tag,
      attributes: {...this._values},
      slots: {...this._slots},
    };
  }

  #snippetText(): string {
    const schema = this._resolved;
    if (!schema) return '';
    return buildSnippet(schema, this._values, this._slots);
  }

  #setValue(attr: string, value: unknown): void {
    if (Object.is(this._values[attr], value)) return;
    this._values = {...this._values, [attr]: value};
    this.#pendingChange = true;
  }

  #onTextInput(field: ConfiguratorField, event: Event): void {
    this.#setValue(field.attr, (event.target as HTMLInputElement | HTMLTextAreaElement).value);
  }

  #onNumberInput(field: ConfiguratorField, event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    if (raw === '') {
      this.#setValue(field.attr, '');
      return;
    }
    const n = Number(raw);
    this.#setValue(field.attr, Number.isFinite(n) ? n : raw);
  }

  #onBooleanInput(field: ConfiguratorField, event: Event): void {
    this.#setValue(field.attr, (event.target as HTMLInputElement).checked);
  }

  #onMultiToggle(attr: string, option: string, checked: boolean): void {
    const current = Array.isArray(this._values[attr]) ? [...(this._values[attr] as string[])] : [];
    const next = checked ? [...current.filter((item) => item !== option), option] : current.filter((item) => item !== option);
    this.#setValue(attr, next);
  }

  #onJsonInput(attr: string, event: Event): void {
    const raw = (event.target as HTMLTextAreaElement).value;
    this._jsonDrafts = {...this._jsonDrafts, [attr]: raw};
    try {
      const parsed: unknown = JSON.parse(raw);
      this._jsonErrors = {...this._jsonErrors, [attr]: ''};
      this.#setValue(attr, parsed);
    } catch {
      this._jsonErrors = {...this._jsonErrors, [attr]: 'Invalid JSON'};
    }
  }

  #addTag(attr: string, raw: string): void {
    const tag = raw.trim().replace(/,$/, '');
    if (!tag) return;
    const current = Array.isArray(this._values[attr]) ? [...(this._values[attr] as string[])] : [];
    if (!current.includes(tag)) current.push(tag);
    this.#setValue(attr, current);
    this._tagDrafts = {...this._tagDrafts, [attr]: ''};
  }

  #removeTag(attr: string, tag: string): void {
    const current = Array.isArray(this._values[attr]) ? (this._values[attr] as string[]) : [];
    this.#setValue(
      attr,
      current.filter((item) => item !== tag),
    );
  }

  #copySnippet = (): void => {
    const text = this.#snippetText();
    const markCopied = () => {
      this._copied = true;
      window.clearTimeout(this.#copyTimer);
      this.#copyTimer = window.setTimeout(() => {
        this._copied = false;
      }, 1600);
    };
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(text).then(markCopied, () => this.#selectSnippet());
      return;
    }
    this.#selectSnippet();
  };

  #selectSnippet(): void {
    const pre = this.renderRoot.querySelector('[data-cy="configurator.snippet"]');
    if (!pre) return;
    const range = document.createRange();
    range.selectNodeContents(pre);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }

  #renderGroups(): TemplateResult[] {
    const schema = this._resolved;
    if (!schema) return [];
    const groups = groupFields(schema.fields);
    return groups.map((group) => {
      const fields = html`${group.fields.map((field) => this.#renderField(field))}`;
      if (!group.name) return fields;
      return html`<fieldset>
        <legend>${group.name}</legend>
        ${fields}
      </fieldset>`;
    });
  }

  #renderField(field: ConfiguratorField): TemplateResult {
    const id = `${this.#idBase}-${field.attr.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
    return html`
      <div class="field" data-cy="configurator.field" data-field=${field.attr} part="field">
        <div class="field-head">
          <label for=${id}>${field.attr}</label>
          ${field.required ? html`<span class="req" title="Required" aria-hidden="true">*</span>` : nothing}
          ${field.uneditable ? html`<span class="muted">locked</span>` : nothing}
        </div>
        ${this.#renderControl(field, id)}
        ${field.description ? html`<p class="muted hint">${field.description}</p>` : nothing}
        ${this._jsonErrors[field.attr]
          ? html`<p class="notice notice--error">${this._jsonErrors[field.attr]}</p>`
          : nothing}
      </div>
    `;
  }

  #renderControl(field: ConfiguratorField, id: string): TemplateResult {
    const value = this._values[field.attr];
    const disabled = !!field.uneditable;
    const required = !!field.required;
    switch (field.type) {
      case 'text':
        return html`<textarea
          id=${id}
          name=${field.attr}
          rows="4"
          ?disabled=${disabled}
          ?required=${required}
          placeholder=${field.placeholder ?? ''}
          .value=${stringValue(value)}
          @input=${(event: Event) => this.#onTextInput(field, event)}
        ></textarea>`;
      case 'number':
        return html`<input
          id=${id}
          name=${field.attr}
          type="number"
          step="any"
          ?disabled=${disabled}
          ?required=${required}
          placeholder=${field.placeholder ?? ''}
          .value=${value === '' || value === undefined || value === null ? '' : String(value)}
          @input=${(event: Event) => this.#onNumberInput(field, event)}
        />`;
      case 'boolean':
        return html`<input
          id=${id}
          name=${field.attr}
          type="checkbox"
          ?disabled=${disabled}
          .checked=${!!value}
          @change=${(event: Event) => this.#onBooleanInput(field, event)}
        />`;
      case 'select':
        return html`<select
          id=${id}
          name=${field.attr}
          ?disabled=${disabled}
          ?required=${required}
          .value=${stringValue(value)}
          @change=${(event: Event) => this.#onTextInput(field, event)}
        >
          ${selectOptions(field, value).map(
            (option) => html`<option value=${option} ?selected=${option === value}>${option}</option>`,
          )}
        </select>`;
      case 'multiselect':
        return html`<div class="checks" role="group" aria-labelledby=${id}>
          <span id=${id} hidden>${field.attr}</span>
          ${(field.options ?? []).map((option) => {
            const checked = Array.isArray(value) && value.includes(option);
            return html`<label>
              <input
                type="checkbox"
                name=${field.attr}
                value=${option}
                ?disabled=${disabled}
                .checked=${checked}
                @change=${(event: Event) =>
                  this.#onMultiToggle(field.attr, option, (event.target as HTMLInputElement).checked)}
              />
              ${option}
            </label>`;
          })}
        </div>`;
      case 'color':
        return html`<div class="color-row">
          <input
            id=${id}
            name=${field.attr}
            type="color"
            ?disabled=${disabled}
            .value=${toColorInput(value)}
            @input=${(event: Event) => this.#onTextInput(field, event)}
          />
          <input
            type="text"
            ?disabled=${disabled}
            placeholder=${field.placeholder ?? '#rrggbb'}
            .value=${stringValue(value)}
            @input=${(event: Event) => this.#onTextInput(field, event)}
          />
        </div>`;
      case 'url':
        return html`<input
          id=${id}
          name=${field.attr}
          type="url"
          ?disabled=${disabled}
          ?required=${required}
          placeholder=${field.placeholder ?? 'https://'}
          .value=${stringValue(value)}
          @input=${(event: Event) => this.#onTextInput(field, event)}
        />`;
      case 'tag-list': {
        const tags = Array.isArray(value) ? (value as string[]) : [];
        return html`<div class="tag-row">
          <div class="tags">
            ${tags.map(
              (tag) => html`<span class="chip">
                ${tag}
                <button
                  type="button"
                  ?disabled=${disabled}
                  aria-label=${`Remove ${tag}`}
                  @click=${() => this.#removeTag(field.attr, tag)}
                >
                  ×
                </button>
              </span>`,
            )}
            <input
              id=${id}
              name=${field.attr}
              ?disabled=${disabled}
              placeholder=${field.placeholder ?? 'Add tag'}
              .value=${this._tagDrafts[field.attr] ?? ''}
              @input=${(event: Event) => {
                this._tagDrafts = {
                  ...this._tagDrafts,
                  [field.attr]: (event.target as HTMLInputElement).value,
                };
              }}
              @keydown=${(event: KeyboardEvent) => {
                if (event.key === 'Enter' || event.key === ',') {
                  event.preventDefault();
                  this.#addTag(field.attr, this._tagDrafts[field.attr] ?? '');
                }
              }}
              @blur=${() => {
                const draft = this._tagDrafts[field.attr]?.trim();
                if (draft) this.#addTag(field.attr, draft);
              }}
            />
          </div>
        </div>`;
      }
      case 'json': {
        const text = this._jsonDrafts[field.attr] ?? JSON.stringify(value ?? {}, null, 2);
        return html`<textarea
          id=${id}
          name=${field.attr}
          class="mono"
          rows="8"
          ?disabled=${disabled}
          ?required=${required}
          placeholder=${field.placeholder ?? '{ }'}
          .value=${text}
          @input=${(event: Event) => this.#onJsonInput(field.attr, event)}
        ></textarea>`;
      }
      default:
        return html`<input
          id=${id}
          name=${field.attr}
          type="text"
          ?disabled=${disabled}
          ?required=${required}
          placeholder=${field.placeholder ?? ''}
          .value=${stringValue(value)}
          @input=${(event: Event) => this.#onTextInput(field, event)}
        />`;
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tobor-configurator': ToborConfigurator;
  }
  interface HTMLElementEventMap {
    'configurator-change': CustomEvent<ConfiguratorSnapshot>;
    'configurator-apply': CustomEvent<ConfiguratorSnapshot>;
  }
}

function isSchema(value: unknown): value is ConfiguratorSchema {
  return !!value && typeof value === 'object' && typeof (value as ConfiguratorSchema).tag === 'string' && Array.isArray((value as ConfiguratorSchema).fields);
}

function asSchema(value: unknown, source: string): ConfiguratorSchema {
  if (!value || typeof value !== 'object') {
    throw new Error(`Invalid configurator schema from ${source}`);
  }
  const rec = value as Record<string, unknown>;
  if (rec.configurator && typeof rec.configurator === 'object') {
    return asSchema(rec.configurator, source);
  }
  if (Array.isArray(rec.configurators) && rec.configurators[0]) {
    return asSchema(rec.configurators[0], source);
  }
  if (typeof rec.tag !== 'string' || !rec.tag) {
    throw new Error(`Configurator schema from ${source} is missing tag`);
  }
  if (!Array.isArray(rec.fields)) {
    throw new Error(`Configurator schema from ${source} is missing fields`);
  }
  return rec as unknown as ConfiguratorSchema;
}

async function loadSchemaFromSrc(src: string, signal: AbortSignal): Promise<ConfiguratorSchema> {
  const url = new URL(src, globalThis.document?.baseURI ?? 'http://localhost/');
  url.hash = '';
  const res = await fetch(url.href, {
    signal,
    credentials: 'omit',
    headers: {Accept: 'application/json'},
  });
  if (!res.ok) {
    throw new Error(`schema-src failed (${res.status})`);
  }
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new Error('schema-src is not valid JSON');
  }
  return asSchema(data, src);
}

function cloneJson<T>(value: T): T {
  if (value === undefined) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

function seedValue(field: ConfiguratorField): unknown {
  if (field.default !== undefined) return cloneJson(field.default);
  switch (field.type) {
    case 'boolean':
      return false;
    case 'multiselect':
    case 'tag-list':
      return [];
    case 'json':
      return {};
    default:
      return '';
  }
}

function coerceAttr(field: ConfiguratorField, raw: string): unknown {
  switch (field.type) {
    case 'boolean':
      return raw !== 'false';
    case 'number': {
      const n = Number(raw);
      return Number.isFinite(n) ? n : raw;
    }
    case 'multiselect':
    case 'tag-list':
      return raw.split(/[\s,]+/).filter(Boolean);
    case 'json':
      try {
        return JSON.parse(raw) as unknown;
      } catch {
        return raw;
      }
    default:
      return raw;
  }
}

function seedFromSchema(schema: ConfiguratorSchema): {
  values: Record<string, unknown>;
  slots: Record<string, string>;
} {
  const values: Record<string, unknown> = {};
  const slots: Record<string, string> = {};
  for (const field of schema.fields) {
    values[field.attr] = seedValue(field);
  }
  for (const name of schema.slots ?? []) {
    slots[name] = '';
  }
  if (!schema.demoHtml?.trim()) return {values, slots};
  const tpl = document.createElement('template');
  tpl.innerHTML = schema.demoHtml.trim();
  const root = tpl.content.firstElementChild;
  if (!root) return {values, slots};
  for (const field of schema.fields) {
    if (field.propertyOnly) continue;
    if (field.type === 'boolean') {
      values[field.attr] = root.hasAttribute(field.attr);
      continue;
    }
    if (root.hasAttribute(field.attr)) {
      values[field.attr] = coerceAttr(field, root.getAttribute(field.attr) ?? '');
    }
  }
  const clone = root.cloneNode(true) as HTMLElement;
  for (const child of [...clone.children]) {
    const slotName = child.getAttribute('slot');
    if (!slotName) continue;
    slots[slotName] = child.outerHTML;
    child.remove();
  }
  const def = clone.innerHTML.trim();
  if (def) slots.default = def;
  return {values, slots};
}

function shouldOmit(field: ConfiguratorField, value: unknown): boolean {
  if (field.type === 'boolean') return !value;
  if (value === undefined || value === null || value === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}

function stringifyAttr(field: ConfiguratorField, value: unknown): string {
  if (Array.isArray(value)) return value.map((item) => String(item)).join(',');
  if (field.type === 'json' || (value && typeof value === 'object')) {
    return JSON.stringify(value);
  }
  return String(value);
}

function applyAttributes(
  el: HTMLElement,
  schema: ConfiguratorSchema,
  values: Record<string, unknown>,
): void {
  const target = el as HTMLElement & Record<string, unknown>;
  for (const field of schema.fields) {
    const value = values[field.attr];
    if (field.propertyOnly) {
      target[field.attr] = value;
      continue;
    }
    if (shouldOmit(field, value)) {
      el.removeAttribute(field.attr);
      continue;
    }
    if (field.type === 'boolean') {
      el.setAttribute(field.attr, '');
      continue;
    }
    el.setAttribute(field.attr, stringifyAttr(field, value));
  }
}

function slotInnerHtml(slots: Record<string, string>): string {
  const named = Object.entries(slots).filter(([name, html]) => name !== 'default' && html);
  const def = slots.default ?? '';
  return [def, ...named.map(([, html]) => html)].filter(Boolean).join('');
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function indent(text: string): string {
  return text
    .split('\n')
    .map((line) => (line ? `  ${line}` : line))
    .join('\n');
}

function buildSnippet(
  schema: ConfiguratorSchema,
  values: Record<string, unknown>,
  slots: Record<string, string>,
): string {
  const parts: string[] = [];
  for (const field of schema.fields) {
    if (field.propertyOnly) continue;
    const value = values[field.attr];
    if (shouldOmit(field, value)) continue;
    if (field.type === 'boolean') {
      parts.push(field.attr);
      continue;
    }
    parts.push(`${field.attr}="${escapeAttr(stringifyAttr(field, value))}"`);
  }
  const attrs = parts.length ? ` ${parts.join(' ')}` : '';
  const inner = slotInnerHtml(slots).trim();
  if (!inner) return `<${schema.tag}${attrs}></${schema.tag}>`;
  return `<${schema.tag}${attrs}>\n${indent(inner)}\n</${schema.tag}>`;
}

function stringValue(value: unknown): string {
  if (value === undefined || value === null) return '';
  return String(value);
}

function selectOptions(field: ConfiguratorField, value: unknown): string[] {
  const options = [...(field.options ?? [])];
  if (typeof value === 'string' && value && !options.includes(value)) options.unshift(value);
  return options;
}

function toColorInput(value: unknown): string {
  if (typeof value !== 'string') return '#000000';
  if (/^#[0-9a-fA-F]{6}$/.test(value)) return value;
  if (/^#[0-9a-fA-F]{3}$/.test(value)) {
    const r = value[1];
    const g = value[2];
    const b = value[3];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return '#000000';
}

function groupFields(fields: ConfiguratorField[]): {name?: string; fields: ConfiguratorField[]}[] {
  const groups: {name?: string; fields: ConfiguratorField[]}[] = [];
  for (const field of fields) {
    const last = groups.at(-1);
    if (last && last.name === field.group) {
      last.fields.push(field);
    } else {
      groups.push({name: field.group, fields: [field]});
    }
  }
  return groups;
}
