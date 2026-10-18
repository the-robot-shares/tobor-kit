/**
 * `<tobor-artifact-view>` — version-aware artifact reader.
 *
 * Body is always text in `<pre>` (Lit text interpolation). Never `unsafeHTML`.
 * Host owns persistence and review flow; this island emits `review-start`.
 */

import {LitElement, css, html, nothing, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';

import {emit} from '../../events.js';
import {toborKitControls, toborKitTokens} from '../mode-toggle/theme.js';
import type {Artifact, ReviewStartDetail} from './types.js';
import {defineElement} from '../../define.js';

export type {Artifact, ArtifactVersion, ReviewStartDetail} from './types.js';
export {SAMPLE_ARTIFACT} from './types.js';

@defineElement('tobor-artifact-view')
export class ToborArtifactView extends LitElement {
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

      .meta {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        font-size: 0.85em;
      }

      pre {
        margin: 0;
        padding: var(--_gap);
        max-height: var(--tobor-kit-artifact-max-height, 24rem);
        overflow: auto;
        background: var(--_surface);
        border: 1px solid var(--_border);
        border-radius: var(--_radius);
        white-space: pre-wrap;
        word-break: break-word;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        font-size: 0.9em;
      }

      button[part='review'] {
        justify-self: start;
      }
    `,
  ];

  /** Current artifact. Property-only — not an HTML attribute. */
  @property({attribute: false})
  artifact: Artifact | null = null;

  override render(): TemplateResult {
    const art = this.artifact;
    if (!art) {
      return html`
        <article class="stack" data-cy="artifact.view" part="root">
          <p class="muted">No artifact.</p>
        </article>
      `;
    }

    return html`
      <article class="stack" data-cy="artifact.view" part="root">
        <header>
          <h2 part="title">${art.title}</h2>
          <p class="meta muted">
            <span part="version">v${art.version}</span>
            ${art.mime ? html`<span part="mime">${art.mime}</span>` : nothing}
          </p>
        </header>
        <pre part="body">${art.body}</pre>
        <button
          type="button"
          part="review"
          data-cy="artifact.review"
          ?disabled=${!art.id}
          @click=${this.onReview}
        >
          Start review
        </button>
      </article>
    `;
  }

  private readonly onReview = (): void => {
    const art = this.artifact;
    if (!art?.id) return;
    emit<ReviewStartDetail>(this, 'review-start', {
      artifactId: art.id,
      version: art.version,
    });
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'tobor-artifact-view': ToborArtifactView;
  }
}
