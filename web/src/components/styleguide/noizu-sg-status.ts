import {LitElement, html, css, nothing} from 'lit';
import {property} from 'lit/decorators.js';
import {toborKitTokens} from '../mode-toggle/theme.js';
import {defineElement} from '../../define.js';

export type SgStatusKind = 'ok' | 'warn' | 'error' | 'idle';

const STATUSES = new Set<string>(['ok', 'warn', 'error', 'idle']);

/** Shadow-DOM status row. Maps StyleGuideStatusIndicator. */
@defineElement('noizu-sg-status')
export class NoizuSgStatus extends LitElement {
  static override styles = [
    toborKitTokens,
    css`
      :host {
        display: flex;
      }

      [part='status'] {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        min-width: 0;
      }

      [part='dot'] {
        flex: 0 0 auto;
        width: 0.65rem;
        height: 0.65rem;
        margin-top: 0.35em;
        border-radius: 50%;
        background: var(--_muted);
      }

      [data-status='ok'] [part='dot'] {
        background: var(--_accent);
      }

      [data-status='warn'] [part='dot'] {
        background: var(--_warn);
      }

      [data-status='error'] [part='dot'] {
        background: var(--_danger);
      }

      .copy {
        display: grid;
        gap: 2px;
        min-width: 0;
      }

      [part='label'] {
        font-weight: 650;
      }

      [part='description'] {
        color: var(--_muted);
        font-size: 0.85em;
      }
    `,
  ];

  @property({reflect: true})
  status: SgStatusKind | string = 'idle';

  @property({reflect: true})
  label = '';

  @property({reflect: true})
  description = '';

  override render() {
    const status = this.resolvedStatus();
    const description = this.description;
    return html`
      <div part="status" data-cy="sg.status" data-status=${status} role="status">
        <span part="dot" aria-hidden="true"></span>
        <div class="copy">
          <span part="label">${this.label}</span>
          ${description
            ? html`<span part="description">${description}</span>`
            : nothing}
        </div>
      </div>
    `;
  }

  private resolvedStatus(): SgStatusKind {
    return STATUSES.has(this.status) ? (this.status as SgStatusKind) : 'idle';
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'noizu-sg-status': NoizuSgStatus;
  }
}
