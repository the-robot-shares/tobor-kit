/**
 * `<tobor-prompt-library>` — searchable host-supplied prompt list.
 *
 * Emits `prompt-select` `{id}` and `prompt-star` `{id, starred}`. The island
 * does not fetch or persist; the host owns stars. Body is always text.
 */

import {LitElement, css, html, nothing, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {live} from 'lit/directives/live.js';

import {emit} from '../../events.js';
import {toborKitControls, toborKitTokens} from '../mode-toggle/theme.js';
import {
  filterPrompts,
  promptPlainText,
  type PromptRecord,
  type PromptSelectDetail,
  type PromptStarDetail,
} from './types.js';
import {defineElement} from '../../define.js';

export type {PromptRecord, PromptSelectDetail, PromptStarDetail} from './types.js';
export {SAMPLE_PROMPTS, filterPrompts, promptPlainText} from './types.js';

@defineElement('tobor-prompt-library')
export class ToborPromptLibrary extends LitElement {
  static override styles = [
    toborKitTokens,
    toborKitControls,
    css`
      :host {
        display: block;
      }

      .library {
        display: grid;
        gap: var(--_gap);
      }

      .search {
        display: grid;
        gap: 4px;
      }

      label {
        font-size: 0.85em;
        color: var(--_muted);
      }

      input {
        font: inherit;
        color: inherit;
        background: var(--_surface);
        border: 1px solid var(--_border);
        border-radius: calc(var(--_radius) / 2);
        padding: 6px 10px;
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
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 8px;
        align-items: start;
      }

      button[part='item'] {
        display: grid;
        justify-items: start;
        gap: 4px;
        width: 100%;
        text-align: left;
        background: var(--_surface);
        min-width: 0;
      }

      .title {
        font-weight: 650;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 100%;
      }

      pre {
        margin: 0;
        max-height: var(--tobor-kit-prompt-body-max-height, 6rem);
        overflow: auto;
        white-space: pre-wrap;
        word-break: break-word;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        font-size: 0.85em;
        color: var(--_muted);
        max-width: 100%;
      }

      .empty {
        margin: 0;
      }
    `,
  ];

  /** Host-supplied roster. JS property — not an HTML attribute. */
  @property({attribute: false})
  prompts: PromptRecord[] = [];

  @property({type: String, reflect: true})
  query = '';

  /** Host-controlled highlight. Also set locally on select. */
  @property({attribute: 'selected-id'})
  selectedId = '';

  override render(): TemplateResult {
    const visible = filterPrompts(this.prompts, this.query);
    return html`
      <div class="library" part="root" data-cy="prompt.library">
        <div class="search">
          <label for="prompt-search">Search</label>
          <input
            id="prompt-search"
            type="search"
            part="search"
            placeholder="Search prompts"
            aria-label="Search prompts"
            .value=${live(this.query)}
            @input=${this.onQueryInput}
          />
        </div>
        ${visible.length
          ? html`
              <ul part="list">
                ${visible.map((row) => this.renderItem(row))}
              </ul>
            `
          : html`<p class="empty muted" part="empty">${this.emptyCopy()}</p>`}
      </div>
    `;
  }

  private renderItem(row: PromptRecord): TemplateResult {
    const starred = Boolean(row.starred);
    const selected = row.id === this.selectedId;
    const body = promptPlainText(row.body);
    return html`
      <li>
        <div class="row">
          <button
            type="button"
            part="item"
            data-cy="prompt.item"
            data-prompt-id=${row.id}
            aria-current=${selected ? 'true' : 'false'}
            @click=${() => this.onSelect(row.id)}
          >
            <span class="title" part="title">${row.title}</span>
            ${body ? html`<pre part="body">${body}</pre>` : nothing}
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

  private emptyCopy(): string {
    return this.prompts.length ? 'No matching prompts' : 'No prompts.';
  }

  private readonly onQueryInput = (event: Event): void => {
    const input = event.target;
    if (input instanceof HTMLInputElement) this.query = input.value;
  };

  private onSelect(id: string): void {
    if (!id) return;
    this.selectedId = id;
    emit<PromptSelectDetail>(this, 'prompt-select', {id});
  }

  private onStar(row: PromptRecord): void {
    if (!row.id) return;
    const starred = !Boolean(row.starred);
    this.prompts = this.prompts.map((item) =>
      item.id === row.id ? {...item, starred} : item,
    );
    emit<PromptStarDetail>(this, 'prompt-star', {id: row.id, starred});
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tobor-prompt-library': ToborPromptLibrary;
  }
}
