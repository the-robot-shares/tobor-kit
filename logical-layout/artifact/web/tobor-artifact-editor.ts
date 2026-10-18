/**
 * `<tobor-artifact-editor>` — title + body editor.
 *
 * Emits `artifact-save`; the host persists. This island does not fetch, store,
 * or bump versions.
 */

import {LitElement, css, html, type PropertyValues, type TemplateResult} from 'lit';
import {property, state} from 'lit/decorators.js';
import {live} from 'lit/directives/live.js';

import {emit} from '../../events.js';
import {toborKitControls, toborKitTokens} from '../mode-toggle/theme.js';
import type {Artifact, ArtifactSaveDetail} from './types.js';
import {defineElement} from '../../define.js';

export type {Artifact, ArtifactSaveDetail, ArtifactVersion} from './types.js';
export {SAMPLE_ARTIFACT} from './types.js';

@defineElement('tobor-artifact-editor')
export class ToborArtifactEditor extends LitElement {
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
      }

      button[part='save'] {
        justify-self: start;
      }
    `,
  ];

  /** Seed for title/body. Property-only — not an HTML attribute. */
  @property({attribute: false})
  artifact: Artifact | null = null;

  @state()
  private draftTitle = '';

  @state()
  private draftBody = '';

  private readonly uid = `artifact-editor-${Math.random().toString(36).slice(2, 8)}`;

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (!changed.has('artifact')) return;
    const next = this.artifact;
    this.draftTitle = next?.title ?? '';
    this.draftBody = next?.body ?? '';
  }

  override render(): TemplateResult {
    const uid = this.uid;
    return html`
      <article class="stack" data-cy="artifact.editor" part="root">
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
            @input=${this.onTitle}
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
            @input=${this.onBody}
          ></textarea>
        </label>
        <button type="button" part="save" data-cy="artifact.save" @click=${this.onSave}>
          Save
        </button>
      </article>
    `;
  }

  private readonly onTitle = (event: Event): void => {
    const input = event.currentTarget;
    if (!(input instanceof HTMLInputElement)) return;
    this.draftTitle = input.value;
  };

  private readonly onBody = (event: Event): void => {
    const input = event.currentTarget;
    if (!(input instanceof HTMLTextAreaElement)) return;
    this.draftBody = input.value;
  };

  private readonly onSave = (): void => {
    const detail: ArtifactSaveDetail = {
      id: this.artifact?.id ?? '',
      title: this.draftTitle,
      body: this.draftBody,
    };
    if (this.artifact && this.artifact.version !== undefined && this.artifact.version !== null) {
      detail.version = this.artifact.version;
    }
    emit<ArtifactSaveDetail>(this, 'artifact-save', detail);
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'tobor-artifact-editor': ToborArtifactEditor;
  }
}
