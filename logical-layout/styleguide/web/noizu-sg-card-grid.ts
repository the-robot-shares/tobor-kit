import {LitElement, html, css} from 'lit';
import {property} from 'lit/decorators.js';
import {styleMap} from 'lit/directives/style-map.js';
import {toborKitTokens} from '../mode-toggle/theme.js';
import {defineElement} from '../../define.js';

/** Shadow-DOM card grid. Default slot holds cards. */
@defineElement('noizu-sg-card-grid')
export class NoizuSgCardGrid extends LitElement {
  static override styles = [
    toborKitTokens,
    css`
      :host {
        display: block;
      }

      [part='grid'] {
        display: grid;
        gap: var(--_gap);
        grid-template-columns: repeat(var(--sg-columns, 3), minmax(0, 1fr));
      }

      ::slotted(*) {
        min-width: 0;
        min-height: 0;
      }

      ::slotted(noizu-sg-card) {
        height: 100%;
      }
    `,
  ];

  @property({type: Number, reflect: true})
  columns = 3;

  override render() {
    const columns = this.resolvedColumns();
    return html`
      <div
        part="grid"
        data-cy="sg.grid"
        data-columns=${String(columns)}
        style=${styleMap({'--sg-columns': String(columns)})}
      >
        <slot></slot>
      </div>
    `;
  }

  private resolvedColumns(): number {
    const n = Math.floor(Number(this.columns));
    return Number.isFinite(n) && n > 0 ? n : 3;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'noizu-sg-card-grid': NoizuSgCardGrid;
  }
}
