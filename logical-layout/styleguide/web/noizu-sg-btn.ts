import {LitElement, html, css} from 'lit';
import {property} from 'lit/decorators.js';
import {toborKitControls, toborKitTokens} from '../mode-toggle/theme.js';
import {emit} from '../../events.js';
import {defineElement} from '../../define.js';

export type SgBtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type SgBtnSize = 'sm' | 'md' | 'lg';
export type SgBtnType = 'button' | 'submit';
export type SgClickDetail = Record<string, never>;

const VARIANTS = new Set<string>(['primary', 'secondary', 'ghost', 'danger']);
const SIZES = new Set<string>(['sm', 'md', 'lg']);
const TYPES = new Set<string>(['button', 'submit']);

/** Shadow-DOM styleguide button. Default slot is the label. */
@defineElement('noizu-sg-btn')
export class NoizuSgBtn extends LitElement {
  static override styles = [
    toborKitTokens,
    toborKitControls,
    css`
      :host {
        display: inline-block;
      }

      button {
        width: 100%;
      }

      button[data-variant='primary'] {
        background: var(--_accent);
        color: var(--_accent-fg);
        border-color: var(--_accent);
      }

      button[data-variant='secondary'] {
        background: var(--_surface);
        color: var(--_fg);
      }

      button[data-variant='ghost'] {
        background: transparent;
        border-color: transparent;
      }

      button[data-variant='danger'] {
        background: var(--_danger);
        color: #fff;
        border-color: var(--_danger);
      }

      button[data-variant='danger']:hover:not(:disabled) {
        border-color: var(--_danger);
      }

      button[data-size='sm'] {
        padding: 4px 8px;
        font-size: 0.8rem;
      }

      button[data-size='lg'] {
        padding: 10px 16px;
        font-size: 1.05rem;
      }
    `,
  ];

  @property({reflect: true})
  variant: SgBtnVariant | string = 'primary';

  @property({reflect: true})
  size: SgBtnSize | string = 'md';

  @property({type: Boolean, reflect: true})
  disabled = false;

  @property({reflect: true})
  type: SgBtnType | string = 'button';

  override render() {
    return html`
      <button
        part="btn"
        data-cy="sg.btn"
        data-variant=${this.resolvedVariant()}
        data-size=${this.resolvedSize()}
        type=${this.resolvedType()}
        ?disabled=${this.disabled}
        @click=${this.onClick}
      >
        <slot></slot>
      </button>
    `;
  }

  private resolvedVariant(): SgBtnVariant {
    return VARIANTS.has(this.variant) ? (this.variant as SgBtnVariant) : 'primary';
  }

  private resolvedSize(): SgBtnSize {
    return SIZES.has(this.size) ? (this.size as SgBtnSize) : 'md';
  }

  private resolvedType(): SgBtnType {
    return TYPES.has(this.type) ? (this.type as SgBtnType) : 'button';
  }

  private readonly onClick = () => {
    if (this.disabled) return;
    emit<SgClickDetail>(this, 'sg-click', {});
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'noizu-sg-btn': NoizuSgBtn;
  }
}
