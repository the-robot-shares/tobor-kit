import {LitElement, html, css, nothing} from 'lit';
import {property} from 'lit/decorators.js';
import {toborKitControls, toborKitTokens} from '../mode-toggle/theme.js';
import {emit} from '../../events.js';
import {defineElement} from '../../define.js';

export interface SgSelectOption {value: string; label: string; disabled?: boolean}
export interface SgSelectDetail {value: string}

/** Native single-select inside Shadow DOM. Host owns form submission and persistence. */
@defineElement('noizu-sg-select')
export class NoizuSgSelect extends LitElement {
  static override styles = [toborKitTokens, toborKitControls, css`
    :host { display: block; width: 100%; max-width: 28rem; background: var(--_bg); }
    label { display: block; margin-bottom: 8px; font-weight: 600; }
    select { width: 100%; min-height: 40px; font: inherit; color: inherit; background: var(--_surface);
      border: 1px solid var(--_border); border-radius: calc(var(--_radius) / 2); padding: 6px 10px; }
    select[aria-invalid='true'] { border-color: var(--_danger); }
    :host([disabled]) { opacity: .5; }
    .hint { margin: 6px 0 0; font-size: .85em; color: var(--_muted); }
    .error { color: var(--_danger); }
  `];
  @property() label = '';
  @property() name = '';
  @property({reflect: true}) value = '';
  @property() placeholder = '';
  @property({attribute: 'help-text'}) helpText = '';
  @property({attribute: 'error-message'}) errorMessage = '';
  @property({type: Boolean, reflect: true}) disabled = false;
  @property({type: Boolean, reflect: true}) error = false;
  @property({type: Boolean, reflect: true}) required = false;
  /** Array property, or JSON attribute for template-oriented hosts. */
  @property({type: Array}) options: SgSelectOption[] = [];

  override focus(options?: FocusOptions) { this.renderRoot.querySelector('select')?.focus(options); }

  override render() {
    const described = [this.helpText ? 'help' : '', this.error && this.errorMessage ? 'error' : ''].filter(Boolean).join(' ');
    const options = Array.isArray(this.options) ? this.options : [];
    return html`
      ${this.label ? html`<label for="field" part="label">${this.label}</label>` : nothing}
      <select id="field" part="field" data-cy="sg.select" name=${this.name || nothing}
        aria-invalid=${this.error ? 'true' : 'false'} aria-describedby=${described || nothing}
        ?disabled=${this.disabled} ?required=${this.required} @change=${this.onChange}>
        ${this.placeholder ? html`<option value="" ?selected=${this.value === ''}>${this.placeholder}</option>` : nothing}
        ${options.map(option => html`<option value=${option.value} ?selected=${option.value === this.value} ?disabled=${option.disabled}>${option.label}</option>`)}
      </select>
      ${this.helpText ? html`<p id="help" class="hint" part="help">${this.helpText}</p>` : nothing}
      ${this.error && this.errorMessage ? html`<p id="error" class="hint error" part="error">${this.errorMessage}</p>` : nothing}
    `;
  }

  protected override updated() {
    // Set after option children exist, including when the options array changes.
    const select = this.renderRoot.querySelector('select');
    if (select && select.value !== this.value) select.value = this.value;
  }

  private readonly onChange = (event: Event) => {
    event.stopPropagation();
    if (this.disabled) return;
    this.value = (event.target as HTMLSelectElement).value;
    emit<SgSelectDetail>(this, 'sg-change', {value: this.value});
    this.dispatchEvent(new Event('change', {bubbles: true, composed: true}));
  };
}

declare global { interface HTMLElementTagNameMap { 'noizu-sg-select': NoizuSgSelect } }
