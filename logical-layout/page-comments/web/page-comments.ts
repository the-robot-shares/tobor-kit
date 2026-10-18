/**
 * `<noizu-page-comments>` — cross-origin page annotation island.
 *
 * The tag itself renders nothing: on `enabled` it appends two shadow-DOM
 * layers to `document.body` (a fixed right rail and a pointer-transparent
 * full-page overlay for picker highlight + rings), so a host page's own CSS
 * and stacking contexts never clip or restyle the widget. The tag host is
 * never styled from the outside and never styles the host page — the one
 * exception, `rail-mode="push"`, adds a `margin-right` to `<html>` while the
 * rail is open and restores it on close.
 *
 * Layers:
 *  - `<noizu-page-comments-rail>` — launcher button, thread cards laid out by
 *    `layout.ts` (Google-Docs collision push), composer, orphan section;
 *    bottom drawer below 900px via CSS.
 *  - `<noizu-page-comments-overlay>` — hover picker outline + animated rings
 *    (one highlight rect per `Range.getClientRects()` for text anchors).
 *
 * Picking is an explicit mode: enabled shows the rail + launcher and host
 * clicks pass through untouched; the rail's `+ Comment` button (or
 * Alt+Shift+C) enters pick mode — the only state where clicks are captured.
 * Esc or a completed pick exits. SPA navigations come from
 * `watchPageChanges` and reload threads for the new `pageKey`; host DOM
 * mutations only re-resolve anchors and relayout locally (never a refetch).
 *
 * Storage goes through the `DataSource` interface (`data-source.ts`).
 * Attachments (phase 2b) ride `AttachmentCapableDataSource`: the composer
 * uploads via presign → PUT → complete and renders thumbnails/download
 * chips; screenshots capture via snapdom (or `getDisplayMedia` fallback),
 * crop + annotate in `<noizu-page-comments-snip>`, and upload as
 * `kind: screenshot` with a vector-op `annotation` document that can be
 * re-opened for editing.
 *
 * Realtime (phase 5) rides `RealtimeCapableDataSource`: while enabled and
 * `realtime` is on, the controller subscribes to the page topic (phoenix
 * websocket, see `realtime.ts`), merges incoming events idempotently,
 * drops echoes of its own writes, rejoins on page-change and sign-in/out,
 * and disconnects with the island. The rail surfaces activity as filter
 * tabs (Open/Resolved/All), unread dots on thread cards, and an "N new"
 * pill for threads currently off-screen.
 */

import {LitElement, css, html, nothing, type TemplateResult} from "lit";
import {property, state} from "lit/decorators.js";
import {unsafeHTML} from "lit/directives/unsafe-html.js";

import {
  anchorFromElement,
  anchorFromRange,
  pageKey as computePageKey,
  resolve as resolveAnchor,
  watchPageChanges,
  type PageAnchor,
  type PageChangeWatcher,
  type ResolvedAnchor,
} from "./anchor.js";
import {AnnotateAuth, type AnnotateAuthState} from "./auth.js";
import {
  HttpDataSource,
  HttpError,
  type Attachment,
  type AttachmentCapableDataSource,
  type CommentThread,
  type CompleteMeta,
  type DataSource,
} from "./data-source.js";
import {computeRailLayout} from "./layout.js";
import {renderMarkdown} from "./markdown.js";
import {
  ATTACH_ACCEPT,
  PendingUploads,
  formatBytes,
  imageSize,
  isAcceptedType,
  kindForFile,
  type PendingAttachmentView,
} from "./attachments.js";
import {padRect, type AnnotationDocument, type Rect} from "./annotation.js";
import {
  mergeRealtimeEvent,
  OwnWriteRegistry,
  type RealtimeCapableDataSource,
  type RealtimeConnection,
  type RealtimeEvent,
} from "./realtime.js";
import {NoizuPageCommentsLightbox, type LightboxTarget} from "./lightbox.js";
import {NoizuPageCommentsSnip} from "./snip.js";
import {canvasToPng, capturePageDocument, captureScreenFrame, imageUrlToCanvas} from "./screenshot.js";
import {emit} from "../../events.js";
import {defineElement} from "../../define.js";
import {toborKitControls, toborKitTokens} from "../mode-toggle/theme.js";

export {AnnotateAuth} from "./auth.js";
export {HttpDataSource, MemoryDataSource} from "./data-source.js";
export {NoizuPageCommentsLightbox} from "./lightbox.js";
export {NoizuPageCommentsSnip} from "./snip.js";
export {
  anchorFromElement,
  anchorFromRange,
  pageKey,
  resolve as resolvePageAnchor,
} from "./anchor.js";
export type {
  AnchorConfidence,
  AnchorFingerprint,
  PageAnchor,
  TextQuoteSelector,
} from "./anchor.js";
export type {
  Attachment,
  AttachmentCapableDataSource,
  AttachmentKind,
  CommentReply,
  CommentThread,
  CompleteMeta,
  CreateThreadInput,
  DataSource,
  PresignInput,
  PresignResult,
} from "./data-source.js";
export type {AnnotationDocument, AnnotateOp, Rect} from "./annotation.js";
export type {LightboxTarget} from "./lightbox.js";
export {
  OwnWriteRegistry,
  PARITY_VECTOR,
  PARITY_VECTOR_SHA256,
  RealtimeSource,
  mergeRealtimeEvent,
  pageTopic,
  parseRealtimeEvent,
  reconnectAfterMs,
  sha256Hex,
} from "./realtime.js";
export type {
  MergeResult,
  RealtimeCapableDataSource,
  RealtimeConnection,
  RealtimeEvent,
  RealtimeEventName,
  RealtimeSourceOptions,
  RealtimeStatus,
} from "./realtime.js";
export {computeRailLayout} from "./layout.js";
export {renderMarkdown} from "./markdown.js";

export type RailMode = "overlay" | "push";
export type ThreadFilter = "open" | "resolved" | "all";

const RAIL_WIDTH = 360;
const MAX_RING_RECTS = 40;
/** Screenshot crop preset padding around the picked anchor (px). */
const ANCHOR_PADDING = 24;

/* ------------------------------------------------------------------ */
/* view models                                                         */
/* ------------------------------------------------------------------ */

export interface ThreadCardView {
  thread: CommentThread;
  /** Final rail top from the layout pass; null = orphan (listed separately). */
  top: number | null;
  focused: boolean;
  confidence: ResolvedAnchor["confidence"] | "orphan";
  excerpt: string;
}

function cardHeight(thread: CommentThread): number {
  // Initial estimate only; the rail reports measured card heights
  // (ResizeObserver) and the layout pass prefers them when known.
  return 96 + thread.comments.length * 26;
}

function excerptOf(thread: CommentThread): string {
  return truncateExcerpt(thread.anchor.textQuote.exact || thread.anchor.css || "");
}

/** Composer/card excerpt cap — the full quote lives in the anchor. */
const EXCERPT_CAP = 140;

function truncateExcerpt(text: string): string {
  return text.length > EXCERPT_CAP ? `${text.slice(0, EXCERPT_CAP - 1).trimEnd()}…` : text;
}

function anchorRects(target: Element | Range): DOMRect[] {
  if (target instanceof Range) {
    return Array.from(target.getClientRects()).slice(0, MAX_RING_RECTS);
  }
  return [target.getBoundingClientRect()];
}

/** True when `el` lives inside one of the widget's own layers/host. */
function ownedByWidget(el: Element | null): boolean {
  let node: Element | null = el;
  while (node) {
    if (node.hasAttribute("data-pc-owned") || node.localName === "noizu-page-comments") return true;
    const root = node.getRootNode();
    node = root instanceof ShadowRoot ? root.host : null;
  }
  return false;
}

/* ------------------------------------------------------------------ */
/* rail                                                                */
/* ------------------------------------------------------------------ */

interface ComposeView {
  top: number;
  excerpt: string;
}

/** A host-page text selection worth commenting on (cloned Range + text). */
interface SelectionCapture {
  range: Range;
  text: string;
}

@defineElement("noizu-page-comments-rail")
export class NoizuPageCommentsRail extends LitElement {
  static override styles = [
    toborKitTokens,
    toborKitControls,
    css`
      :host {
        position: fixed;
        top: 0;
        right: 0;
        bottom: 0;
        width: var(--pc-rail-width, ${RAIL_WIDTH}px);
        pointer-events: none;
        font-size: 14px;
        z-index: var(--pc-rail-z, 2147481000);
      }

      .launcher {
        pointer-events: auto;
        position: absolute;
        right: 16px;
        bottom: 16px;
        width: 44px;
        height: 44px;
        border-radius: 50%;
        border: 1px solid var(--_border);
        background: var(--_surface);
        color: var(--_fg);
        box-shadow: var(--_shadow);
        font-size: 18px;
        line-height: 1;
        cursor: pointer;
      }

      .launcher[aria-pressed="true"] {
        background: var(--_accent);
        color: var(--_accent-fg);
        border-color: var(--_accent);
      }

      .panel {
        pointer-events: auto;
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        background: var(--_bg);
        border-left: 1px solid var(--_border);
        box-shadow: var(--_shadow);
      }

      header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 12px;
        border-bottom: 1px solid var(--_border);
      }

      header h2 {
        flex: 1;
        margin: 0;
        font-size: 1em;
        font-weight: 600;
      }

      header button {
        padding: 4px 8px;
        font-size: 0.85em;
      }

      .tabs-row {
        flex: none;
        display: flex;
        padding: 6px 12px;
        border-bottom: 1px solid var(--_border);
      }

      .tabs {
        display: flex;
        gap: 2px;
        border: 1px solid var(--_border);
        border-radius: calc(var(--_radius) / 2);
        overflow: hidden;
      }

      .tabs button {
        border: none;
        border-radius: 0;
        padding: 3px 8px;
        font-size: 0.78em;
        background: var(--_bg);
      }

      .tabs button[aria-pressed="true"] {
        background: var(--_accent);
        color: var(--_accent-fg);
      }

      .pill {
        border-color: var(--_accent);
        color: var(--_accent-fg);
        background: var(--_accent);
        font-size: 0.78em;
        white-space: nowrap;
      }

      .unread {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        margin: 0 0 4px;
        padding: 1px 7px;
        border-radius: 999px;
        background: var(--_accent);
        color: var(--_accent-fg);
        font-size: 0.72em;
        line-height: 1.5;
      }

      .unread .dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: currentColor;
      }

      .cards {
        flex: 1;
        overflow: hidden;
      }

      .card {
        position: absolute;
        left: 10px;
        right: 10px;
        border: 1px solid var(--_border);
        border-radius: var(--_radius);
        background: var(--_surface);
        padding: 10px 12px;
        cursor: pointer;
        overflow: hidden;
      }

      /* The open composer always paints above thread cards: attach chips and
         the toolbar grow it downward into cards' absolute positions. */
      .composer-card {
        z-index: 2;
      }

      .card.focused {
        border-color: var(--_accent);
        box-shadow: var(--_shadow);
        max-height: 70vh;
        overflow-y: auto;
      }

      .card[data-resolved] {
        opacity: 0.55;
      }

      .card .excerpt {
        margin: 0 0 6px;
        padding: 4px 8px;
        border-left: 3px solid var(--_accent);
        color: var(--_muted);
        font-size: 0.85em;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .card .body {
        overflow-wrap: anywhere;
      }

      .card .body p { margin: 0 0 6px; }
      .card .body ul { margin: 0 0 6px; padding-left: 18px; }
      .card .body pre { overflow-x: auto; font-size: 0.85em; }
      .card .body code { font-family: ui-monospace, monospace; font-size: 0.9em; }

      .meta {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
        color: var(--_muted);
        font-size: 0.78em;
        margin-top: 6px;
      }

      .actions {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
        margin-top: 8px;
      }

      .actions button {
        padding: 3px 8px;
        font-size: 0.8em;
      }

      .reply {
        margin: 8px 0 0 14px;
        padding-left: 10px;
        border-left: 1px solid var(--_border);
        font-size: 0.9em;
      }

      .reply .actions { margin-top: 4px; }

      .composer, .reply-box {
        display: flex;
        gap: 6px;
        margin-top: 8px;
      }

      .attach-toolbar {
        display: flex;
        align-items: center;
        gap: 4px;
        margin-top: 6px;
        flex-wrap: wrap;
      }

      .attach-toolbar button {
        padding: 3px 8px;
        font-size: 0.8em;
      }

      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 6px;
      }

      .chip {
        display: flex;
        align-items: center;
        gap: 6px;
        max-width: 100%;
        padding: 3px 6px;
        border: 1px solid var(--_border);
        border-radius: calc(var(--_radius) / 2);
        font-size: 0.78em;
        background: var(--_bg);
      }

      .chip[data-state="error"] {
        border-color: var(--_warn);
      }

      .chip img {
        width: 28px;
        height: 28px;
        object-fit: cover;
        border-radius: 3px;
      }

      .chip .name {
        max-width: 160px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .chip .bar {
        width: 64px;
        height: 4px;
        border-radius: 2px;
        background: var(--_border);
        overflow: hidden;
      }

      .chip .bar > span {
        display: block;
        height: 100%;
        background: var(--_accent);
      }

      .chip .chip-error {
        color: var(--_warn);
      }

      .attachments {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin: 6px 0;
      }

      .attachments .thumb {
        padding: 0;
        border: 1px solid var(--_border);
        border-radius: 4px;
        background: none;
        cursor: zoom-in;
      }

      .attachments .thumb img {
        display: block;
        max-width: 140px;
        max-height: 90px;
        object-fit: cover;
      }

      .file-chip {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 3px 8px;
        border: 1px solid var(--_border);
        border-radius: calc(var(--_radius) / 2);
        color: inherit;
        font-size: 0.8em;
        text-decoration: none;
      }

      .notice {
        margin: 6px 0 0;
        padding: 4px 8px;
        border-left: 3px solid var(--_warn);
        color: var(--_muted);
        font-size: 0.8em;
      }

      .composer-card.dragover {
        border-color: var(--_accent);
      }

      textarea {
        flex: 1;
        font: inherit;
        color: inherit;
        background: var(--_bg);
        border: 1px solid var(--_border);
        border-radius: calc(var(--_radius) / 2);
        padding: 6px 8px;
        resize: vertical;
        min-height: 2.4em;
        white-space: pre-wrap;
      }

      .orphan-section {
        flex: none;
        max-height: 30vh;
        overflow-y: auto;
        border-top: 1px solid var(--_border);
        padding: 8px 10px;
        background: var(--_surface);
      }

      .orphan-section h3 {
        margin: 0 0 6px;
        font-size: 0.8em;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--_warn);
      }

      .orphan-section .card {
        position: static;
        margin-bottom: 8px;
      }

      .empty {
        padding: 16px 12px;
        color: var(--_muted);
        font-size: 0.9em;
      }

      @media (max-width: 899px) {
        :host {
          top: auto;
          left: 0;
          width: 100%;
          height: 42vh;
        }

        .panel {
          border-left: none;
          border-top: 1px solid var(--_border);
        }

        .card {
          position: static;
          margin: 8px 10px 0;
        }

        .cards {
          overflow-y: auto;
          display: flex;
          flex-direction: column;
        }
      }
    `,
  ];

  @property({type: Boolean}) enabled = false;
  /** True while the controller is in pick mode (clicks captured). */
  @property({type: Boolean}) picking = false;
  @property({type: Boolean}) signedIn = false;
  @property({type: Array}) cards: ThreadCardView[] = [];
  @property({type: Object}) compose: ComposeView | null = null;
  @property({type: String}) pageKey = "";
  /** Comment id with an open reply box. */
  @property({type: String}) replyTo: string | null = null;
  /** Comment id being edited inline. */
  @property({type: String}) editingId: string | null = null;
  /** Pending uploads shown as chips under the composer. */
  @property({type: Array}) pendingUploads: PendingAttachmentView[] = [];
  /** Ready screenshot chips waiting on the reply box (annotation re-edit). */
  @property({type: Array}) replyChips: PendingAttachmentView[] = [];
  /** False when the data source cannot upload — hides attach affordances. */
  @property({type: Boolean}) canAttach = false;
  /** True while a page/screen capture is in flight. */
  @property({type: Boolean}) capturing = false;
  /** Capture/upload notice surfaced to the user (`role=alert`). */
  @property({type: String}) notice: string | null = null;
  /** Realtime events per thread id since it was last focused (unread dots). */
  @property({type: Object}) unread: Record<string, number> = {};

  /** Thread filter tab — "open" (unresolved) by default. */
  @state() private filter: ThreadFilter = "open";
  /** Realtime events waiting on threads whose cards are off-screen. */
  @state() private newCount = 0;

  @state() private draft = "";
  @state() private replyDraft = "";
  @state() private editDraft = "";
  @state() private dragOver = false;

  /** Measures card heights so the layout pass can drop the estimate. */
  private cardObserver: ResizeObserver | null = null;
  private observedCards = new Set<HTMLElement>();

  protected override firstUpdated(): void {
    this.#syncCardObserver();
    // Drawer-mode card scrolling changes which unread threads are visible;
    // keep the "N new" pill in step.
    this.renderRoot
      .querySelector('[data-cy="comments.cards"]')
      ?.addEventListener("scroll", () => this.#updateNewPill(), {passive: true});
  }

  protected override updated(changed: Map<string, unknown>): void {
    super.updated(changed);
    // A focused thread must stay findable: if the current filter hides it
    // (e.g. realtime resolved it while on the Open tab), widen to "all".
    if (
      (changed.has("cards") || changed.has("filter")) &&
      this.cards.some((card) => card.focused && !this.#matchesFilter(card))
    ) {
      this.filter = "all";
      return; // updated() re-runs for the filter change
    }
    this.#syncCardObserver();
    this.#updateNewPill();
  }

  override disconnectedCallback(): void {
    this.cardObserver?.disconnect();
    this.cardObserver = null;
    this.observedCards.clear();
    super.disconnectedCallback();
  }

  #syncCardObserver(): void {
    if (typeof ResizeObserver === "undefined") return;
    if (!this.cardObserver) {
      this.cardObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const card = entry.target as HTMLElement;
          const id = card.getAttribute("data-thread-id");
          if (!id) continue;
          this.dispatchEvent(
            new CustomEvent("pc-card-height", {
              detail: {id, height: card.getBoundingClientRect().height},
              bubbles: true,
              composed: false,
            }),
          );
        }
      });
    }
    const current = new Set(
      Array.from(this.renderRoot.querySelectorAll<HTMLElement>('[data-cy="comments.card"][data-thread-id]')),
    );
    for (const card of this.observedCards) {
      if (!current.has(card)) {
        this.cardObserver.unobserve(card);
        this.observedCards.delete(card);
      }
    }
    for (const card of current) {
      if (!this.observedCards.has(card)) {
        this.cardObserver.observe(card);
        this.observedCards.add(card);
      }
    }
  }

  override render(): TemplateResult {
    return html`
      <button
        class="launcher"
        data-cy="comments.launcher"
        part="launcher"
        aria-pressed=${this.enabled ? "true" : "false"}
        aria-label="Toggle page comments"
        title="Page comments (Alt+C)"
        @click=${this.#onToggle}
      >💬</button>
      ${this.enabled ? this.#panel() : nothing}
    `;
  }

  #matchesFilter(card: ThreadCardView): boolean {
    if (this.filter === "all") return true;
    return this.filter === "open" ? card.thread.resolved !== true : card.thread.resolved === true;
  }

  /**
   * Recount unread events on threads whose cards are not inside the cards
   * viewport (below the fold in desktop mode, scrolled away in drawer
   * mode, or hidden by the current filter tab).
   */
  #updateNewPill(): void {
    const container = this.renderRoot.querySelector<HTMLElement>('[data-cy="comments.cards"]');
    if (!container) {
      if (this.newCount !== 0) this.newCount = 0;
      return;
    }
    const bounds = container.getBoundingClientRect();
    let count = 0;
    for (const [id, events] of Object.entries(this.unread)) {
      if (!events) continue;
      const card = this.renderRoot.querySelector<HTMLElement>(
        `[data-cy="comments.card"][data-thread-id="${CSS.escape(id)}"]`,
      );
      if (!card) {
        count += events; // filtered out by the tab = not visible
        continue;
      }
      const rect = card.getBoundingClientRect();
      const visible = rect.bottom > bounds.top + 4 && rect.top < bounds.bottom - 4;
      if (!visible) count += events;
    }
    if (count !== this.newCount) this.newCount = count;
  }

  #panel(): TemplateResult {
    const visible = this.cards.filter((card) => this.#matchesFilter(card));
    const open = visible.filter((card) => card.top !== null);
    const orphans = visible.filter((card) => card.top === null);
    return html`
      <div class="panel" data-cy="comments.rail" part="rail">
        <header part="header">
          <h2>Comments · ${open.length + orphans.length}</h2>
          ${this.newCount > 0
            ? html`<button
                class="pill"
                data-cy="comments.new-pill"
                title="Focus threads with new activity"
                @click=${() => this.#onNewPill()}
              >${this.newCount} new</button>`
            : nothing}
          ${this.picking
            ? html`<button data-cy="comments.pick" aria-pressed="true" title="Picking — click an element or select text; Esc cancels">Picking…</button>`
            : html`<button data-cy="comments.pick" title="Comment on the selected text, or pick an element (Alt+Shift+C)" @click=${() => this.#send("pc-pick")}>+ Comment</button>`}
          ${this.signedIn
            ? html`<button data-cy="comments.sign-out" @click=${() => this.#send("pc-sign-out")}>Sign out</button>`
            : html`<button data-cy="comments.sign-in" @click=${() => this.#send("pc-sign-in")}>Sign in</button>`}
          <button data-cy="comments.close" aria-label="Close comments" @click=${() => this.#send("pc-close")}>✕</button>
        </header>
        <div class="tabs-row" part="tabs">
          <div class="tabs" role="tablist" aria-label="Filter threads">
            <button
              data-cy="comments.tab-open"
              aria-pressed=${this.filter === "open" ? "true" : "false"}
              title="Open threads"
              @click=${() => this.#setFilter("open")}
            >Open</button>
            <button
              data-cy="comments.tab-resolved"
              aria-pressed=${this.filter === "resolved" ? "true" : "false"}
              title="Resolved threads"
              @click=${() => this.#setFilter("resolved")}
            >Resolved</button>
            <button
              data-cy="comments.tab-all"
              aria-pressed=${this.filter === "all" ? "true" : "false"}
              title="All threads"
              @click=${() => this.#setFilter("all")}
            >All</button>
          </div>
        </div>
        <div class="cards" data-cy="comments.cards" part="cards">
          ${this.compose ? this.#composeCard() : nothing}
          ${open.length || this.compose || orphans.length
            ? nothing
            : html`<div class="empty" data-cy="comments.empty">
                No comments yet. Select text and use the Comment pill (or “+ Comment” / Alt+Shift+C) to start one, or pick a whole element.
              </div>`}
          ${open.map((card) => this.#card(card))}
        </div>
        ${orphans.length
          ? html`
              <div class="orphan-section" data-cy="comments.orphan-section" part="orphan-section">
                <h3>Orphaned · anchor missing on this page</h3>
                ${orphans.map((card) => this.#card(card, true))}
              </div>
            `
          : nothing}
      </div>
    `;
  }

  #composeCard(): TemplateResult {
    const blocking = this.pendingUploads.some((chip) => chip.state !== "ready");
    return html`
      <div
        class="card focused composer-card ${this.dragOver ? "dragover" : ""}"
        data-cy="comments.composer-card"
        style="top: ${this.compose!.top}px"
        @dragover=${(e: DragEvent) => {
          e.preventDefault();
          this.dragOver = true;
        }}
        @dragleave=${() => (this.dragOver = false)}
        @drop=${(e: DragEvent) => {
          e.preventDefault();
          this.dragOver = false;
          const files = Array.from(e.dataTransfer?.files ?? []);
          if (files.length) this.#send("pc-attach-files", {files});
        }}
      >
        <p class="excerpt" title=${this.compose!.excerpt}>${this.compose!.excerpt}</p>
        <div class="composer">
          <textarea
            data-cy="comments.composer"
            part="composer"
            rows="3"
            aria-label="New comment"
            placeholder="Markdown supported…"
            .value=${this.draft}
            @input=${(e: InputEvent) => (this.draft = (e.target as HTMLTextAreaElement).value)}
            @paste=${(e: ClipboardEvent) => this.#onPaste(e)}
            @keydown=${(e: KeyboardEvent) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) this.#submitCompose();
              if (e.key === "Escape") this.#send("pc-compose-cancel");
            }}
          ></textarea>
        </div>
        ${this.canAttach
          ? html`
              <div class="attach-toolbar">
                <button data-cy="comments.attach" aria-label="Attach files" @click=${() => this.#pickFiles()}>📎 Attach</button>
                <button data-cy="comments.screenshot" aria-label="Capture a page screenshot" ?disabled=${this.capturing} @click=${() => this.#send("pc-capture-page")}>
                  ${this.capturing ? "Capturing…" : "📷 Capture"}
                </button>
                <button data-cy="comments.screen-capture" aria-label="Capture the screen" ?disabled=${this.capturing} @click=${() => this.#send("pc-capture-screen")}>🖥 Screen capture</button>
                <input
                  type="file"
                  hidden
                  multiple
                  data-cy="comments.file-input"
                  accept=${ATTACH_ACCEPT}
                  @change=${(e: Event) => {
                    const input = e.target as HTMLInputElement;
                    const files = Array.from(input.files ?? []);
                    input.value = "";
                    if (files.length) this.#send("pc-attach-files", {files});
                  }}
                />
              </div>
              ${this.pendingUploads.length
                ? html`<div class="chips" data-cy="comments.pending-chips">
                    ${this.pendingUploads.map((chip) => this.#chip(chip))}
                  </div>`
                : nothing}
            `
          : nothing}
        ${this.notice ? html`<p class="notice" role="alert" data-cy="comments.notice">${this.notice}</p>` : nothing}
        <div class="actions">
          <button data-cy="comments.composer-send" ?disabled=${blocking} title=${blocking ? "Wait for uploads to finish" : ""} @click=${() => this.#submitCompose()}>Comment</button>
          <button data-cy="comments.composer-cancel" @click=${() => this.#send("pc-compose-cancel")}>Cancel</button>
        </div>
      </div>
    `;
  }

  #onPaste(event: ClipboardEvent): void {
    const files = Array.from(event.clipboardData?.files ?? []);
    if (!files.length) return;
    event.preventDefault();
    this.#send("pc-attach-files", {files});
  }

  #pickFiles(): void {
    const input = this.renderRoot.querySelector<HTMLInputElement>('[data-cy="comments.file-input"]');
    input?.click();
  }

  #chip(chip: PendingAttachmentView): TemplateResult {
    return html`
      <div class="chip" data-cy="comments.pending-chip" data-state=${chip.state} data-local-id=${chip.localId} title=${chip.name}>
        ${chip.previewUrl && (chip.kind === "image" || chip.kind === "screenshot")
          ? html`<img src=${chip.previewUrl} alt="" />`
          : html`<span aria-hidden="true">${chip.kind === "screenshot" ? "📷" : "📄"}</span>`}
        <span class="name">${chip.name}</span>
        ${chip.state === "uploading"
          ? html`<span class="bar" role="progressbar" aria-label="Uploading ${chip.name}" aria-valuemin="0" aria-valuemax="100" aria-valuenow=${chip.progress}>
              <span style="width: ${chip.progress}%"></span>
            </span>`
          : nothing}
        ${chip.state === "error" ? html`<span class="chip-error" role="alert">${chip.error}</span>` : nothing}
        <button
          data-cy="comments.pending-remove"
          aria-label="Remove attachment ${chip.name}"
          @click=${() => this.#send("pc-attach-remove", {localId: chip.localId})}
        >✕</button>
      </div>
    `;
  }

  /** Thumbnails, download chips and annotation re-edit affordances. */
  #attachmentList(attachments: Attachment[] | undefined, withEdit: boolean): TemplateResult {
    if (!attachments?.length) return html`${nothing}`;
    return html`
      <div class="attachments" data-cy="comments.attachments">
        ${attachments.map((attachment) => {
          if ((attachment.kind === "image" || attachment.kind === "screenshot") && attachment.url) {
            return html`
              <button
                class="thumb"
                data-cy="comments.attachment-image"
                aria-label="Open ${attachment.filename}"
                title=${attachment.filename}
                @click=${() => this.#send("pc-lightbox-open", {url: attachment.url, filename: attachment.filename, bytes: attachment.bytes})}
              >
                <img src=${attachment.url} alt=${attachment.filename} loading="lazy" />
              </button>
              ${withEdit && attachment.annotation && attachment.kind === "screenshot"
                ? html`<button
                    data-cy="comments.annotation-edit"
                    @click=${() => this.#send("pc-annotation-edit", {attachmentId: attachment.id})}
                  >Edit drawing</button>`
                : nothing}
            `;
          }
          return attachment.url
            ? html`<a
                class="file-chip"
                data-cy="comments.attachment-file"
                href=${attachment.url}
                download=${attachment.filename}
              >📄 ${attachment.filename} <span>(${formatBytes(attachment.bytes)})</span></a>`
            : html`<span class="file-chip">📄 ${attachment.filename}</span>`;
        })}
      </div>
    `;
  }

  #card(view: ThreadCardView, orphan = false): TemplateResult {
    const thread = view.thread;
    return html`
      <div
        class="card ${view.focused ? "focused" : ""}"
        data-cy="comments.card"
        data-thread-id=${thread.id}
        data-orphan=${orphan ? "true" : nothing}
        ?data-resolved=${thread.resolved ? true : null}
        style=${orphan ? nothing : `top: ${view.top}px`}
        @click=${(e: Event) => {
          if ((e.target as HTMLElement).closest("button, textarea, a")) return;
          this.#send("pc-card-click", {id: thread.id});
        }}
        @mouseenter=${() => this.#send("pc-card-hover", {id: thread.id})}
      >
        ${(this.unread[thread.id] ?? 0) > 0
          ? html`<div
              class="unread"
              data-cy="comments.unread-dot"
              data-count=${this.unread[thread.id]}
              role="status"
              aria-label="${this.unread[thread.id]} new update${this.unread[thread.id] === 1 ? "" : "s"}"
            ><span class="dot" aria-hidden="true"></span>${this.unread[thread.id] > 1 ? this.unread[thread.id] : ""}</div>`
          : nothing}
        ${view.excerpt ? html`<p class="excerpt" title=${view.excerpt}>${view.excerpt}</p>` : nothing}
        <div class="body" data-cy="comments.card-body" part="card-body">${unsafeHTML(renderMarkdown(thread.body_md))}</div>
        ${this.#attachmentList(thread.attachments, true)}
        ${thread.comments.map(
          (reply) => html`
            <div class="reply" data-comment-id=${reply.id}>
              ${this.editingId === reply.id
                ? html`
                    <div class="reply-box">
                      <textarea
                        data-cy="comments.edit-field"
                        .value=${this.editDraft}
                        @input=${(e: InputEvent) => (this.editDraft = (e.target as HTMLTextAreaElement).value)}
                      ></textarea>
                      <button data-cy="comments.edit-save" @click=${() => this.#send("pc-edit-save", {commentId: reply.id, body: this.editDraft})}>Save</button>
                      <button @click=${() => this.#setEditing(null, "")}>Cancel</button>
                    </div>
                  `
                : html`
                    <div class="body">${unsafeHTML(renderMarkdown(reply.body_md))}</div>
                    ${this.#attachmentList(reply.attachments, true)}
                    <div class="actions">
                      <button data-cy="comments.edit" @click=${() => this.#setEditing(reply.id, reply.body_md)}>Edit</button>
                      <button data-cy="comments.delete" @click=${() => this.#send("pc-delete", {commentId: reply.id})}>Delete</button>
                    </div>
                  `}
            </div>
          `,
        )}
        ${this.replyTo === thread.id
          ? html`
              <div class="reply-box">
                <textarea
                  data-cy="comments.reply-field"
                  rows="2"
                  aria-label="Reply"
                  .value=${this.replyDraft}
                  @input=${(e: InputEvent) => (this.replyDraft = (e.target as HTMLTextAreaElement).value)}
                ></textarea>
                <button data-cy="comments.reply-send" @click=${() => this.#send("pc-reply", {id: thread.id, body: this.replyDraft})}>Reply</button>
              </div>
              ${this.replyChips.length
                ? html`<div class="chips" data-cy="comments.reply-chips">${this.replyChips.map((chip) => this.#chip(chip))}</div>`
                : nothing}
            `
          : nothing}
        <div class="actions">
          <button data-cy="comments.reply" @click=${() => this.#setReplyTo(thread.id)}>Reply</button>
          ${thread.resolved
            ? html`<button data-cy="comments.reopen" @click=${() => this.#send("pc-reopen", {id: thread.id})}>Reopen</button>`
            : html`<button data-cy="comments.resolve" @click=${() => this.#send("pc-resolve", {id: thread.id})}>Resolve</button>`}
        </div>
        <div class="meta">
          ${thread.resolved ? html`<span data-cy="comments.resolved-badge">resolved</span>` : nothing}
          ${orphan ? html`<span>anchor missing</span>` : html`<span>${view.confidence}</span>`}
          ${thread.author ? html`<span>${thread.author}</span>` : nothing}
        </div>
      </div>
    `;
  }

  #setEditing(id: string | null, draft: string): void {
    this.editingId = id;
    this.editDraft = draft;
  }

  #setFilter(filter: ThreadFilter): void {
    this.filter = filter;
  }

  /** Focus the first thread with unread activity and scroll to its card. */
  #onNewPill(): void {
    this.#send("pc-focus-new");
    const first = Object.keys(this.unread).find((id) => (this.unread[id] ?? 0) > 0);
    if (!first) return;
    this.renderRoot
      .querySelector(`[data-cy="comments.card"][data-thread-id="${CSS.escape(first)}"]`)
      ?.scrollIntoView({block: "nearest", behavior: "smooth"});
  }

  /** Move keyboard focus into the composer textarea (no page scroll). */
  focusComposer(): void {
    requestAnimationFrame(() => {
      this.renderRoot.querySelector<HTMLTextAreaElement>('[data-cy="comments.composer"]')?.focus({preventScroll: true});
    });
  }

  #setReplyTo(id: string | null): void {
    this.replyTo = id;
    this.replyDraft = "";
  }

  /** Open the reply box programmatically (annotation re-edit flow). */
  openReply(threadId: string): void {
    this.#setReplyTo(threadId);
  }

  #submitCompose(): void {
    const body = this.draft.trim();
    if (!body) return;
    this.#send("pc-compose-submit", {body});
    this.draft = "";
  }

  #onToggle(): void {
    this.#send("pc-toggle");
  }

  #send(name: string, detail: Record<string, unknown> = {}): void {
    this.dispatchEvent(new CustomEvent(name, {detail, bubbles: true, composed: false}));
  }
}

/* ------------------------------------------------------------------ */
/* overlay                                                             */
/* ------------------------------------------------------------------ */

export interface RingView {
  threadId: string;
  /** viewport-relative [x, y, w, h] rects (one per range client rect). */
  rects: number[][];
}

@defineElement("noizu-page-comments-overlay")
export class NoizuPageCommentsOverlay extends LitElement {
  static override styles = css`
    :host {
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: var(--pc-overlay-z, 2147480000);
    }

    .ring {
      position: absolute;
      border: 2px solid var(--pc-ring-color, var(--tobor-kit-accent, #6ee7c7));
      border-radius: 4px;
      pointer-events: auto;
      animation: pc-ring-pulse 1.6s ease-in-out infinite;
    }

    .picker-outline {
      position: absolute;
      border: 2px dashed var(--pc-picker-color, var(--tobor-kit-warn, #f5c451));
      border-radius: 4px;
      pointer-events: none;
    }

    /* Floating "Comment" affordance at the end of the active selection.
       Ember accent by default via --tobor-kit-accent; pointerdown is
       prevented so showing/using it never collapses the selection. */
    .selection-pill {
      position: absolute;
      pointer-events: auto;
      border: none;
      border-radius: 999px;
      padding: 7px 14px;
      background: var(--pc-pill-bg, var(--tobor-kit-accent, #6ee7c7));
      color: var(--pc-pill-fg, var(--tobor-kit-accent-fg, #08130f));
      font: inherit;
      font-size: 13px;
      font-weight: 600;
      line-height: 1;
      box-shadow: 0 4px 14px rgb(0 0 0 / 22%);
      cursor: pointer;
      animation: pc-pill-in 140ms ease-out;
    }

    .selection-pill:focus-visible {
      outline: 2px solid var(--pc-pill-bg, var(--tobor-kit-accent, #6ee7c7));
      outline-offset: 2px;
    }

    @keyframes pc-pill-in {
      from {
        opacity: 0;
        transform: translateY(4px);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .ring,
      .selection-pill {
        animation: none;
      }
    }

    @keyframes pc-ring-pulse {
      0%, 100% { box-shadow: 0 0 0 0 rgb(110 231 199 / 45%); }
      50% { box-shadow: 0 0 0 6px rgb(110 231 199 / 0%); }
    }
  `;

  @property({type: Array}) rings: RingView[] = [];
  /** Hover highlight while picking: viewport [x, y, w, h]. */
  @property({type: Array}) pickerRect: number[] | null = null;
  /** Floating selection pill: viewport [x, y] for its top-left corner. */
  @property({type: Array}) pill: number[] | null = null;

  override render(): TemplateResult {
    return html`
      ${this.pickerRect
        ? html`<div
            class="picker-outline"
            data-cy="comments.picker-outline"
            style=${this.#rectStyle(this.pickerRect)}
          ></div>`
        : nothing}
      ${this.pill
        ? html`<button
            class="selection-pill"
            data-cy="comments.selection-pill"
            part="selection-pill"
            aria-label="Comment on selected text"
            title="Comment on selected text (Alt+Shift+C)"
            style=${`left: ${this.pill[0]}px; top: ${this.pill[1]}px;`}
            @pointerdown=${(event: PointerEvent) => {
              // Never let the pill steal the selection (or focus) — the
              // controller holds a Range clone, but keeping the live
              // highlight stable is the point of a floating affordance.
              event.preventDefault();
            }}
            @click=${() =>
              this.dispatchEvent(new CustomEvent("pc-pill-comment", {bubbles: true, composed: false}))}
          >Comment</button>`
        : nothing}
      ${this.rings.map(
        (ring) => html`
          ${ring.rects.map(
            (rect, index) => html`<div
              class="ring"
              data-cy="comments.ring"
              data-thread-id=${ring.threadId}
              data-rect-index=${index}
              style=${this.#rectStyle(rect)}
              @mouseenter=${() =>
                this.dispatchEvent(new CustomEvent("pc-ring-hover", {detail: {id: ring.threadId}, bubbles: true, composed: false}))}
            ></div>`,
          )}
        `,
      )}
    `;
  }

  #rectStyle(rect: number[]): string {
    return `left: ${rect[0]}px; top: ${rect[1]}px; width: ${rect[2]}px; height: ${rect[3]}px;`;
  }
}

/* ------------------------------------------------------------------ */
/* controller                                                          */
/* ------------------------------------------------------------------ */

@defineElement("noizu-page-comments")
export class NoizuPageComments extends LitElement {
  static override styles = css`
    :host {
      display: none;
    }
  `;

  /** Site slug threads belong to (required for HTTP mode). */
  @property({type: String}) site = "";
  /** Annotate service origin. */
  @property({type: String, attribute: "api-base"}) apiBase = "https://annotate-srv.therobotlives.com";
  /** Island on/off (launcher button, Alt+C). */
  @property({type: Boolean, reflect: true}) enabled = false;
  /** `overlay` (default) floats over the page; `push` shifts <html> left. */
  @property({type: String, attribute: "rail-mode", reflect: true}) railMode: RailMode = "overlay";
  /** How URLs map to thread lists. Default strips query + hash. */
  @property({type: String, attribute: "page-key-strategy"}) pageKeyStrategy: "strip-query-hash" | "full" = "strip-query-hash";
  /** Storage override (MemoryDataSource in demos/tests). Defaults to HttpDataSource. */
  @property({attribute: false}) dataSource?: DataSource;
  /**
   * Subscribe to realtime page updates while enabled (phase 5). Only takes
   * effect when the data source implements `RealtimeCapableDataSource`;
   * otherwise the rail stays poll-only. Defaults to on.
   */
  @property({type: Boolean}) realtime = true;

  @state() private cards: ThreadCardView[] = [];
  @state() private compose: ComposeView | null = null;
  /** True while host clicks are captured for anchor picking. */
  @state() private picking = false;
  @state() private pickerRect: number[] | null = null;
  @state() private rings: RingView[] = [];
  /** Floating selection pill viewport position ([x, y]), null = hidden. */
  @state() private pill: number[] | null = null;
  @state() private signedIn = false;
  @state() private focusedId: string | null = null;

  /** Live host-page text selection (drives the pill + selection comments). */
  private selectionCapture: SelectionCapture | null = null;
  /**
   * Selection snapshot taken on mousedown, before the press's own default
   * action collapses it — this is what makes "+ Comment" after selecting
   * text comment on the selection instead of falling back to the element.
   */
  private captureAtPress: SelectionCapture | null = null;
  private selectionRaf: number | null = null;

  private rail: NoizuPageCommentsRail | null = null;
  private overlay: NoizuPageCommentsOverlay | null = null;
  private lightbox: NoizuPageCommentsLightbox | null = null;
  private snip: NoizuPageCommentsSnip | null = null;
  private auth: AnnotateAuth | null = null;
  private threads: CommentThread[] = [];
  private resolvedTargets = new Map<string, ResolvedAnchor | null>();
  private previouslyResolved = new Set<string>();
  /** Measured card heights (rail ResizeObserver) keyed by thread id. */
  private measuredHeights = new Map<string, number>();
  private pageWatcher: PageChangeWatcher | null = null;
  private pendingAnchor: PageAnchor | null = null;
  /** Picked anchor's rect in page coordinates — presets the screenshot crop. */
  private pendingAnchorRect: Rect | null = null;
  private loadedPageKey: string | null = null;
  private recomputeQueued = false;
  private mutationDebounce: number | null = null;
  /** Live realtime subscription while enabled (phase 5). */
  private realtimeConnection: RealtimeConnection | null = null;
  /** Ids of this client's writes, to drop their realtime echoes. */
  private ownWrites = new OwnWriteRegistry();
  /** Realtime events per thread since it was last focused (unread dots). */
  private unreadThreads = new Map<string, number>();
  /** Composer attachment uploads. */
  private pending = new PendingUploads();
  /** Reply-box uploads (re-edited screenshots). */
  private replyPending = new PendingUploads();
  private capturing = false;
  private captureNotice: string | null = null;
  private snipMode: {kind: "compose"} | {kind: "reply"; threadId: string} = {kind: "compose"};
  private scrollListener: () => void = () => this.#requestRecompute();
  private keyListener = (event: KeyboardEvent) => this.#onKeydown(event);
  private moveListener = (event: MouseEvent) => this.#onMousemove(event);
  private clickListener = (event: MouseEvent) => this.#onDocumentClick(event);
  private selectionListener = (): void => this.#onSelectionChange();
  private mousedownListener = (): void => {
    // Capture phase, before the press can collapse the selection.
    this.captureAtPress = this.selectionCapture;
  };
  private cardHeightListener = (event: Event): void => {
    const detail = (event as CustomEvent<{id: string; height: number}>).detail;
    if (!detail?.id) return;
    this.measuredHeights.set(detail.id, detail.height);
    this.#requestRecompute();
  };
  private resizeObserver: ResizeObserver | null = null;
  private mutationObserver: MutationObserver | null = null;

  /* ---------------- lifecycle ---------------- */

  protected override firstUpdated(): void {
    this.#ensureLayers();
  }

  protected override updated(changed: Map<string, unknown>): void {
    if (changed.has("enabled")) this.#applyEnabled();
    if (changed.has("railMode") || changed.has("enabled")) this.#applyRailMode();
    if (changed.has("realtime") && this.enabled) {
      if (this.realtime) this.#connectRealtime();
      else this.#disconnectRealtime();
    }
  }

  override disconnectedCallback(): void {
    this.#teardownDocumentListeners();
    this.#disconnectRealtime();
    this.#teardownLayers();
    super.disconnectedCallback();
  }

  /* ---------------- public API ---------------- */

  open(): void {
    this.enabled = true;
  }

  close(): void {
    this.enabled = false;
  }

  toggle(): void {
    this.enabled = !this.enabled;
  }

  /** Reload threads for the current pageKey. */
  refresh(): void {
    void this.#loadThreads();
  }

  focusThread(id: string): void {
    this.#focusCard(id, true);
  }

  /* ---------------- layers ---------------- */

  #ensureLayers(): void {
    if (!this.rail) {
      this.rail = document.createElement("noizu-page-comments-rail") as NoizuPageCommentsRail;
      this.rail.setAttribute("data-pc-owned", "");
      this.#wireRail();
      document.body.append(this.rail);
    }
    if (!this.overlay) {
      this.overlay = document.createElement("noizu-page-comments-overlay") as NoizuPageCommentsOverlay;
      this.overlay.setAttribute("data-pc-owned", "");
      this.#wireOverlay();
      document.body.append(this.overlay);
    }
    this.#renderLayers();
  }

  #teardownLayers(): void {
    this.pageWatcher?.dispose();
    this.pageWatcher = null;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.mutationObserver?.disconnect();
    this.mutationObserver = null;
    if (this.selectionRaf !== null) {
      cancelAnimationFrame(this.selectionRaf);
      this.selectionRaf = null;
    }
    this.selectionCapture = null;
    this.captureAtPress = null;
    this.pill = null;
    this.auth?.dispose();
    this.auth = null;
    if (this.railMode === "push" && document.documentElement.style.getPropertyValue("margin-right") === `${RAIL_WIDTH}px`) {
      document.documentElement.style.removeProperty("margin-right");
    }
    this.measuredHeights.clear();
    this.revokePending();
    this.rail?.remove();
    this.overlay?.remove();
    this.lightbox?.remove();
    this.snip?.remove();
    this.rail = null;
    this.overlay = null;
    this.lightbox = null;
    this.snip = null;
  }

  #wireRail(): void {
    const rail = this.rail!;
    rail.addEventListener("pc-toggle", () => this.toggle());
    rail.addEventListener("pc-close", () => this.close());
    rail.addEventListener("pc-pick", () => this.#beginComment());
    rail.addEventListener("pc-card-height", this.cardHeightListener);
    rail.addEventListener("pc-sign-in", () => this.#authClient().signIn());
    rail.addEventListener("pc-sign-out", () => this.#authClient().signOut());
    rail.addEventListener("pc-card-click", (event) => {
      const id = (event as CustomEvent<{id: string}>).detail.id;
      this.#focusCard(id, true);
    });
    rail.addEventListener("pc-card-hover", (event) => {
      const id = (event as CustomEvent<{id: string}>).detail.id;
      this.#focusCard(id, false);
    });
    rail.addEventListener("pc-focus-new", () => {
      // "N new" pill: focus the first thread with unread activity.
      const id = this.unreadThreads.keys().next().value;
      if (id !== undefined) this.#focusCard(id, true);
    });
    rail.addEventListener("pc-compose-submit", (event) => {
      void this.#createThread((event as CustomEvent<{body: string}>).detail.body);
    });
    rail.addEventListener("pc-compose-cancel", () => {
      this.compose = null;
      this.pendingAnchorRect = null;
      this.revokePending();
      this.#renderLayers();
    });
    rail.addEventListener("pc-resolve", (event) => void this.#resolveToggle((event as CustomEvent<{id: string}>).detail.id, true));
    rail.addEventListener("pc-reopen", (event) => void this.#resolveToggle((event as CustomEvent<{id: string}>).detail.id, false));
    rail.addEventListener("pc-reply", (event) => {
      const detail = (event as CustomEvent<{id: string; body: string}>).detail;
      void this.#reply(detail.id, detail.body, this.replyPending.readyIds());
    });
    rail.addEventListener("pc-edit-save", (event) => {
      const detail = (event as CustomEvent<{commentId: string; body: string}>).detail;
      void this.#editComment(detail.commentId, detail.body);
    });
    rail.addEventListener("pc-delete", (event) => {
      void this.#deleteComment((event as CustomEvent<{commentId: string}>).detail.commentId);
    });
    rail.addEventListener("pc-attach-files", (event) => {
      this.#addAttachments((event as CustomEvent<{files: File[]}>).detail.files);
    });
    rail.addEventListener("pc-attach-remove", (event) => {
      this.#removePending((event as CustomEvent<{localId: string}>).detail.localId);
    });
    rail.addEventListener("pc-capture-page", () => void this.#capturePage());
    rail.addEventListener("pc-capture-screen", () => void this.#captureScreen());
    rail.addEventListener("pc-lightbox-open", (event) => {
      const detail = (event as CustomEvent<LightboxTarget>).detail;
      if (detail?.url) this.#lightbox().show(detail);
    });
    rail.addEventListener("pc-annotation-edit", (event) => {
      void this.#openAnnotationEdit((event as CustomEvent<{attachmentId: string}>).detail.attachmentId);
    });
  }

  #wireSnip(): void {
    const snip = this.snip!;
    snip.addEventListener("pc-snip-save", (event) => {
      const detail = (event as CustomEvent<{canvas: HTMLCanvasElement; width: number; height: number; annotation: AnnotationDocument}>).detail;
      void this.#saveScreenshot(detail);
    });
    snip.addEventListener("pc-snip-cancel", () => {
      if (this.snipMode.kind === "reply") {
        this.revokeReplyPending();
        this.#syncRail();
      }
    });
  }

  #lightbox(): NoizuPageCommentsLightbox {
    if (!this.lightbox) {
      this.lightbox = document.createElement("noizu-page-comments-lightbox") as NoizuPageCommentsLightbox;
      this.lightbox.setAttribute("data-pc-owned", "");
      document.body.append(this.lightbox);
    }
    return this.lightbox;
  }

  #wireOverlay(): void {
    this.overlay!.addEventListener("pc-ring-hover", (event) => {
      const id = (event as CustomEvent<{id: string}>).detail.id;
      this.#focusCard(id, false);
    });
    this.overlay!.addEventListener("pc-pill-comment", () => this.#beginComment());
  }

  #authClient(): AnnotateAuth {
    if (!this.auth) {
      this.auth = new AnnotateAuth({
        apiBase: this.apiBase,
        site: this.site,
        onStateChange: (state: AnnotateAuthState) => {
          this.signedIn = state.signedIn;
          emit(this, "page-comments-auth-change", {signedIn: state.signedIn, error: state.error});
          this.#renderLayers();
          // Sign-in/out can change which threads the account sees — reload
          // (one of the three refetch triggers: page-change, auth, own writes).
          if (this.enabled) void this.#loadThreads();
          // Auth flips re-handshake realtime: connect params carry the
          // token, so sign-in/out joins with fresh credentials.
          if (this.enabled) this.#reconnectRealtime();
        },
      });
    }
    return this.auth;
  }

  #dataSource(): DataSource {
    if (this.dataSource) return this.dataSource;
    const auth = this.#authClient();
    return new HttpDataSource({
      apiBase: this.apiBase,
      site: this.site,
      getAccessToken: () => auth.accessToken,
    });
  }

  #applyEnabled(): void {
    emit(this, "page-comments-toggle", {enabled: this.enabled});
    if (this.enabled) {
      this.#ensureLayers();
      this.#installDocumentListeners();
      if (!this.pageWatcher) {
        this.pageWatcher = watchPageChanges(() => this.#onPageChange());
      }
      this.#observeDom();
      void this.#loadThreads();
      this.#connectRealtime();
    } else {
      this.#teardownDocumentListeners();
      // Dispose the watchers with the island: a disabled widget must not
      // refetch or relayout on host DOM mutations or SPA navigations — nor
      // keep a realtime socket open. (PR #84 lifecycle semantics.)
      this.#disconnectRealtime();
      this.unreadThreads.clear();
      this.pageWatcher?.dispose();
      this.pageWatcher = null;
      this.resizeObserver?.disconnect();
      this.resizeObserver = null;
      this.mutationObserver?.disconnect();
      this.mutationObserver = null;
      if (this.mutationDebounce !== null) {
        window.clearTimeout(this.mutationDebounce);
        this.mutationDebounce = null;
      }
      this.picking = false;
      this.compose = null;
      this.pickerRect = null;
      this.rings = [];
      this.pill = null;
      this.selectionCapture = null;
      this.captureAtPress = null;
      if (this.selectionRaf !== null) {
        cancelAnimationFrame(this.selectionRaf);
        this.selectionRaf = null;
      }
      this.cards = [];
      this.measuredHeights.clear();
      this.capturing = false;
      this.captureNotice = null;
      this.pendingAnchorRect = null;
      this.revokePending();
      this.revokeReplyPending();
      this.lightbox?.close();
      this.snip?.close();
      this.#renderLayers();
    }
  }

  #applyRailMode(): void {
    const root = document.documentElement;
    if (this.railMode === "push" && this.enabled) {
      root.style.marginRight = `${RAIL_WIDTH}px`;
    } else if (root.style.getPropertyValue("margin-right") === `${RAIL_WIDTH}px`) {
      root.style.removeProperty("margin-right");
    }
  }

  #installDocumentListeners(): void {
    window.addEventListener("scroll", this.scrollListener, {capture: true, passive: true});
    window.addEventListener("resize", this.scrollListener, {passive: true});
    document.addEventListener("keydown", this.keyListener);
    document.addEventListener("mousemove", this.moveListener, {passive: true});
    document.addEventListener("click", this.clickListener, {capture: true});
    document.addEventListener("selectionchange", this.selectionListener);
    document.addEventListener("mousedown", this.mousedownListener, {capture: true});
  }

  #teardownDocumentListeners(): void {
    window.removeEventListener("scroll", this.scrollListener, {capture: true} as EventListenerOptions);
    window.removeEventListener("resize", this.scrollListener);
    document.removeEventListener("keydown", this.keyListener);
    document.removeEventListener("mousemove", this.moveListener);
    document.removeEventListener("click", this.clickListener, {capture: true} as EventListenerOptions);
    document.removeEventListener("selectionchange", this.selectionListener);
    document.removeEventListener("mousedown", this.mousedownListener, {capture: true} as EventListenerOptions);
  }

  #observeDom(): void {
    if (!this.resizeObserver && typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => this.#requestRecompute());
      this.resizeObserver.observe(document.body);
    }
    if (!this.mutationObserver) {
      this.mutationObserver = new MutationObserver((records) => {
        // Mutations never refetch threads from the network — they only
        // re-resolve anchors and relayout locally. Threads reload on
        // page-change, sign-in/out, and after the user's own writes.
        if (records.every((record) => ownedByWidget(record.target instanceof Element ? record.target : null))) return;
        if (this.mutationDebounce !== null) window.clearTimeout(this.mutationDebounce);
        this.mutationDebounce = window.setTimeout(() => {
          this.mutationDebounce = null;
          this.#requestRecompute();
        }, 200);
      });
      this.mutationObserver.observe(document.body, {childList: true, subtree: true});
    }
  }

  #onKeydown(event: KeyboardEvent): void {
    const target = event.target instanceof Element ? event.target : null;
    // Alt+Shift+C comments on the active selection (or enters pick mode when
    // there is none) — check it before the plain Alt+C toggle.
    if (event.altKey && event.code === "KeyC" && event.shiftKey && !ownedByWidget(target)) {
      event.preventDefault();
      this.#beginComment();
      return;
    }
    if (event.altKey && event.code === "KeyC" && !ownedByWidget(target)) {
      event.preventDefault();
      this.toggle();
      return;
    }
    if (event.key === "Escape") {
      if (this.compose) {
        this.compose = null;
        this.pickerRect = null;
        this.#renderLayers();
      } else if (this.picking) {
        this.picking = false;
        this.pickerRect = null;
        this.#renderLayers();
      } else if (this.selectionCapture || this.pill) {
        // Dismiss the floating pill without losing the rail state.
        this.selectionCapture = null;
        this.pill = null;
        this.#renderLayers();
      }
    }
  }

  /* ---------------- selection pill ---------------- */

  #onSelectionChange(): void {
    if (this.selectionRaf !== null) cancelAnimationFrame(this.selectionRaf);
    this.selectionRaf = requestAnimationFrame(() => {
      this.selectionRaf = null;
      this.selectionCapture = this.#readHostSelection();
      this.#syncPill();
      this.#renderLayers();
    });
  }

  /** The active selection as a cloned Range, when it lives in host content. */
  #readHostSelection(): SelectionCapture | null {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;
    const range = selection.getRangeAt(0);
    const startEl = range.startContainer instanceof Element ? range.startContainer : range.startContainer.parentElement;
    const endEl = range.endContainer instanceof Element ? range.endContainer : range.endContainer.parentElement;
    if (!startEl || !endEl) return null;
    // Selections inside the widget's own layers never anchor (and never
    // spawn a pill).
    if (ownedByWidget(startEl) || ownedByWidget(endEl)) return null;
    const text = range.toString();
    if (!text.trim()) return null;
    return {range: range.cloneRange(), text};
  }

  /** Pill viewport position for the end of the captured range, or hidden. */
  #syncPill(): void {
    const capture = this.selectionCapture;
    if (
      !this.enabled ||
      this.compose ||
      this.picking ||
      !capture ||
      !capture.range.startContainer.isConnected
    ) {
      this.pill = null;
      return;
    }
    const rects = capture.range.getClientRects();
    if (!rects.length) {
      this.pill = null;
      return;
    }
    const last = rects[rects.length - 1];
    const estimatedWidth = 96;
    const estimatedHeight = 30;
    let x = last.right - 24;
    let y = last.bottom + 6;
    // Flip above the selection when there is no room below; clamp both axes
    // to the viewport with an 8px margin, keeping the pill clear of the open
    // rail (the rail paints above the overlay).
    if (y + estimatedHeight > window.innerHeight - 8) {
      y = Math.max(8, last.top - estimatedHeight - 6);
    }
    const drawer = window.matchMedia("(max-width: 899px)").matches;
    const maxX = window.innerWidth - (drawer ? 0 : RAIL_WIDTH) - estimatedWidth - 8;
    x = Math.min(Math.max(8, x), Math.max(8, maxX));
    const next = [Math.round(x), Math.round(y)];
    if (!this.pill || this.pill[0] !== next[0] || this.pill[1] !== next[1]) this.pill = next;
  }

  /* ---------------- picker ---------------- */

  /**
   * "+ Comment" / Alt+Shift+C / selection pill: with a usable text
   * selection, open the composer on the selection directly (no pick-mode
   * round trip); otherwise enter pick mode. `captureAtPress` covers the
   * click case — the press that reached this button collapsed the live
   * selection, but the clone was taken on mousedown.
   */
  #beginComment(): void {
    if (!this.enabled || this.compose) return;
    // Last-resort live read covers the keyboard path, where the
    // selectionchange frame may not have landed before the shortcut.
    const capture = this.selectionCapture ?? this.captureAtPress ?? this.#readHostSelection();
    this.captureAtPress = null;
    if (capture && capture.range.startContainer.isConnected && capture.range.toString().trim()) {
      this.#openCompose(anchorFromRange(capture.range), capture.range.getBoundingClientRect());
      return;
    }
    this.#startPicking();
  }

  /** Enter pick mode: the only state where host clicks are captured. */
  #startPicking(): void {
    if (!this.enabled || this.compose || this.picking) return;
    this.picking = true;
    this.#renderLayers();
  }

  /** Shared composer-open tail: quote excerpt, crop preset, state reset. */
  #openCompose(anchor: PageAnchor, excerptRect: DOMRect): void {
    this.compose = {top: Math.max(8, excerptRect.top), excerpt: truncateExcerpt(anchor.textQuote.exact || anchor.css)};
    // Keep the picked region in page coordinates: the screenshot crop
    // presets from it even after the user scrolls while writing.
    this.pendingAnchorRect = {
      x: excerptRect.left + window.scrollX,
      y: excerptRect.top + window.scrollY,
      width: excerptRect.width,
      height: excerptRect.height,
    };
    this.pendingAnchor = anchor;
    this.pickerRect = null;
    this.picking = false; // a completed pick exits pick mode
    this.selectionCapture = null;
    this.pill = null;
    this.#renderLayers();
    this.rail?.focusComposer();
  }

  #onMousemove(event: MouseEvent): void {
    if (!this.enabled || !this.picking || this.compose) {
      if (this.pickerRect) {
        this.pickerRect = null;
        this.#renderLayers();
      }
      return;
    }
    const hit = document.elementFromPoint(event.clientX, event.clientY);
    if (!hit || ownedByWidget(hit)) {
      if (this.pickerRect) {
        this.pickerRect = null;
        this.#renderLayers();
      }
      return;
    }
    const rect = hit.getBoundingClientRect();
    this.pickerRect = [rect.left, rect.top, rect.width, rect.height];
    this.#renderLayers();
  }

  #onDocumentClick(event: MouseEvent): void {
    // Only pick mode captures clicks; otherwise the host page behaves
    // normally (links, buttons, routers all pass through).
    if (!this.enabled || !this.picking || this.compose) return;
    if (ownedByWidget(event.target instanceof Element ? event.target : null)) return;
    // Picker select: the click chooses an anchor instead of following the page.
    event.preventDefault();
    event.stopPropagation();
    // A press that started on a selection comments on the selection even
    // though the press itself collapsed it (the clone was taken on
    // mousedown) — a range beats the element it lives in.
    const capture = this.selectionCapture ?? this.captureAtPress;
    this.captureAtPress = null;
    if (capture && capture.range.startContainer.isConnected && capture.range.toString().trim()) {
      this.#openCompose(anchorFromRange(capture.range), capture.range.getBoundingClientRect());
      return;
    }
    const target = document.elementFromPoint(event.clientX, event.clientY);
    if (!target || ownedByWidget(target)) return;
    this.#openCompose(anchorFromElement(target), target.getBoundingClientRect());
  }

  /* ---------------- data ---------------- */

  async #loadThreads(): Promise<void> {
    const key = computePageKey(location.href, this.pageKeyStrategy);
    try {
      this.threads = await this.#dataSource().listThreads(key);
    } catch {
      // Keep the last good list; a flaky network must not blank the rail.
    }
    const live = new Set(this.threads.map((thread) => thread.id));
    for (const id of [...this.measuredHeights.keys()]) {
      if (!live.has(id)) this.measuredHeights.delete(id);
    }
    if (this.loadedPageKey !== null && this.loadedPageKey !== key) {
      this.focusedId = null;
      emit(this, "page-comments-page-change", {pageKey: key});
      // Page change also swaps the realtime topic (phase 5).
      this.realtimeConnection?.rejoin(key);
    }
    this.loadedPageKey = key;
    this.recomputeQueued = false;
    this.#recompute();
  }

  /* ---------------- realtime ---------------- */

  #connectRealtime(): void {
    if (!this.realtime || this.realtimeConnection || !this.enabled) return;
    const source = this.#dataSource() as DataSource & Partial<RealtimeCapableDataSource>;
    if (typeof source.connectRealtime !== "function") return;
    this.realtimeConnection = source.connectRealtime(
      computePageKey(location.href, this.pageKeyStrategy),
      (event) => this.#onRealtimeEvent(event),
    );
  }

  #disconnectRealtime(): void {
    this.realtimeConnection?.disconnect();
    this.realtimeConnection = null;
  }

  /** Sign-in/out: token rides connect params, so the socket is rebuilt. */
  #reconnectRealtime(): void {
    this.#disconnectRealtime();
    this.#connectRealtime();
  }

  #onRealtimeEvent(event: RealtimeEvent): void {
    if (!this.enabled) return;
    const merged = mergeRealtimeEvent(this.threads, event, this.ownWrites);
    if (!merged) return; // echo of a write this client made
    this.threads = merged.threads;
    if (merged.unknownThread) {
      // Event for a thread this list has not loaded (list/join race) —
      // a refetch reconciles; the event itself is not enough to render.
      void this.#loadThreads();
      return;
    }
    if (!merged.changed) return; // idempotent replay
    const id = merged.threadId;
    if (id !== null) {
      this.unreadThreads.set(id, (this.unreadThreads.get(id) ?? 0) + 1);
      emit(this, "page-comments-realtime", {type: event.type, threadId: id});
      if (event.type === "thread_anchor_updated") {
        // Force a fresh anchor resolution on the next recompute.
        this.resolvedTargets.delete(id);
        this.previouslyResolved.delete(id);
      }
    }
    this.#recompute();
  }

  #onPageChange(): void {
    const key = computePageKey(location.href, this.pageKeyStrategy);
    if (key === this.loadedPageKey) return;
    void this.#loadThreads();
  }

  async #createThread(body: string): Promise<void> {
    const anchor = this.pendingAnchor;
    if (!anchor || !this.compose) return;
    const key = computePageKey(location.href, this.pageKeyStrategy);
    try {
      const thread = await this.#dataSource().createThread({
        page_key: key,
        url: location.href,
        title: document.title,
        anchor,
        body_md: body,
        ...(this.pending.readyIds().length ? {attachment_ids: this.pending.readyIds()} : {}),
      });
      this.pendingAnchor = null;
      this.pendingAnchorRect = null;
      this.compose = null;
      this.revokePending();
      emit(this, "page-comments-thread-create", {id: thread.id});
      this.ownWrites.record(thread.id); // drop the realtime echo of this write
      this.focusedId = thread.id;
      await this.#loadThreads();
    } catch (error) {
      console.warn("[page-comments] create failed", error);
    }
  }

  async #resolveToggle(id: string, resolve: boolean): Promise<void> {
    const source = this.#dataSource();
    this.ownWrites.record(id); // thread_resolved/reopened echoes carry the thread id
    try {
      if (resolve) await source.resolve(id);
      else await source.reopen(id);
      await this.#loadThreads();
    } catch (error) {
      console.warn("[page-comments] resolve/reopen failed", error);
    }
  }

  async #reply(threadId: string, body: string, attachmentIds: string[] = []): Promise<void> {
    const trimmed = body.trim();
    if (!trimmed && !attachmentIds.length) return;
    try {
      const reply = await this.#dataSource().reply(threadId, trimmed, undefined, attachmentIds.length ? attachmentIds : undefined);
      this.ownWrites.record(reply.id);
      this.revokeReplyPending();
      await this.#loadThreads();
    } catch (error) {
      console.warn("[page-comments] reply failed", error);
    }
  }

  async #editComment(commentId: string, body: string): Promise<void> {
    if (!body.trim()) return;
    this.ownWrites.record(commentId);
    try {
      await this.#dataSource().edit(commentId, body.trim());
      await this.#loadThreads();
    } catch (error) {
      console.warn("[page-comments] edit failed", error);
    }
  }

  async #deleteComment(commentId: string): Promise<void> {
    this.ownWrites.record(commentId);
    try {
      await this.#dataSource().remove(commentId);
      await this.#loadThreads();
    } catch (error) {
      console.warn("[page-comments] delete failed", error);
    }
  }

  /* ---------------- attachments + screenshots ---------------- */

  /** Mirror controller upload/capture state down to the rail. */
  #syncRail(): void {
    this.#renderLayers();
  }

  #supportsAttachments(): boolean {
    return typeof (this.#dataSource() as Partial<AttachmentCapableDataSource>).presign === "function";
  }

  #addAttachments(files: File[]): void {
    if (!files.length || !this.#supportsAttachments()) return;
    for (const file of files) {
      const kind = kindForFile(file);
      const localId = this.pending.add(file, file.name, kind);
      if (!isAcceptedType(file.type)) {
        // Client-side gate mirrors the service allowlist — no wasted upload.
        this.pending.fail(localId, 422);
        this.#syncRail();
        continue;
      }
      // Chip previews are always controller-owned object URLs: the store
      // revokes them on remove/clear, and never touches source URLs.
      if (kind === "image") this.pending.setPreview(localId, URL.createObjectURL(file));
      this.#syncRail();
      void this.#runUpload(this.pending, localId, file, file.name, kind);
    }
  }

  #removePending(localId: string): void {
    for (const store of [this.pending, this.replyPending]) {
      const url = store.remove(localId);
      if (url !== undefined) {
        if (url.startsWith("blob:")) URL.revokeObjectURL(url);
        break;
      }
    }
    this.#syncRail();
  }

  /** Drop composer uploads (cancel/close/post) and free their previews. */
  revokePending(): void {
    for (const url of this.pending.clear()) {
      if (url.startsWith("blob:")) URL.revokeObjectURL(url);
    }
  }

  revokeReplyPending(): void {
    for (const url of this.replyPending.clear()) {
      if (url.startsWith("blob:")) URL.revokeObjectURL(url);
    }
  }

  /** presign → PUT → complete for one blob; failures land on the chip. */
  async #runUpload(
    store: PendingUploads,
    localId: string,
    blob: Blob,
    filename: string,
    kind: Attachment["kind"],
    meta?: CompleteMeta,
  ): Promise<void> {
    const source = this.#dataSource() as DataSource & Partial<AttachmentCapableDataSource>;
    try {
      if (typeof source.presign !== "function" || typeof source.upload !== "function" || typeof source.complete !== "function") {
        throw new Error("data source cannot upload attachments");
      }
      const presigned = await source.presign({
        filename,
        content_type: blob.type || "application/octet-stream",
        bytes: blob.size,
        kind,
      });
      await source.upload(presigned, blob, (loaded, total) => {
        store.progress(localId, loaded, total);
        this.#syncRail();
      });
      // Image dims ride `complete` so the rail can size thumbnails later.
      const dims = kind === "image" ? await imageSize(blob) : null;
      const attachment = await source.complete(presigned.id, dims ? {...dims, ...meta} : meta);
      store.ready(localId, attachment.id);
    } catch (error) {
      store.fail(localId, error instanceof HttpError ? error.status : undefined);
      console.warn("[page-comments] attachment upload failed", error);
    }
    this.#syncRail();
  }

  #snipEl(): NoizuPageCommentsSnip {
    if (!this.snip) {
      this.snip = document.createElement("noizu-page-comments-snip") as NoizuPageCommentsSnip;
      this.snip.setAttribute("data-pc-owned", "");
      this.#wireSnip();
      document.body.append(this.snip);
    }
    return this.snip;
  }

  async #capturePage(): Promise<void> {
    if (this.capturing) return;
    this.capturing = true;
    this.captureNotice = null;
    this.#syncRail();
    try {
      const canvas = await capturePageDocument();
      this.#openSnip(canvas, this.#presetCrop(canvas), null);
    } catch {
      this.captureNotice = "Page capture failed — try “Screen capture” instead.";
    } finally {
      this.capturing = false;
      this.#syncRail();
    }
  }

  async #captureScreen(): Promise<void> {
    if (this.capturing) return;
    this.capturing = true;
    this.captureNotice = null;
    this.#syncRail();
    try {
      const canvas = await captureScreenFrame();
      this.#openSnip(canvas, this.#presetCrop(canvas), null);
    } catch {
      this.captureNotice = "Screen capture was blocked or is unavailable in this browser.";
    } finally {
      this.capturing = false;
      this.#syncRail();
    }
  }

  /** Anchor rect + 24px padding, clamped to the capture bounds. */
  #presetCrop(canvas: HTMLCanvasElement): Rect | null {
    if (!this.pendingAnchorRect) return null;
    return padRect(this.pendingAnchorRect, ANCHOR_PADDING, {width: canvas.width, height: canvas.height});
  }

  #openSnip(
    canvas: HTMLCanvasElement,
    preset: Rect | null,
    initial: AnnotationDocument | null,
    mode: {kind: "compose"} | {kind: "reply"; threadId: string} = {kind: "compose"},
  ): void {
    this.snipMode = mode;
    const snip = this.#snipEl();
    snip.capture = canvas;
    snip.presetCrop = preset;
    snip.initial = initial;
    snip.show();
  }

  async #saveScreenshot(detail: {
    canvas: HTMLCanvasElement;
    width: number;
    height: number;
    annotation: AnnotationDocument;
  }): Promise<void> {
    const mode = this.snipMode;
    const store = mode.kind === "compose" ? this.pending : this.replyPending;
    let blob: Blob | null = null;
    try {
      blob = await canvasToPng(detail.canvas);
    } catch {
      blob = null;
    }
    if (!blob) {
      this.captureNotice = "Screenshot export failed — the page may block reading captured pixels.";
      this.#syncRail();
      return;
    }
    const name = `screenshot-${Date.now()}.png`;
    const localId = store.add(blob, name, "screenshot");
    store.setPreview(localId, URL.createObjectURL(blob));
    this.#syncRail();
    if (mode.kind === "reply") this.rail?.openReply(mode.threadId);
    await this.#runUpload(store, localId, blob, name, "screenshot", {
      width: detail.width,
      height: detail.height,
      annotation: detail.annotation,
    });
  }

  #findAttachment(attachmentId: string): ({thread: CommentThread} & Attachment) | null {
    for (const thread of this.threads) {
      const everywhere = [...(thread.attachments ?? []), ...thread.comments.flatMap((comment) => comment.attachments ?? [])];
      for (const attachment of everywhere) {
        if (attachment.id === attachmentId) return {thread, ...attachment};
      }
    }
    return null;
  }

  /** Re-open a stored screenshot annotation; saving produces a new attachment. */
  async #openAnnotationEdit(attachmentId: string): Promise<void> {
    const hit = this.#findAttachment(attachmentId);
    if (!hit?.annotation || !hit.url) return;
    try {
      const canvas = await imageUrlToCanvas(hit.url);
      this.#openSnip(canvas, hit.annotation.crop, hit.annotation, {kind: "reply", threadId: hit.thread.id});
    } catch (error) {
      console.warn("[page-comments] annotation re-open failed", error);
      this.captureNotice = "Could not load the screenshot for editing.";
      this.#syncRail();
    }
  }

  /* ---------------- layout + render ---------------- */

  #requestRecompute = (): void => {
    if (this.recomputeQueued) return;
    this.recomputeQueued = true;
    requestAnimationFrame(() => {
      this.recomputeQueued = false;
      this.#recompute();
    });
  };

  #recompute(): void {
    if (!this.enabled) return;
    const orphaned: string[] = [];
    this.resolvedTargets.clear();
    for (const thread of this.threads) {
      const hit = resolveAnchor(thread.anchor);
      this.resolvedTargets.set(thread.id, hit);
      if (hit) {
        if (!this.previouslyResolved.has(thread.id)) this.previouslyResolved.add(thread.id);
      } else if (this.previouslyResolved.has(thread.id)) {
        orphaned.push(thread.id);
      }
    }
    for (const id of orphaned) {
      this.previouslyResolved.delete(id);
      emit(this, "page-comments-thread-orphan", {id});
    }

    const drawer = window.matchMedia("(max-width: 899px)").matches;
    const cards: ThreadCardView[] = [];
    if (!drawer) {
      const inputs = this.threads
        .filter((thread) => this.resolvedTargets.get(thread.id))
        .map((thread) => {
          const rects = anchorRects(this.resolvedTargets.get(thread.id)!.target);
          const first = rects[0] ?? new DOMRect(0, 0, 0, 0);
          return {id: thread.id, idealTop: first.top, height: this.measuredHeights.get(thread.id) ?? cardHeight(thread)};
        });
      const tops = computeRailLayout(inputs, this.focusedId, {
        minTop: 8,
        maxTop: Math.max(120, window.innerHeight - 8),
      });
      for (const thread of this.threads) {
        const hit = this.resolvedTargets.get(thread.id);
        const top = tops.get(thread.id);
        cards.push({
          thread,
          top: hit ? (top ?? 8) : null,
          focused: this.focusedId === thread.id,
          confidence: hit ? hit.confidence : "orphan",
          excerpt: excerptOf(thread),
        });
      }
    } else {
      for (const thread of this.threads) {
        const hit = this.resolvedTargets.get(thread.id);
        cards.push({
          thread,
          top: hit ? 0 : null,
          focused: this.focusedId === thread.id,
          confidence: hit ? hit.confidence : "orphan",
          excerpt: excerptOf(thread),
        });
      }
    }
    this.cards = cards;

    const focused = this.threads.find((thread) => thread.id === this.focusedId);
    const focusedHit = focused ? this.resolvedTargets.get(focused.id) : undefined;
    if (focused && focusedHit) {
      this.rings = [
        {
          threadId: focused.id,
          rects: anchorRects(focusedHit.target).map((rect) => [rect.left, rect.top, rect.width, rect.height]),
        },
      ];
    } else {
      this.rings = [];
    }
    // The pill tracks the selection across scroll/resize (both funnel into
    // recompute) and hides once the range no longer resolves.
    this.#syncPill();
    this.#renderLayers();
  }

  #focusCard(id: string, scroll: boolean): void {
    this.focusedId = id;
    // Focusing marks a thread seen — clears its unread dot.
    this.unreadThreads.delete(id);
    const hit = this.resolvedTargets.get(id);
    if (scroll && hit) {
      const element = hit.target instanceof Element ? hit.target : (hit.target.startContainer instanceof Element ? hit.target.startContainer : hit.target.startContainer.parentElement);
      element?.scrollIntoView({behavior: "smooth", block: "center"});
    }
    this.#recompute();
  }

  #renderLayers(): void {
    if (this.rail) {
      this.rail.enabled = this.enabled;
      this.rail.picking = this.picking;
      this.rail.cards = this.cards;
      this.rail.compose = this.compose;
      this.rail.signedIn = this.signedIn;
      this.rail.pageKey = computePageKey(location.href, this.pageKeyStrategy);
      this.rail.pendingUploads = this.pending.list();
      this.rail.replyChips = this.replyPending.list();
      this.rail.canAttach = this.#supportsAttachments();
      this.rail.capturing = this.capturing;
      this.rail.notice = this.captureNotice;
      this.rail.unread = Object.fromEntries(this.unreadThreads);
    }
    if (this.overlay) {
      this.overlay.rings = this.enabled ? this.rings : [];
      this.overlay.pickerRect = this.enabled && this.compose === null ? this.pickerRect : null;
      this.overlay.pill = this.enabled ? this.pill : null;
    }
  }

  override render(): TemplateResult {
    return html``;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "noizu-page-comments": NoizuPageComments;
    "noizu-page-comments-rail": NoizuPageCommentsRail;
    "noizu-page-comments-overlay": NoizuPageCommentsOverlay;
    "noizu-page-comments-lightbox": NoizuPageCommentsLightbox;
    "noizu-page-comments-snip": NoizuPageCommentsSnip;
  }
}
