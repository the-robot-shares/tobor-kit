/**
 * `<tobor-wiki-entry-editor>` — title + body editor.
 *
 * Emits `wiki-save`; the host persists. Body is source text (xhtml-first /
 * NPL), never parsed as HTML. This island does not fetch or store.
 */

import {LitElement, css, html, type PropertyValues, type TemplateResult} from 'lit';
import {property, state} from 'lit/decorators.js';
import {live} from 'lit/directives/live.js';

import {emit} from '../../events.js';
import {toborKitControls, toborKitTokens} from '../mode-toggle/theme.js';
import {wikiPlainText, type WikiEntry, type WikiSaveDetail} from './types.js';
import {defineElement} from '../../define.js';

export type {WikiEntry, WikiSaveDetail} from './types.js';
export {SAMPLE_ENTRY, wikiPlainText} from './types.js';

@defineElement('tobor-wiki-entry-editor')
export class ToborWikiEntryEditor extends LitElement {
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

      .field {
        display: grid;
        gap: 4px;
      }

      .field span {
        font-size: 0.85em;
        color: var(--_muted);
      }

      input,
      textarea {
        font: inherit;
        color: inherit;
        background: var(--_surface);
        border: 1px solid var(--_border);
        border-radius: calc(var(--_radius) / 2);
        padding: 6px 10px;
      }

      textarea {
        min-height: 12rem;
        resize: vertical;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        font-size: 0.9em;
        white-space: pre-wrap;
      }

      button[part='save'] {
        justify-self: start;
      }
    `,
  ];

  /** Seed for title/body/`spaceId`. Property-only — not an HTML attribute. */
  @property({attribute: false})
  entry: WikiEntry | null = null;

  @state()
  private draftTitle = '';

  @state()
  private draftBody = '';

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (!changed.has('entry')) return;
    const next = this.entry;
    this.draftTitle = next?.title ?? '';
    this.draftBody = wikiPlainText(next?.body);
  }

  override render(): TemplateResult {
    const uid = this.uid;
    return html`
      <article class="stack" data-cy="wiki.editor" part="root">
        <label class="field" for=${`${uid}-title`}>
          <span>Title</span>
          <input
            id=${`${uid}-title`}
            part="title"
            name="title"
            type="text"
            autocomplete="off"
            aria-label="Title"
            .value=${live(this.draftTitle)}
            @input=${this.#onTitle}
          />
        </label>
        <label class="field" for=${`${uid}-body`}>
          <span>Body</span>
          <textarea
            id=${`${uid}-body`}
            part="body"
            name="body"
            autocomplete="off"
            spellcheck="false"
            aria-label="Body"
            .value=${live(this.draftBody)}
            @input=${this.#onBody}
          ></textarea>
        </label>
        <button type="button" part="save" data-cy="wiki.save" @click=${this.#onSave}>
          Save
        </button>
      </article>
    `;
  }

  private readonly uid = `wiki-editor-${Math.random().toString(36).slice(2, 8)}`;

  #onTitle = (event: Event): void => {
    const input = event.currentTarget;
    if (!(input instanceof HTMLInputElement)) return;
    this.draftTitle = input.value;
  };

  #onBody = (event: Event): void => {
    const input = event.currentTarget;
    if (!(input instanceof HTMLTextAreaElement)) return;
    this.draftBody = input.value;
  };

  #onSave = (): void => {
    const detail: WikiSaveDetail = {
      id: this.entry?.id ?? '',
      title: this.draftTitle,
      body: this.draftBody,
    };
    if (this.entry?.spaceId) detail.spaceId = this.entry.spaceId;
    emit<WikiSaveDetail>(this, 'wiki-save', detail);
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'tobor-wiki-entry-editor': ToborWikiEntryEditor;
  }
}
