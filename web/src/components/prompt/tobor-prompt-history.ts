/**
 * `<tobor-prompt-history>` — host-supplied prompt revision list.
 *
 * Emits `prompt-fork` `{id}` and `prompt-star` `{id, starred}`. Optional
 * side-by-side version text (or a `diff` slot). Never `unsafeHTML`. The island
 * does not persist forks or stars.
 */

import {LitElement, css, html, nothing, type TemplateResult} from 'lit';
import {property, state} from 'lit/decorators.js';

import {emit} from '../../events.js';
import {toborKitControls, toborKitTokens} from '../mode-toggle/theme.js';
import {
  formatPromptStamp,
  promptPlainText,
  type PromptDiff,
  type PromptForkDetail,
  type PromptHistoryEntry,
  type PromptStarDetail,
} from './types.js';
import {defineElement} from '../../define.js';

export type {
  PromptDiff,
  PromptDiffPane,
  PromptForkDetail,
  PromptHistoryEntry,
  PromptStarDetail,
} from './types.js';
export {SAMPLE_DIFF, SAMPLE_HISTORY, formatPromptStamp, promptPlainText} from './types.js';

@defineElement('tobor-prompt-history')
export class ToborPromptHistory extends LitElement {
  static override styles = [
    toborKitTokens,
    toborKitControls,
    css`
      :host {
        display: block;
      }

      .history {
        display: grid;
        gap: var(--_gap);
      }

      ul {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 6px;
      }

      .row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto auto;
        gap: 8px;
        align-items: center;
        padding: 8px 10px;
        background: var(--_surface);
        border: 1px solid var(--_border);
        border-radius: calc(var(--_radius) / 2);
      }

      .meta {
        display: grid;
        gap: 2px;
        min-width: 0;
      }

      .title {
        font-weight: 650;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .stamp {
        font-size: 0.85em;
      }

      .diff {
        display: grid;
        gap: var(--_gap);
        grid-template-columns: repeat(
          auto-fit,
          minmax(var(--tobor-kit-prompt-diff-min, 12rem), 1fr)
        );
      }

      .pane {
        display: grid;
        gap: 4px;
        min-width: 0;
      }

      .pane-label {
        font-size: 0.85em;
      }

      pre {
        margin: 0;
        padding: var(--_gap);
        max-height: var(--tobor-kit-prompt-body-max-height, 24rem);
        overflow: auto;
        background: var(--_surface);
        border: 1px solid var(--_border);
        border-radius: var(--_radius);
        white-space: pre-wrap;
        word-break: break-word;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        font-size: 0.9em;
      }

      .empty {
        margin: 0;
      }
    `,
  ];

  /** Host-supplied revisions. JS property — not an HTML attribute. */
  @property({attribute: false})
  entries: PromptHistoryEntry[] = [];

  /** Optional side-by-side source text. Property-only. */
  @property({attribute: false})
  diff: PromptDiff | null = null;

  @state()
  private diffSlotted = false;

  override render(): TemplateResult {
    const rows = Array.isArray(this.entries) ? this.entries.filter((row) => row?.id) : [];
    return html`
      <div class="history" part="root" data-cy="prompt.history">
        ${rows.length
          ? html`
              <ul part="list">
                ${rows.map((row) => this.renderItem(row))}
              </ul>
            `
          : html`<p class="empty muted" part="empty">No history.</p>`}
        <slot name="diff" @slotchange=${this.onDiffSlotChange}></slot>
        ${this.diffSlotted ? nothing : this.renderDiff()}
      </div>
    `;
  }

  private renderItem(row: PromptHistoryEntry): TemplateResult {
    const starred = Boolean(row.starred);
    const stamp = formatPromptStamp(row.at);
    const version = row.version == null ? '' : `v${row.version}`;
    return html`
      <li>
        <div class="row" part="item" data-prompt-id=${row.id}>
          <div class="meta">
            <span class="title" part="title">${row.title}</span>
            <span class="stamp muted" part="stamp">
              ${[version, stamp].filter(Boolean).join(' · ')}
            </span>
          </div>
          <button
            type="button"
            part="fork"
            data-cy="prompt.fork"
            data-prompt-id=${row.id}
            aria-label=${`Fork ${row.title}`}
            @click=${() => this.onFork(row.id)}
          >
            Fork
          </button>
          <button
            type="button"
            part="star"
            data-cy="prompt.star"
            data-prompt-id=${row.id}
            aria-pressed=${starred ? 'true' : 'false'}
            aria-label=${starred ? `Unstar ${row.title}` : `Star ${row.title}`}
            @click=${() => this.onStar(row)}
          >
            ${starred ? 'Starred' : 'Star'}
          </button>
        </div>
      </li>
    `;
  }

  private renderDiff(): TemplateResult | typeof nothing {
    const left = this.diff?.left;
    const right = this.diff?.right;
    if (!left && !right) return nothing;
    return html`
      <div class="diff" part="diff">
        ${left ? this.renderPane(left, 'left') : nothing}
        ${right ? this.renderPane(right, 'right') : nothing}
      </div>
    `;
  }

  private renderPane(
    pane: {label?: string; body: string},
    partName: 'left' | 'right',
  ): TemplateResult {
    const body = promptPlainText(pane.body);
    return html`
      <div class="pane" part=${partName}>
        ${pane.label
          ? html`<span class="pane-label muted" part="diff-label">${pane.label}</span>`
          : nothing}
        <pre part="diff-body">${body}</pre>
      </div>
    `;
  }

  private readonly onDiffSlotChange = (event: Event): void => {
    const slot = event.target;
    if (!(slot instanceof HTMLSlotElement)) return;
    this.diffSlotted = slot.assignedNodes({flatten: true}).some((node) => {
      if (node.nodeType === Node.ELEMENT_NODE) return true;
      return Boolean(node.textContent?.trim());
    });
  };

  private onFork(id: string): void {
    if (!id) return;
    emit<PromptForkDetail>(this, 'prompt-fork', {id});
  }

  private onStar(row: PromptHistoryEntry): void {
    if (!row.id) return;
    const starred = !Boolean(row.starred);
    this.entries = this.entries.map((item) =>
      item.id === row.id ? {...item, starred} : item,
    );
    emit<PromptStarDetail>(this, 'prompt-star', {id: row.id, starred});
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tobor-prompt-history': ToborPromptHistory;
  }
}
