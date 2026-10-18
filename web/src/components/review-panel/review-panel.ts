/**
 * `<tobor-review-panel>` — artifact review thread (list + optional composer).
 *
 * Host loads and persists reviews. This island emits `review-submit` /
 * `review-resolve`; it does not fetch or mutate the list. Entry from
 * `<tobor-artifact-view>` is `review-start`; this tag is the list/thread view.
 */

import {LitElement, css, html, nothing, type TemplateResult} from 'lit';
import {property, state} from 'lit/decorators.js';

import {emit} from '../../events.js';
import {toborKitControls, toborKitTokens} from '../mode-toggle/theme.js';
import {defineElement} from '../../define.js';

export type ReviewStatus = 'open' | 'resolved';

export interface Review {
  id: string;
  author: string;
  body: string;
  at?: string;
  status?: ReviewStatus;
}

export interface ReviewSubmitDetail {
  artifactId: string;
  body: string;
}

export interface ReviewResolveDetail {
  id: string;
}

/** Attribute is true unless the literal value is `"false"`. Missing keeps the class default. */
const booleanDefaultTrue = {
  fromAttribute: (value: string | null) => value !== 'false',
  toAttribute: (value: boolean) => (value ? '' : 'false'),
};

export function reviewStatus(status?: string): ReviewStatus {
  return status === 'resolved' ? 'resolved' : 'open';
}

export function formatReviewStamp(at: string | undefined): string {
  if (!at) return '';
  const ms = Date.parse(at);
  if (Number.isNaN(ms)) return at;
  return `${new Date(ms).toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

/** Hosts may assign undefined/non-array before configuring — never crash the render path. */
export function normalizeReviews(reviews: unknown): Review[] {
  if (!Array.isArray(reviews)) return [];
  return reviews.filter((row): row is Review => Boolean(row) && typeof row === 'object');
}

@defineElement('tobor-review-panel')
export class ToborReviewPanel extends LitElement {
  static override styles = [
    toborKitTokens,
    toborKitControls,
    css`
      :host {
        display: block;
      }

      .panel {
        display: flex;
        flex-direction: column;
        gap: var(--_gap);
      }

      .list {
        display: flex;
        flex-direction: column;
        gap: var(--_gap);
        margin: 0;
        padding: 0;
        list-style: none;
        max-height: var(--tobor-kit-review-max-height, 24rem);
        overflow: auto;
      }

      .item {
        display: grid;
        gap: 6px;
        padding: 8px 10px;
        background: var(--_surface);
        border: 1px solid var(--_border);
        border-radius: calc(var(--_radius) / 2);
      }

      .item[data-status='resolved'] {
        color: var(--_muted);
      }

      .meta {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: 8px;
        font-size: 0.85em;
        color: var(--_muted);
      }

      .author {
        font-weight: 650;
        color: var(--_fg);
      }

      .body {
        margin: 0;
        white-space: pre-wrap;
      }

      .status {
        text-transform: capitalize;
      }

      form {
        display: flex;
        gap: 6px;
        align-items: flex-end;
      }

      textarea {
        flex: 1;
        font: inherit;
        color: inherit;
        background: var(--_surface);
        border: 1px solid var(--_border);
        border-radius: calc(var(--_radius) / 2);
        padding: 8px 10px;
        resize: vertical;
        min-height: 2.5em;
        white-space: pre-wrap;
      }
    `,
  ];

  /** Host-owned review rows. JS property — not an HTML attribute. */
  @property({attribute: false})
  reviews: Review[] = [];

  @property({type: String, attribute: 'artifact-id', reflect: true})
  artifactId = '';

  /** When true (default), the composer renders and can emit `review-submit`. */
  @property({attribute: 'show-composer', converter: booleanDefaultTrue})
  showComposer = true;

  @state()
  private _draft = '';

  override render(): TemplateResult {
    const rows = normalizeReviews(this.reviews);
    return html`
      <div class="panel" part="panel" data-cy="review.panel">
        ${rows.length
          ? html`
              <ul class="list" part="list" aria-label="Reviews">
                ${rows.map((row) => this.#item(row))}
              </ul>
            `
          : html`<p class="muted" part="empty">No reviews yet</p>`}
        ${this.showComposer
          ? html`
              <form @submit=${this.#onSubmit}>
                <textarea
                  data-cy="review.composer"
                  part="composer"
                  rows="3"
                  aria-label="Review"
                  .value=${this._draft}
                  @input=${this.#onDraft}
                  @keydown=${this.#onComposerKey}
                ></textarea>
                <button data-cy="review.submit" part="submit" type="submit">Submit</button>
              </form>
            `
          : nothing}
      </div>
    `;
  }

  #item(row: Review): TemplateResult {
    const status = reviewStatus(row.status);
    const stamp = formatReviewStamp(row.at);
    return html`
      <li
        class="item"
        part="item"
        data-cy="review.item"
        data-id=${row.id}
        data-status=${status}
      >
        <div class="meta" part="meta">
          <span class="author" part="author">${row.author}</span>
          ${stamp ? html`<time part="stamp" datetime=${row.at ?? nothing}>${stamp}</time>` : nothing}
          <span class="status" part="status">${status}</span>
        </div>
        <p class="body" part="body">${row.body}</p>
        ${status === 'open'
          ? html`
              <button type="button" part="resolve" @click=${() => this.#onResolve(row.id)}>
                Resolve
              </button>
            `
          : nothing}
      </li>
    `;
  }

  #onDraft(event: InputEvent): void {
    this._draft = (event.target as HTMLTextAreaElement).value;
  }

  #onComposerKey(event: KeyboardEvent): void {
    if (event.key !== 'Enter' || event.shiftKey) return;
    event.preventDefault();
    this.#submitFrom((event.target as HTMLTextAreaElement).value);
  }

  #onSubmit(event: Event): void {
    event.preventDefault();
    const field = this.renderRoot.querySelector('[data-cy="review.composer"]') as HTMLTextAreaElement | null;
    this.#submitFrom(field?.value ?? this._draft);
  }

  #submitFrom(raw: string): void {
    const body = raw.trim();
    if (!body) return;
    emit<ReviewSubmitDetail>(this, 'review-submit', {artifactId: this.artifactId, body});
    this._draft = '';
  }

  #onResolve(id: string): void {
    if (!id) return;
    emit<ReviewResolveDetail>(this, 'review-resolve', {id});
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tobor-review-panel': ToborReviewPanel;
  }
}
