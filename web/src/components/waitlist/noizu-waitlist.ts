import {LitElement, html, css, nothing} from 'lit';
import {property, state} from 'lit/decorators.js';
import {emit} from './emit.js';
import {
  COPY,
  DEFAULT_API,
  DEFAULT_SOURCE,
  FALLBACK_EMAIL,
  collectValues,
  controlFor,
  errorCopy,
  firstNonempty,
  normalizeAttributes,
  publicListUrl,
  readRaw,
  successCopy,
  urlPrefill,
  validateField,
  type WaitlistAttribute,
} from './model.js';
import {defineElement} from '../../define.js';

export type {WaitlistErrorDetail, WaitlistSuccessDetail} from './model.js';

type Ui = 'loading' | 'form' | 'success' | 'unavailable';
type StatusKind = '' | 'success' | 'danger';

@defineElement('noizu-waitlist')
export class NoizuWaitlist extends LitElement {
  static override styles = css`
    :host {
      display: block;
    }
  `;

  @property({type: String}) slug = '';
  @property({type: String}) service = '';
  @property({type: String}) list = '';
  @property({type: String}) api = '';
  @property({type: String}) source = '';
  @property({type: String, attribute: 'data-foryou-slug'}) foryouSlug = '';
  @property({type: String, attribute: 'data-foryou-service'}) foryouService = '';
  @property({type: String, attribute: 'data-foryou-list'}) foryouList = '';
  @property({type: String, attribute: 'data-foryou-api'}) foryouApi = '';
  @property({type: String, attribute: 'data-foryou-source'}) foryouSource = '';

  @state() private ui: Ui = 'form';
  @state() private busy = false;
  @state() private submitted = false;
  @state() private statusText = '';
  @state() private statusKind: StatusKind = '';
  @state() private fieldErrors: Record<string, string> = {};
  @state() private listAttrs: WaitlistAttribute[] = [];
  @state() private listName = '';
  @state() private listDescription = '';
  @state() private successMessage = '';
  @state() private optInMode: 'single' | 'double' = 'single';

  private idBase = `wl-${Math.random().toString(36).slice(2, 8)}`;
  private lastKey: string | undefined;
  private abort: AbortController | null = null;
  private prefillDone = false;
  private needsFetch = false;

  protected override createRenderRoot() {
    return this;
  }

  override disconnectedCallback() {
    this.abort?.abort();
    super.disconnectedCallback();
  }

  protected override willUpdate() {
    const key = this.manifestUrl();
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.prefillDone = false;
    this.abort?.abort();
    if (key) {
      this.ui = 'loading';
      this.busy = false;
      this.submitted = false;
      this.fieldErrors = {};
      this.statusKind = '';
      this.statusText = COPY.loading;
      this.needsFetch = true;
    } else {
      this.applyIdleForm();
      this.needsFetch = false;
    }
  }

  protected override updated() {
    if (this.needsFetch) {
      this.needsFetch = false;
      const key = this.lastKey ?? '';
      if (key) void this.fetchManifest(key);
      return;
    }
    if (this.ui === 'form' && !this.prefillDone) this.applyPrefill();
  }

  override render() {
    if (this.ui === 'loading') {
      return html`
        <div aria-busy="true">
          ${this.renderStatus()}
        </div>
      `;
    }
    if (this.ui === 'success') {
      return this.renderStatus();
    }
    if (this.ui === 'unavailable') {
      return this.renderStatus();
    }
    return html`
      ${this.listName ? html`<h2>${this.listName}</h2>` : nothing}
      ${this.listDescription ? html`<p>${this.listDescription}</p>` : nothing}
      <form data-cy="waitlist.form" novalidate @submit=${this.onSubmit}>
        ${this.fields().map((attr) => this.renderField(attr))}
        <input
          type="text"
          name="company_website"
          hidden
          tabindex="-1"
          autocomplete="off"
          aria-hidden="true"
        />
        <button
          type="submit"
          class="btn"
          data-cy="waitlist.submit"
          ?disabled=${this.busy}
        >
          ${this.busy ? COPY.joining : COPY.join}
        </button>
      </form>
      ${this.renderStatus()}
    `;
  }

  private renderStatus() {
    const cls = this.statusKind;
    return html`
      <div
        class=${cls}
        role="status"
        aria-live="polite"
        data-cy="waitlist.status"
      >
        ${this.statusText}
      </div>
    `;
  }

  private renderField(attr: WaitlistAttribute) {
    const id = `${this.idBase}-${attr.slug.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
    const err = this.fieldErrors[attr.slug] ?? '';
    const invalid = err ? 'true' : nothing;
    const reqStar = attr.required ? ' *' : '';
    const cy = attr.type === 'email' || attr.slug === 'email' ? 'waitlist.email' : nothing;
    const v = attr.validation || {};

    if (attr.type === 'multiselect') {
      return html`
        <div class="field-group">
          <span class="field-label">${attr.name}${reqStar}</span>
          ${attr.options.map(
            (opt, idx) => html`
              <label>
                <input
                  type="checkbox"
                  name=${attr.slug}
                  value=${opt.value}
                  id=${`${id}-${idx}`}
                  @change=${() => this.onFieldChange(attr)}
                />
                ${opt.label}
              </label>
            `,
          )}
          ${err ? html`<div>${err}</div>` : nothing}
        </div>
      `;
    }

    if (attr.type === 'select') {
      return html`
        <div class="field-group">
          <label class="field-label" for=${id}>${attr.name}${reqStar}</label>
          <select
            class="field-select"
            id=${id}
            name=${attr.slug}
            ?required=${attr.required}
            aria-required=${attr.required ? 'true' : nothing}
            aria-invalid=${invalid}
            data-cy=${cy}
            @change=${() => this.onFieldChange(attr)}
          >
            <option value="">${attr.required ? 'Select…' : '—'}</option>
            ${attr.options.map((opt) => html`<option value=${opt.value}>${opt.label}</option>`)}
          </select>
          ${err ? html`<div>${err}</div>` : nothing}
        </div>
      `;
    }

    if (attr.type === 'text') {
      return html`
        <div class="field-group">
          <label class="field-label" for=${id}>${attr.name}${reqStar}</label>
          <textarea
            class="field-textarea"
            id=${id}
            name=${attr.slug}
            ?required=${attr.required}
            aria-required=${attr.required ? 'true' : nothing}
            aria-invalid=${invalid}
            maxlength=${typeof v.length === 'number' ? v.length : nothing}
            data-cy=${cy}
            @input=${() => this.onFieldChange(attr)}
          ></textarea>
          ${err ? html`<div>${err}</div>` : nothing}
        </div>
      `;
    }

    const extra = this.inputExtras(attr);
    return html`
      <div class="field-group">
        <label class="field-label" for=${id}>${attr.name}${reqStar}</label>
        <input
          class="field-input"
          id=${id}
          name=${attr.slug}
          type=${extra.type}
          ?required=${attr.required}
          aria-required=${attr.required ? 'true' : nothing}
          aria-invalid=${invalid}
          autocomplete=${extra.autocomplete ?? nothing}
          inputmode=${extra.inputmode ?? nothing}
          step=${extra.step ?? nothing}
          min=${extra.min ?? nothing}
          max=${extra.max ?? nothing}
          maxlength=${extra.maxlength ?? nothing}
          spellcheck=${extra.spellcheck ?? nothing}
          data-cy=${cy}
          @input=${() => this.onFieldChange(attr)}
        />
        ${err ? html`<div>${err}</div>` : nothing}
      </div>
    `;
  }

  private inputExtras(attr: WaitlistAttribute): {
    type: string;
    autocomplete?: string;
    inputmode?: string;
    step?: string;
    min?: number;
    max?: number;
    maxlength?: number;
    spellcheck?: 'false';
  } {
    const v = attr.validation || {};
    if (attr.type === 'email') {
      return {type: 'email', autocomplete: 'email', inputmode: 'email'};
    }
    if (attr.type === 'int') {
      return {
        type: 'number',
        step: '1',
        inputmode: 'numeric',
        min: typeof v.min === 'number' ? v.min : undefined,
        max: typeof v.max === 'number' ? v.max : undefined,
      };
    }
    if (attr.type === 'float') {
      return {
        type: 'number',
        step: 'any',
        inputmode: 'decimal',
        min: typeof v.min === 'number' ? v.min : undefined,
        max: typeof v.max === 'number' ? v.max : undefined,
      };
    }
    if (attr.type === 'date') return {type: 'date'};
    if (attr.type === 'guid') return {type: 'text', autocomplete: 'off', spellcheck: 'false'};
    if (attr.type === 'string' && typeof v.length === 'number') {
      return {type: 'text', maxlength: v.length};
    }
    return {type: 'text'};
  }

  private resolved(name: 'slug' | 'service' | 'list' | 'api' | 'source'): string {
    const alias = {
      slug: this.foryouSlug,
      service: this.foryouService,
      list: this.foryouList,
      api: this.foryouApi,
      source: this.foryouSource,
    }[name];
    return firstNonempty(this.getAttribute(name), this[name], alias, this.getAttribute(`data-foryou-${name}`));
  }

  private apiBase(): string {
    return firstNonempty(this.resolved('api')) || DEFAULT_API;
  }

  private resolvedSource(): string {
    return this.resolved('source') || DEFAULT_SOURCE;
  }

  private manifestUrl(): string {
    return publicListUrl(
      this.apiBase(),
      this.resolved('slug'),
      this.resolved('service'),
      this.resolved('list'),
    );
  }

  private fields(): WaitlistAttribute[] {
    return this.listAttrs.length ? this.listAttrs : [FALLBACK_EMAIL];
  }

  private applyIdleForm() {
    this.listAttrs = [];
    this.listName = '';
    this.listDescription = '';
    this.successMessage = '';
    this.optInMode = 'single';
    this.ui = 'form';
    this.busy = false;
    this.submitted = false;
    this.fieldErrors = {};
    this.statusKind = '';
    this.statusText = '';
    this.prefillDone = false;
  }

  private async fetchManifest(url: string) {
    this.abort?.abort();
    const ac = new AbortController();
    this.abort = ac;
    this.prefillDone = false;
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: {Accept: 'application/json'},
        credentials: 'omit',
        mode: 'cors',
        signal: ac.signal,
      });
      if (!res.ok) {
        const msg = res.status === 404 ? COPY.notFound : COPY.unavailable;
        this.ui = 'unavailable';
        this.statusKind = 'danger';
        this.statusText = msg;
        emit(this, 'waitlist-error', {error: msg, status: res.status});
        return;
      }
      const body = (await res.json()) as {list?: Record<string, unknown>};
      const list = body.list && typeof body.list === 'object' ? body.list : {};
      const settings =
        list.settings && typeof list.settings === 'object'
          ? (list.settings as Record<string, unknown>)
          : {};
      this.listName = typeof list.name === 'string' ? list.name : '';
      this.listDescription = typeof list.description === 'string' ? list.description : '';
      this.optInMode = list.opt_in_mode === 'double' ? 'double' : 'single';
      this.successMessage =
        typeof settings.success_message === 'string' ? settings.success_message : '';
      this.listAttrs = normalizeAttributes(list.attributes);
      this.ui = 'form';
      this.statusKind = '';
      this.statusText = '';
    } catch (err) {
      if (ac.signal.aborted) return;
      const msg = COPY.unavailable;
      this.ui = 'unavailable';
      this.statusKind = 'danger';
      this.statusText = msg;
      emit(this, 'waitlist-error', {error: msg, status: null});
    }
  }

  private applyPrefill() {
    const form = this.querySelector<HTMLFormElement>('[data-cy="waitlist.form"]');
    if (!form) return;
    this.prefillDone = true;
    for (const attr of this.fields()) {
      const p = urlPrefill(attr);
      if (p == null) continue;
      if (attr.type === 'multiselect') {
        const boxes = form.querySelectorAll<HTMLInputElement>(
          `input[type="checkbox"][name="${CSS.escape(attr.slug)}"]`,
        );
        const wanted = p.split(',').map((s) => s.trim());
        for (const b of boxes) {
          if (wanted.includes(b.value)) b.checked = true;
        }
        continue;
      }
      const control = form.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
        `[name="${CSS.escape(attr.slug)}"]`,
      );
      if (control && !control.value) control.value = p;
    }
  }

  private onFieldChange(attr: WaitlistAttribute) {
    if (!this.submitted) return;
    const form = this.querySelector<HTMLFormElement>('[data-cy="waitlist.form"]');
    if (!form) return;
    const msg = validateField(attr, readRaw(form, attr));
    const next = {...this.fieldErrors};
    if (msg) next[attr.slug] = msg;
    else delete next[attr.slug];
    this.fieldErrors = next;
  }

  private onSubmit(e: Event) {
    e.preventDefault();
    if (this.busy || this.ui !== 'form') return;
    const form = e.currentTarget as HTMLFormElement;
    this.submitted = true;
    const attrs = this.fields();
    const errors: Record<string, string> = {};
    let firstBad: HTMLElement | null = null;
    for (const attr of attrs) {
      const msg = validateField(attr, readRaw(form, attr));
      if (msg) {
        errors[attr.slug] = msg;
        if (!firstBad) firstBad = controlFor(form, attr);
      }
    }
    this.fieldErrors = errors;
    if (firstBad) {
      firstBad.focus();
      return;
    }
    void this.postSignup(form, collectValues(form, attrs));
  }

  private async postSignup(form: HTMLFormElement, values: Record<string, unknown>) {
    const endpoint = this.manifestUrl();
    const hp = form.querySelector<HTMLInputElement>('input[name="company_website"]');
    const company_website = hp?.value ?? '';
    const source = this.resolvedSource();

    if (!endpoint) {
      const error = COPY.generic;
      this.statusKind = 'danger';
      this.statusText = error;
      emit(this, 'waitlist-error', {error, status: null, values});
      return;
    }

    this.busy = true;
    this.statusKind = '';
    this.statusText = '';

    try {
      const res = await fetch(`${endpoint}/signups`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json', Accept: 'application/json'},
        credentials: 'omit',
        mode: 'cors',
        body: JSON.stringify({values, source, company_website}),
      });
      if (res.status === 429 || (!res.ok && res.status >= 400)) {
        const error = errorCopy(res.status);
        this.busy = false;
        this.statusKind = 'danger';
        this.statusText = error;
        emit(this, 'waitlist-error', {error, status: res.status, values});
        return;
      }
      const msg = successCopy(this.successMessage, this.optInMode);
      this.busy = false;
      this.ui = 'success';
      this.statusKind = 'success';
      this.statusText = msg;
      emit(this, 'waitlist-success', {values, status: res.status, source});
    } catch {
      const error = COPY.generic;
      this.busy = false;
      this.statusKind = 'danger';
      this.statusText = error;
      emit(this, 'waitlist-error', {error, status: null, values});
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'noizu-waitlist': NoizuWaitlist;
  }
}
