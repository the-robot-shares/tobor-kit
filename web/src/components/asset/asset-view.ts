/**
 * `<tobor-asset-view>` — mime-aware preview. Host supplies `asset`.
 * Never `unsafeHTML`; text is Lit-escaped in `<pre>`.
 */

import {LitElement, css, html, nothing} from 'lit';
import {property} from 'lit/decorators.js';

import {emit} from '../../events.js';
import {toborKitControls, toborKitTokens} from '../mode-toggle/theme.js';
import {
  mimeKind,
  previewSrc,
  textBody,
  type Asset,
  type AssetOpenDetail,
} from './asset.js';
import {defineElement} from '../../define.js';

export type {Asset, AssetOpenDetail} from './asset.js';

@defineElement('tobor-asset-view')
export class ToborAssetView extends LitElement {
  static override styles = [
    toborKitTokens,
    toborKitControls,
    css`
      :host {
        display: block;
      }

      .frame {
        display: grid;
        gap: calc(var(--_gap) / 2);
        padding: var(--_gap);
        background: var(--_surface);
        border: 1px solid var(--_border);
        border-radius: var(--_radius);
      }

      .name {
        font-size: 0.85em;
        color: var(--_muted);
      }

      img[part='preview'] {
        display: block;
        max-width: 100%;
        height: auto;
        border-radius: calc(var(--_radius) / 2);
      }

      pre[part='preview'] {
        margin: 0;
        padding: calc(var(--_gap) / 2);
        overflow: auto;
        white-space: pre-wrap;
        word-break: break-word;
        background: var(--_bg);
        border-radius: calc(var(--_radius) / 2);
        font-size: 0.9em;
      }

      .fallback {
        color: var(--_muted);
      }

      a[part='download'] {
        color: var(--_accent);
      }
    `,
  ];

  /** Host-owned snapshot. JS property only — not an HTML attribute. */
  @property({attribute: false})
  asset?: Asset;

  override render() {
    const asset = this.asset;
    if (!asset) {
      return html`
        <article class="frame" part="view" data-cy="asset.view">
          <p class="muted">No asset</p>
        </article>
      `;
    }

    return html`
      <article
        class="frame"
        part="view"
        data-cy="asset.view"
        @click=${this.onOpen}
      >
        <span class="name" part="name">${asset.name}</span>
        ${this.renderPreview(asset)}
      </article>
    `;
  }

  private renderPreview(asset: Asset) {
    const kind = mimeKind(asset.mime);
    if (kind === 'image') {
      const src = previewSrc(asset.src);
      if (!src) {
        return html`
          <div class="fallback" part="preview" data-cy="asset.preview" data-kind="image">
            ${asset.name}
          </div>
        `;
      }
      return html`
        <img
          part="preview"
          data-cy="asset.preview"
          data-kind="image"
          alt=${asset.name}
          src=${src}
        />
      `;
    }

    if (kind === 'text') {
      return html`
        <pre part="preview" data-cy="asset.preview" data-kind="text">${textBody(asset)}</pre>
      `;
    }

    const src = previewSrc(asset.src);
    return html`
      <div class="fallback" part="preview" data-cy="asset.preview" data-kind="other">
        ${src
          ? html`<a
              part="download"
              href=${src}
              download=${asset.name}
              @click=${this.onDownload}
              >Download ${asset.name}</a
            >`
          : asset.name || nothing}
      </div>
    `;
  }

  private readonly onOpen = (event: Event) => {
    const id = this.asset?.id;
    if (!id) return;
    if (event.target instanceof Element && event.target.closest('a')) return;
    emit<AssetOpenDetail>(this, 'asset-open', {id});
  };

  private readonly onDownload = (event: Event) => {
    event.stopPropagation();
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'tobor-asset-view': ToborAssetView;
  }
}
