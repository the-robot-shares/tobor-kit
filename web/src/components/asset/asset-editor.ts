/**
 * `<tobor-asset-editor>` — name + text body. Host persists `asset-save`.
 * Textarea only for `text/*`. Never `unsafeHTML`.
 */

import {LitElement, css, html, nothing, type PropertyValues} from 'lit';
import {property, state} from 'lit/decorators.js';

import {emit} from '../../events.js';
import {toborKitControls, toborKitTokens} from '../mode-toggle/theme.js';
import {isTextMime, textBody, type Asset, type AssetSaveDetail} from './asset.js';
import {defineElement} from '../../define.js';

export type {Asset, AssetSaveDetail} from './asset.js';

@defineElement('tobor-asset-editor')
export class ToborAssetEditor extends LitElement {
  static override styles = [
    toborKitTokens,
    toborKitControls,
    css`
      :host {
        display: block;
      }

      form {
        display: grid;
        gap: var(--_gap);
        padding: var(--_gap);
        background: var(--_surface);
        border: 1px solid var(--_border);
        border-radius: var(--_radius);
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
        background: var(--_bg);
        border: 1px solid var(--_border);
        border-radius: calc(var(--_radius) / 2);
        padding: 6px 10px;
      }

      textarea {
        min-height: 8rem;
        resize: vertical;
      }

      button[part='save'] {
        justify-self: start;
      }
    `,
  ];

  /** Host-owned snapshot. JS property only — not an HTML attribute. */
  @property({attribute: false})
  asset?: Asset;

  @state()
  private draftName = '';

  @state()
  private draftBody = '';

  protected override willUpdate(changed: PropertyValues<this>) {
    if (changed.has('asset')) {
      this.draftName = this.asset?.name ?? '';
      this.draftBody = textBody(this.asset);
    }
  }

  override render() {
    const asset = this.asset;
    const text = isTextMime(asset?.mime ?? '');
    return html`
      <form
        part="editor"
        data-cy="asset.editor"
        @submit=${this.onSubmit}
      >
        <label class="field">
          <span>Name</span>
          <input
            part="name"
            name="name"
            type="text"
            autocomplete="off"
            .value=${this.draftName}
            ?disabled=${!asset}
            @input=${this.onName}
          />
        </label>
        ${text
          ? html`
              <label class="field">
                <span>Body</span>
                <textarea
                  part="body"
                  name="body"
                  .value=${this.draftBody}
                  @input=${this.onBody}
                ></textarea>
              </label>
            `
          : nothing}
        <button
          part="save"
          type="button"
          data-cy="asset.save"
          ?disabled=${!asset?.id}
          @click=${this.onSave}
        >
          Save
        </button>
      </form>
    `;
  }

  private readonly onName = (event: Event) => {
    const input = event.currentTarget;
    if (!(input instanceof HTMLInputElement)) return;
    this.draftName = input.value;
  };

  private readonly onBody = (event: Event) => {
    const input = event.currentTarget;
    if (!(input instanceof HTMLTextAreaElement)) return;
    this.draftBody = input.value;
  };

  private readonly onSubmit = (event: Event) => {
    event.preventDefault();
    this.save();
  };

  private readonly onSave = (event: Event) => {
    event.preventDefault();
    this.save();
  };

  private save() {
    const asset = this.asset;
    if (!asset?.id) return;
    const name = this.draftName.trim() || asset.name;
    const detail: AssetSaveDetail = {id: asset.id, name};
    if (isTextMime(asset.mime)) detail.body = this.draftBody;
    emit<AssetSaveDetail>(this, 'asset-save', detail);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tobor-asset-editor': ToborAssetEditor;
  }
}
