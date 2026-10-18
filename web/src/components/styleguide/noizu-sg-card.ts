import {LitElement, html, css} from 'lit';
import {property} from 'lit/decorators.js';
import {toborKitTokens} from '../mode-toggle/theme.js';
import {defineElement} from '../../define.js';

export interface SgCardSelectDetail {
  href: string;
}

const NESTED_CONTROL = new Set([
  'a',
  'button',
  'input',
  'select',
  'textarea',
  'noizu-sg-btn',
]);

/** Shadow-DOM card. Optional `href` makes the surface a link; host owns navigation. */
@defineElement('noizu-sg-card')
export class NoizuSgCard extends LitElement {
  static override styles = [
    toborKitTokens,
    css`
      :host {
        display: block;
        height: 100%;
      }

      [part='card'] {
        display: grid;
        align-content: start;
        gap: 10px;
        height: 100%;
        padding: 16px;
        background: var(--_surface);
        border: 1px solid var(--_border);
        border-radius: var(--_radius);
        box-shadow: var(--_shadow);
        color: inherit;
        text-decoration: none;
      }

      a[part='card']:hover {
        border-color: var(--_accent);
      }

      [part='header'],
      [part='body'],
      [part='footer'] {
        display: grid;
        gap: 4px;
        min-width: 0;
      }

      [part='header'] {
        font-weight: 650;
      }

      [part='footer'] {
        color: var(--_muted);
        font-size: 0.85em;
      }
    `,
  ];

  @property({reflect: true})
  href = '';

  override render() {
    const href = this.href.trim();
    const inner = html`
      <div part="header"><slot name="header"></slot></div>
      <div part="body"><slot></slot></div>
      <div part="footer"><slot name="footer"></slot></div>
    `;
    if (href) {
      return html`
        <a part="card" data-cy="sg.card" href=${href} @click=${this.onSelect}>${inner}</a>
      `;
    }
    return html`
      <article part="card" data-cy="sg.card" @click=${this.onSelect}>${inner}</article>
    `;
  }

  private readonly onSelect = (event: Event) => {
    if (fromNestedControl(event)) {
      event.preventDefault();
      return;
    }
    const href = this.href.trim();
    const allowed = this.dispatchEvent(
      new CustomEvent<SgCardSelectDetail>('sg-card-select', {
        detail: {href},
        bubbles: true,
        composed: true,
        cancelable: true,
      }),
    );
    if (!allowed) event.preventDefault();
  };
}

/** Nested controls (slotted buttons/links) keep their own activation. */
function fromNestedControl(event: Event): boolean {
  const current = event.currentTarget;
  for (const node of event.composedPath()) {
    if (node === current) return false;
    if (!(node instanceof HTMLElement)) continue;
    if (NESTED_CONTROL.has(node.localName)) return true;
  }
  return false;
}

declare global {
  interface HTMLElementTagNameMap {
    'noizu-sg-card': NoizuSgCard;
  }
}
