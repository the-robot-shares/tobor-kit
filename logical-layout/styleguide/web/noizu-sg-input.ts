import {LitElement, html, css, nothing} from 'lit';
import {property} from 'lit/decorators.js';
import {toborKitControls, toborKitTokens} from '../mode-toggle/theme.js';
import {emit} from '../../events.js';
import {defineElement} from '../../define.js';

export type SgInputType =
  | 'text'
  | 'password'
  | 'email'
  | 'number'
  | 'url'
  | 'tel'
  | 'search'
  | 'textarea'
  | string;

export interface SgInputDetail {
  value: string;
}

const INPUT_TYPES = new Set<string>([
  'text',
  'password',
  'email',
  'number',
  'url',
  'tel',
  'search',
  'date',
]);

/** Shadow-DOM field. `type=textarea` renders a textarea. Maps StyleGuideInputField. */
@defineElement('noizu-sg-input')
export class NoizuSgInput extends LitElement {
  static override styles = [
    toborKitTokens,
    toborKitControls,
    css`
      :host {
        display: block;
        width: 100%;
        max-width: 28rem; background: var(--_bg);
      }

      input,
      textarea {
        display: block;
        width: 100%;
        font: inherit;
        color: inherit;
        background: var(--_surface);
        border: 1px solid var(--_border);
        border-radius: calc(var(--_radius) / 2);
        padding: 6px 10px;
      }

      label { display: block; margin-bottom: 8px; font-weight: 600; }
      .hint { margin: 6px 0 0; font-size: .85em; color: var(--_muted); }
      .error { color: var(--_danger); }

      textarea {
        min-height: 6rem;
        resize: vertical;
      }

      input[data-error='true'],
      textarea[data-error='true'] {
        border-color: var(--_danger);
      }

      :host([disabled]) {
        opacity: 0.5;
      }
    `,
  ];

  @property({reflect: true})
  name = '';

  @property({reflect: true})
  type: SgInputType = 'text';

  @property({type: Boolean, reflect: true})
  disabled = false;

  @property({type: Boolean, reflect: true})
  error = false;

  @property({reflect: true})
  value = '';

  @property() label = '';
  @property() placeholder = '';
  @property({attribute: 'help-text'}) helpText = '';
  @property({attribute: 'error-message'}) errorMessage = '';
  @property({type: Boolean, reflect: true}) required = false;

  override focus(options?: FocusOptions) {
    this.renderRoot.querySelector<HTMLInputElement | HTMLTextAreaElement>('input,textarea')?.focus(options);
  }

  private fieldLabel() {
    return this.label ? html`<label part="label" for="field">${this.label}</label>` : nothing;
  }
  private fieldHelp() {
    return html`${this.helpText ? html`<p id="help" part="help" class="hint">${this.helpText}</p>` : nothing}
      ${this.error && this.errorMessage ? html`<p id="error" part="error" class="hint error">${this.errorMessage}</p>` : nothing}`;
  }
  private describedBy() {
    return [this.helpText ? 'help' : '', this.error && this.errorMessage ? 'error' : ''].filter(Boolean).join(' ') || nothing;
  }

  override render() {
    const kind = this.resolvedType();
    const error = this.error ? 'true' : 'false';
    if (kind === 'textarea') {
      return html`
        ${this.fieldLabel()}
        <textarea
          id="field"
          placeholder=${this.placeholder || nothing}
          aria-describedby=${this.describedBy()}
          ?required=${this.required}
          part="field"
          data-cy="sg.input"
          data-error=${error}
          name=${this.name || nothing}
          aria-invalid=${error}
          .value=${this.value}
          ?disabled=${this.disabled}
          @input=${this.onInput}
          @change=${(event: Event) => event.stopPropagation()}
        ></textarea>
        ${this.fieldHelp()}
      `;
    }
    return html`
      ${this.fieldLabel()}
      <input
        id="field"
        placeholder=${this.placeholder || nothing}
        aria-describedby=${this.describedBy()}
        ?required=${this.required}
        part="field"
        data-cy="sg.input"
        data-error=${error}
        type=${kind}
        name=${this.name || nothing}
        aria-invalid=${error}
        .value=${this.value}
        ?disabled=${this.disabled}
        @input=${this.onInput}
          @change=${(event: Event) => event.stopPropagation()}
      />
      ${this.fieldHelp()}
    `;
  }

  private resolvedType(): string {
    if (this.type === 'textarea') return 'textarea';
    return INPUT_TYPES.has(this.type) ? this.type : 'text';
  }

  private readonly onInput = (event: Event) => {
    if (this.disabled) return;
    const target = event.target;
    if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLTextAreaElement)) {
      return;
    }
    this.value = target.value;
    emit<SgInputDetail>(this, 'sg-input', {value: this.value});
    // Host frameworks can bind native change and read the retargeted host.value.
    this.dispatchEvent(new Event('change', {bubbles: true, composed: true}));
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'noizu-sg-input': NoizuSgInput;
  }
}
