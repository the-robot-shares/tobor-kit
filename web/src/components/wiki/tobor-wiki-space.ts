/**
 * `<tobor-wiki-space>` — list of wiki spaces.
 *
 * Host loads `spaces`. Click emits `wiki-space-select`; the host loads the
 * matching entry. This island does not fetch.
 */

import {LitElement, css, html, nothing, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';

import {emit} from '../../events.js';
import {toborKitControls, toborKitTokens} from '../mode-toggle/theme.js';
import type {WikiSpace, WikiSpaceSelectDetail} from './types.js';
import {defineElement} from '../../define.js';

export type {WikiSpace, WikiSpaceSelectDetail} from './types.js';
export {SAMPLE_SPACES} from './types.js';

@defineElement('tobor-wiki-space')
export class ToborWikiSpace extends LitElement {
  static override styles = [
    toborKitTokens,
    toborKitControls,
    css`
      :host {
        display: block;
      }

      nav {
        display: grid;
        gap: 6px;
      }

      ul {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 4px;
      }

      button[part='item'] {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: 8px;
        width: 100%;
        text-align: left;
        background: var(--_surface);
      }

      .slug {
        font-size: 0.8em;
      }
    `,
  ];

  /** Space roster. Property-only — not an HTML attribute. */
  @property({attribute: false})
  spaces: WikiSpace[] = [];

  /** Host-controlled highlight. Also set locally on select. */
  @property({attribute: 'selected-id'})
  selectedId = '';

  override render(): TemplateResult {
    const rows = Array.isArray(this.spaces) ? this.spaces : [];
    return html`
      <nav data-cy="wiki.space" part="root" aria-label="Wiki spaces">
        ${rows.length
          ? html`
              <ul>
                ${rows.map((space) => this.#item(space))}
              </ul>
            `
          : html`<p class="muted">No spaces.</p>`}
      </nav>
    `;
  }

  #item(space: WikiSpace): TemplateResult {
    const selected = space.id === this.selectedId;
    return html`
      <li>
        <button
          type="button"
          part="item"
          data-cy="wiki.space-item"
          data-space-id=${space.id}
          aria-current=${selected ? 'page' : 'false'}
          @click=${() => this.#onSelect(space.id)}
        >
          <span>${space.title}</span>
          ${space.slug ? html`<span class="muted slug">${space.slug}</span>` : nothing}
        </button>
      </li>
    `;
  }

  #onSelect(id: string): void {
    if (!id) return;
    this.selectedId = id;
    emit<WikiSpaceSelectDetail>(this, 'wiki-space-select', {id});
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tobor-wiki-space': ToborWikiSpace;
  }
}
