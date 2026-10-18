/**
 * `<tobor-persona-picker>` — searchable grid of host-supplied personas.
 * Emits `persona-select` `{personaId}`. The island does not fetch or navigate.
 */

import {LitElement, css, html, nothing, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {live} from 'lit/directives/live.js';

import {emit} from '../../events.js';
import {toborKitControls, toborKitTokens} from '../mode-toggle/theme.js';
import type {PersonaEntry, PersonaSelectDetail} from './types.js';
import {defineElement} from '../../define.js';

export function filterPersonas(personas: PersonaEntry[], query: string): PersonaEntry[] {
  const q = query.trim().toLowerCase();
  const rows = personas.filter((row) => row?.id && row.name);
  if (!q) return rows;
  return rows.filter((row) => {
    const handle = row.handle ?? '';
    return (
      row.id.toLowerCase().includes(q) ||
      row.name.toLowerCase().includes(q) ||
      handle.toLowerCase().includes(q)
    );
  });
}

@defineElement('tobor-persona-picker')
export class ToborPersonaPicker extends LitElement {
  static override styles = [
    toborKitTokens,
    toborKitControls,
    css`
      :host {
        display: block;
      }

      .picker {
        display: grid;
        gap: var(--_gap);
      }

      .search {
        display: grid;
        gap: 4px;
      }

      label {
        display: grid;
        gap: 4px;
        font-size: 0.85em;
        color: var(--_muted);
      }

      input {
        width: 100%;
        font: inherit;
        color: inherit;
        background: var(--_surface);
        border: 1px solid var(--_border);
        border-radius: calc(var(--_radius) / 2);
        padding: 6px 10px;
      }

      .grid {
        display: grid;
        gap: var(--_gap);
        grid-template-columns: repeat(
          auto-fill,
          minmax(var(--tobor-kit-persona-min, 16rem), 1fr)
        );
        margin: 0;
        padding: 0;
        list-style: none;
      }

      .item {
        display: grid;
        justify-items: start;
        gap: 2px;
        text-align: left;
        padding: var(--_gap);
        background: var(--_surface);
        border: 1px solid var(--_border);
        border-radius: var(--_radius);
      }

      .name {
        font-weight: 650;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 100%;
      }

      .handle {
        color: var(--_muted);
        font-size: 0.85em;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 100%;
      }

      .empty {
        margin: 0;
        color: var(--_muted);
      }
    `,
  ];

  /** Host-supplied roster. JS property — not an HTML attribute. */
  @property({attribute: false})
  personas: PersonaEntry[] = [];

  @property({type: String, reflect: true})
  query = '';

  override render(): TemplateResult {
    const visible = filterPersonas(this.personas, this.query);
    return html`
      <div class="picker" part="picker" data-cy="persona.picker">
        <div class="search" part="search">
          <label>
            Search
            <input
              type="search"
              part="query"
              data-cy="persona.search"
              placeholder="Search personas"
              .value=${live(this.query)}
              @input=${this.onQueryInput}
            />
          </label>
        </div>
        ${visible.length
          ? html`
              <ul class="grid" part="grid">
                ${visible.map((row) => this.renderItem(row))}
              </ul>
            `
          : html`<p class="empty" part="empty">${this.emptyCopy()}</p>`}
      </div>
    `;
  }

  private renderItem(row: PersonaEntry): TemplateResult {
    const handle = row.handle?.trim() ?? '';
    return html`
      <li>
        <button
          type="button"
          class="item"
          part="item"
          data-cy="persona.item"
          data-persona-id=${row.id}
          @click=${() => this.onSelect(row.id)}
        >
          <span class="name" part="name">${row.name}</span>
          ${handle ? html`<span class="handle" part="handle">${handle}</span>` : nothing}
        </button>
      </li>
    `;
  }

  private emptyCopy(): string {
    return this.personas.length ? 'No matching personas' : 'No personas';
  }

  private readonly onQueryInput = (event: Event): void => {
    const input = event.target;
    if (input instanceof HTMLInputElement) this.query = input.value;
  };

  private onSelect(personaId: string): void {
    if (!personaId) return;
    emit<PersonaSelectDetail>(this, 'persona-select', {personaId});
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tobor-persona-picker': ToborPersonaPicker;
  }
}
