/**
 * `<tobor-npl-view>` — NPL / prompt-lingua source viewer.
 *
 * Foldable sections (lines starting with `#` or `⌜NPL`). Highlight via CSS
 * classes on escaped text spans — never `unsafeHTML` of raw source. Copy
 * emits `npl-copy` `{text}` and writes the clipboard when available.
 */

import {LitElement, css, html, nothing, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';

import {emit} from '../../events.js';
import {toborKitControls, toborKitTokens} from '../mode-toggle/theme.js';
import {splitNplSections, tokenizeNpl, type NplSection} from './highlight.js';
import {defineElement} from '../../define.js';

export type {NplSection, NplToken, NplTokenKind} from './highlight.js';
export {
  SAMPLE_SOURCE,
  isNplFoldStart,
  splitNplSections,
  tokenizeNpl,
} from './highlight.js';

export interface NplCopyDetail {
  text: string;
}

@defineElement('tobor-npl-view')
export class ToborNplView extends LitElement {
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

      .toolbar {
        display: flex;
        justify-content: flex-end;
      }

      .source {
        display: grid;
        gap: var(--_gap);
        max-height: var(--tobor-kit-npl-max-height, 32rem);
        overflow: auto;
      }

      details {
        background: var(--_surface);
        border: 1px solid var(--_border);
        border-radius: var(--_radius);
      }

      summary {
        cursor: pointer;
        padding: 8px 10px;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        font-size: 0.9em;
        white-space: pre-wrap;
        word-break: break-word;
      }

      summary:hover {
        color: var(--_accent);
      }

      pre.npl-block {
        margin: 0;
        padding: var(--_gap);
        background: var(--_surface);
        border: 1px solid var(--_border);
        border-radius: var(--_radius);
        white-space: pre-wrap;
        word-break: break-word;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        font-size: 0.9em;
      }

      details pre.npl-block {
        border: 0;
        border-top: 1px solid var(--_border);
        border-radius: 0 0 var(--_radius) var(--_radius);
      }

      .npl-declaration {
        color: var(--_accent);
      }

      .npl-placeholder {
        color: var(--_warn);
      }

      .npl-infill {
        color: var(--_muted);
      }

      .npl-highlight {
        color: var(--_warn);
      }

      .npl-attention {
        color: var(--_danger);
      }

      .npl-logic {
        color: var(--_accent);
      }

      .npl-literal,
      .npl-tag {
        color: var(--_muted);
      }
    `,
  ];

  /** NPL / prompt-lingua source. String property; also the `source` attribute. */
  @property({type: String})
  source = '';

  override render(): TemplateResult {
    const source = this.source;
    if (!source.trim()) {
      return html`
        <article class="stack" data-cy="npl.view" part="root">
          ${this.#toolbar(true)}
          <p class="muted" part="empty">No source.</p>
        </article>
      `;
    }

    return html`
      <article class="stack" data-cy="npl.view" part="root">
        ${this.#toolbar(false)}
        <div class="source" part="source">${splitNplSections(source).map((section) => this.#section(section))}</div>
      </article>
    `;
  }

  #toolbar(disabled: boolean): TemplateResult {
    return html`
      <header class="toolbar">
        <button
          type="button"
          part="copy"
          data-cy="npl.copy"
          ?disabled=${disabled}
          aria-label="Copy NPL source"
          @click=${this.#onCopy}
        >
          Copy
        </button>
      </header>
    `;
  }

  #section(section: NplSection): TemplateResult {
    if (section.heading === null) {
      return html`<pre class="npl-block">${this.#tokens(section.body)}</pre>`;
    }
    return html`
      <details open part="section">
        <summary data-cy="npl.fold" part="fold">${this.#tokens(section.heading)}</summary>
        ${section.body.trim() === ''
          ? nothing
          : html`<pre class="npl-block">${this.#tokens(section.body)}</pre>`}
      </details>
    `;
  }

  #tokens(text: string): TemplateResult[] {
    return tokenizeNpl(text).map((tok) => html`<span class="npl-${tok.kind}">${tok.text}</span>`);
  }

  #onCopy = (): void => {
    const text = this.source;
    emit<NplCopyDetail>(this, 'npl-copy', {text});
    const clipboard = navigator.clipboard;
    if (clipboard && typeof clipboard.writeText === 'function') {
      void clipboard.writeText(text).catch(() => undefined);
    }
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'tobor-npl-view': ToborNplView;
  }
}
