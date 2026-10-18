/**
 * `<tobor-wiki-entry>` — read view for one wiki page.
 *
 * Body is xhtml-first / NPL source rendered as text in `<pre>`. Never
 * `unsafeHTML`. Host owns load; this island emits `wiki-edit`.
 */

import {LitElement, css, html, nothing, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';

import {emit} from '../../events.js';
import {toborKitControls, toborKitTokens} from '../mode-toggle/theme.js';
import {wikiPlainText, type WikiEditDetail, type WikiEntry} from './types.js';
import {defineElement} from '../../define.js';

export type {WikiEditDetail, WikiEntry} from './types.js';
export {SAMPLE_ENTRY, wikiPlainText} from './types.js';

@defineElement('tobor-wiki-entry')
export class ToborWikiEntry extends LitElement {
  static override styles = [
    toborKitTokens,
    toborKitControls,
    css`
      :host {
        display: block;
      }

      .stack {
        display: grid;
        gap: var(--_gap);
      }

      header {
        display: grid;
        gap: 4px;
      }

      h2 {
        margin: 0;
        font-size: 1.1em;
      }

      pre {
        margin: 0;
        padding: var(--_gap);
        max-height: var(--tobor-kit-wiki-body-max-height, 24rem);
        overflow: auto;
        background: var(--_surface);
        border: 1px solid var(--_border);
        border-radius: var(--_radius);
        white-space: pre-wrap;
        word-break: break-word;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        font-size: 0.9em;
      }

      button[part='edit'] {
        justify-self: start;
      }
    `,
  ];

  /** Current page. Property-only — not an HTML attribute. */
  @property({attribute: false})
  entry: WikiEntry | null = null;

  override render(): TemplateResult {
    const page = this.entry;
    if (!page) {
      return html`
        <article class="stack" data-cy="wiki.entry" part="root">
          <p class="muted">No entry.</p>
        </article>
      `;
    }

    const body = wikiPlainText(page.body);
    return html`
      <article class="stack" data-cy="wiki.entry" part="root">
        <header>
          <h2 part="title">${page.title}</h2>
          ${page.spaceId ? html`<p class="muted" part="space">${page.spaceId}</p>` : nothing}
        </header>
        <pre part="body">${body}</pre>
        <button
          type="button"
          part="edit"
          ?disabled=${!page.id}
          @click=${this.#onEdit}
        >
          Edit
        </button>
      </article>
    `;
  }

  #onEdit = (): void => {
    const id = this.entry?.id;
    if (!id) return;
    emit<WikiEditDetail>(this, 'wiki-edit', {id});
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'tobor-wiki-entry': ToborWikiEntry;
  }
}
