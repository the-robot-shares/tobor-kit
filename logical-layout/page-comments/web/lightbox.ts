/**
 * `<noizu-page-comments-lightbox>` — accessible full-viewport image viewer
 * for comment attachments. Appended to `document.body` by the controller
 * (marked `data-pc-owned` so captures exclude it). Esc, the close button,
 * and a backdrop click all dismiss; focus is trapped inside and restored to
 * the trigger on close; the image's alt text is the attachment filename.
 */

import {LitElement, css, html, nothing, type TemplateResult} from "lit";
import {property, state} from "lit/decorators.js";

import {FocusKeeper, trapFocus} from "./a11y.js";
import {formatBytes} from "./attachments.js";
import {defineElement} from "../../define.js";

export interface LightboxTarget {
  url: string;
  filename: string;
  bytes?: number;
}

@defineElement("noizu-page-comments-lightbox")
export class NoizuPageCommentsLightbox extends LitElement {
  static override styles = css`
    :host {
      position: fixed;
      inset: 0;
      z-index: var(--pc-lightbox-z, 2147482000);
    }

    /* Closed viewer must not keep a fixed full-viewport hit area. */
    :host(:not([data-open])) {
      display: none;
    }

    .backdrop {
      position: absolute;
      inset: 0;
      background: rgb(0 0 0 / 72%);
      display: grid;
      place-items: center;
    }

    figure {
      margin: 0;
      max-width: 92vw;
      max-height: 88vh;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    img {
      max-width: 92vw;
      max-height: 78vh;
      object-fit: contain;
      background: var(--_surface, #fff);
      border-radius: 6px;
    }

    figcaption {
      display: flex;
      align-items: center;
      gap: 10px;
      color: #fff;
      font-size: 0.9em;
    }

    figcaption .name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    a, button {
      font: inherit;
    }

    .close {
      margin-left: auto;
    }
  `;

  @property({type: Object}) target: LightboxTarget | null = null;
  @state() private open = false;

  private keeper = new FocusKeeper();
  private keyListener = (event: KeyboardEvent): void => this.#onKeydown(event);

  /** Open over the current page; call again with a new target to swap. */
  show(target: LightboxTarget): void {
    this.target = target;
    if (!this.open) {
      this.open = true;
      this.setAttribute("data-open", "");
      this.keeper.capture();
      document.addEventListener("keydown", this.keyListener, true);
    }
  }

  close(): void {
    if (!this.open) return;
    this.open = false;
    this.removeAttribute("data-open");
    document.removeEventListener("keydown", this.keyListener, true);
    this.keeper.restore();
  }

  override disconnectedCallback(): void {
    document.removeEventListener("keydown", this.keyListener, true);
    this.keeper.restore();
    super.disconnectedCallback();
  }

  #onKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      event.stopPropagation();
      this.close();
      return;
    }
    if (event.key === "Tab") trapFocus(this.renderRoot, event);
  }

  override render(): TemplateResult {
    if (!this.open || !this.target) return html`${nothing}`;
    return html`
      <div class="backdrop" data-cy="comments.lightbox" @click=${() => this.close()}>
        <figure role="dialog" aria-modal="true" aria-label="Image: ${this.target.filename}">
          <img src=${this.target.url} alt=${this.target.filename} />
          <figcaption>
            <span class="name">${this.target.filename}${this.target.bytes ? ` · ${formatBytes(this.target.bytes)}` : ""}</span>
            <a data-cy="comments.lightbox-download" href=${this.target.url} download=${this.target.filename}>Download</a>
            <button class="close" data-cy="comments.lightbox-close" aria-label="Close image viewer" @click=${() => this.close()}>✕</button>
          </figcaption>
        </figure>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "noizu-page-comments-lightbox": NoizuPageCommentsLightbox;
  }
}
