/**
 * `<noizu-page-comments-snip>` — screenshot crop + annotate modal for
 * `<noizu-page-comments>`. Appended to `document.body` by the controller and
 * marked `data-pc-owned` so captures exclude it. Two stages:
 *
 * 1. crop — the full capture scaled to fit, with a draggable/resizable crop
 *    rect (8 handles, keyboard nudge). Preset from the thread anchor's rect
 *    + 24px padding when one exists.
 * 2. annotate — in-house canvas editor: rect, arrow, pen, text, pixelate
 *    (blur/redact), color swatches, stroke widths, undo/redo, clear. Ops are
 *    the vector model from `annotation.ts`; the canvas is a deterministic
 *    replay, so "Save" flattens the exact pixels shown (devicePixelRatio
 *    aware) and the stored JSON can re-open the drawing for editing.
 *
 * Emits `pc-snip-save` {canvas, width, height, annotation} (bubbles) and
 * `pc-snip-cancel`. The controller owns presign/upload/complete.
 */

import {LitElement, css, html, nothing, type PropertyValues, type TemplateResult} from "lit";
import {property, query, state} from "lit/decorators.js";

import {
  AnnotationHistory,
  applyHandleDrag,
  clampRect,
  enforceMinSize,
  hitTestHandle,
  moveRect,
  normalizeRect,
  opId,
  parseAnnotation,
  renderAnnotation,
  type AnnotateOp,
  type AnnotateTool,
  type AnnotationDocument,
  type HandleId,
  type Rect,
} from "./annotation.js";
import {FocusKeeper, trapFocus} from "./a11y.js";
import {defineElement} from "../../define.js";

const DEFAULT_COLOR = "#ef4444";
const COLORS: Array<[string, string]> = [
  ["#ef4444", "red"],
  ["#f5c451", "yellow"],
  ["#22c55e", "green"],
  ["#3b82f6", "blue"],
  ["#111111", "black"],
];
const STROKES = [2, 4, 8];
const TOOLS: Array<[AnnotateTool, string, string]> = [
  ["rect", "▭", "Rectangle"],
  ["arrow", "↗", "Arrow"],
  ["pen", "✎", "Freehand pen"],
  ["text", "T", "Text"],
  ["pixelate", "▒", "Blur / redact"],
];

interface DragState {
  kind: "move" | "handle" | "draw";
  handle?: HandleId;
  startX: number;
  startY: number;
  origin?: Rect;
  draft?: AnnotateOp;
}

@defineElement("noizu-page-comments-snip")
export class NoizuPageCommentsSnip extends LitElement {
  static override styles = css`
    :host {
      position: fixed;
      inset: 0;
      z-index: var(--pc-snip-z, 2147482000);
    }

    /* Closed modal must not keep a fixed full-viewport hit area. */
    :host(:not([data-open])) {
      display: none;
    }

    .scrim {
      position: absolute;
      inset: 0;
      background: rgb(0 0 0 / 78%);
      display: grid;
      place-items: center;
    }

    .dialog {
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-width: 94vw;
      max-height: 94vh;
      background: var(--tobor-kit-bg, #fff);
      color: var(--tobor-kit-fg, #111);
      border: 1px solid var(--tobor-kit-border, #ccc);
      border-radius: 10px;
      padding: 14px;
    }

    header {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    header h2 {
      flex: 1;
      margin: 0;
      font-size: 1em;
    }

    .stage-wrap {
      position: relative;
      overflow: hidden;
      border: 1px solid var(--tobor-kit-border, #ccc);
      line-height: 0;
    }

    canvas {
      display: block;
      max-width: 78vw;
      max-height: 62vh;
    }

    .crop-rect {
      position: absolute;
      border: 2px solid var(--tobor-kit-accent, #6ee7c7);
      box-shadow: 0 0 0 9999px rgb(0 0 0 / 45%);
      cursor: move;
      touch-action: none;
    }

    .crop-rect .handle {
      position: absolute;
      width: 12px;
      height: 12px;
      background: var(--tobor-kit-accent, #6ee7c7);
      border: 1px solid #000;
      box-sizing: border-box;
    }

    .handle[data-handle="nw"] { left: -6px; top: -6px; cursor: nwse-resize; }
    .handle[data-handle="n"] { left: calc(50% - 6px); top: -6px; cursor: ns-resize; }
    .handle[data-handle="ne"] { right: -6px; top: -6px; cursor: nesw-resize; }
    .handle[data-handle="e"] { right: -6px; top: calc(50% - 6px); cursor: ew-resize; }
    .handle[data-handle="se"] { right: -6px; bottom: -6px; cursor: nwse-resize; }
    .handle[data-handle="s"] { left: calc(50% - 6px); bottom: -6px; cursor: ns-resize; }
    .handle[data-handle="sw"] { left: -6px; bottom: -6px; cursor: nesw-resize; }
    .handle[data-handle="w"] { left: -6px; top: calc(50% - 6px); cursor: ew-resize; }

    .toolbar {
      display: flex;
      align-items: center;
      gap: 4px;
      flex-wrap: wrap;
    }

    .toolbar button {
      min-width: 30px;
      padding: 4px 8px;
    }

    .swatch {
      width: 22px;
      height: 22px;
      padding: 0;
      border-radius: 50%;
      border: 2px solid transparent;
    }

    .swatch[aria-pressed="true"] {
      border-color: var(--tobor-kit-fg, #111);
    }

    footer {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    footer .spacer {
      flex: 1;
    }

    .hint {
      margin: 0;
      font-size: 0.78em;
      color: var(--tobor-kit-muted, #666);
    }

    .text-input {
      position: absolute;
      font: 14px system-ui, sans-serif;
      border: 1px dashed var(--tobor-kit-accent, #6ee7c7);
      background: rgb(255 255 255 / 90%);
      color: #111;
      z-index: 2;
    }

    .primary {
      font-weight: 600;
    }
  `;

  /** Full capture raster (capture coordinates = capture canvas pixels). */
  @property({attribute: false}) capture: HTMLCanvasElement | null = null;
  /** Preset crop in capture coordinates (anchor rect + padding), optional. */
  @property({attribute: false}) presetCrop: Rect | null = null;
  /** Existing annotation re-opened for editing (starts at the draw stage). */
  @property({attribute: false}) initial: AnnotationDocument | null = null;

  @state() private open = false;
  @state() private stage: "crop" | "annotate" = "crop";
  @state() private crop: Rect = {x: 0, y: 0, width: 0, height: 0};
  @state() private tool: AnnotateTool = "rect";
  @state() private color = DEFAULT_COLOR;
  @state() private strokeWidth = 4;
  @state() private canUndo = false;
  @state() private canRedo = false;
  @state() private textDraft: {x: number; y: number; displayX: number; displayY: number} | null = null;

  @query(".crop-rect") private cropRectEl!: HTMLElement;
  @query(".draw-canvas") private drawCanvas!: HTMLCanvasElement;
  @query(".text-input") private textInput!: HTMLInputElement;

  private history = new AnnotationHistory();
  private cropped: HTMLCanvasElement | null = null;
  private displayScale = 1;
  private drag: DragState | null = null;
  private keeper = new FocusKeeper();
  private keyListener = (event: KeyboardEvent): void => this.#onKeydown(event);

  /** Open the editor over the current page. */
  show(): void {
    this.open = true;
    this.setAttribute("data-open", "");
    this.keeper.capture();
    const initial = this.initial ? parseAnnotation(this.initial) : null;
    this.history = new AnnotationHistory(initial?.ops ?? []);
    this.#syncHistoryFlags();
    const bounds = {width: this.capture?.width ?? 800, height: this.capture?.height ?? 600};
    this.crop = initial
      ? clampRect(initial.crop, bounds)
      : this.presetCrop
        ? clampRect(enforceMinSize(this.presetCrop), bounds)
        : this.#defaultCrop(bounds);
    this.stage = initial ? "annotate" : "crop";
    document.addEventListener("keydown", this.keyListener, true);
  }

  close(): void {
    if (!this.open) return;
    this.open = false;
    this.removeAttribute("data-open");
    document.removeEventListener("keydown", this.keyListener, true);
    this.keeper.restore();
    this.#send("pc-snip-cancel");
  }

  override disconnectedCallback(): void {
    document.removeEventListener("keydown", this.keyListener, true);
    this.keeper.restore();
    super.disconnectedCallback();
  }

  #defaultCrop(bounds: {width: number; height: number}): Rect {
    return clampRect(
      {
        x: bounds.width * 0.1,
        y: bounds.height * 0.1,
        width: bounds.width * 0.8,
        height: bounds.height * 0.8,
      },
      bounds,
    );
  }

  #send(name: string, detail: Record<string, unknown> = {}): void {
    this.dispatchEvent(new CustomEvent(name, {detail, bubbles: true, composed: false}));
  }

  #onKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      event.stopPropagation();
      this.close();
      return;
    }
    if (event.key === "Tab") trapFocus(this.renderRoot, event);
  }

  /* ---------------- rendering ---------------- */

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed);
    this.#paint();
  }

  #paint(): void {
    if (!this.open || !this.capture) return;
    if (this.stage === "crop") this.#paintCrop();
    else this.#paintDraw();
  }

  #fitScale(): number {
    if (!this.capture) return 1;
    const maxW = Math.min(window.innerWidth * 0.78, 1100);
    const maxH = window.innerHeight * 0.62;
    return Math.min(maxW / this.capture.width, maxH / this.capture.height, 1);
  }

  #paintCrop(): void {
    const canvas = this.renderRoot.querySelector<HTMLCanvasElement>(".crop-canvas");
    if (!canvas || !this.capture) return;
    this.displayScale = this.#fitScale();
    canvas.width = this.capture.width;
    canvas.height = this.capture.height;
    canvas.style.width = `${Math.round(this.capture.width * this.displayScale)}px`;
    canvas.style.height = `${Math.round(this.capture.height * this.displayScale)}px`;
    const ctx = canvas.getContext("2d");
    ctx?.drawImage(this.capture, 0, 0);
  }

  /** Slice the current crop out of the capture at native resolution. */
  #buildCropped(): HTMLCanvasElement | null {
    if (!this.capture) return null;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(this.crop.width));
    canvas.height = Math.max(1, Math.round(this.crop.height));
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(this.capture, this.crop.x, this.crop.y, this.crop.width, this.crop.height, 0, 0, canvas.width, canvas.height);
    return canvas;
  }

  #paintDraw(): void {
    if (!this.cropped) this.cropped = this.#buildCropped();
    if (!this.cropped || !this.drawCanvas) return;
    this.displayScale = Math.min(
      (window.innerWidth * 0.78) / this.cropped.width,
      (window.innerHeight * 0.62) / this.cropped.height,
      1,
    );
    const dpr = window.devicePixelRatio || 1;
    if (this.drawCanvas.width !== Math.round(this.cropped.width * dpr)) {
      this.drawCanvas.width = Math.round(this.cropped.width * dpr);
      this.drawCanvas.height = Math.round(this.cropped.height * dpr);
    }
    this.drawCanvas.style.width = `${Math.round(this.cropped.width * this.displayScale)}px`;
    this.drawCanvas.style.height = `${Math.round(this.cropped.height * this.displayScale)}px`;
    const ctx = this.drawCanvas.getContext("2d");
    if (!ctx) return;
    const ops = this.drag?.draft ? [...this.history.ops, this.drag.draft] : this.history.ops;
    renderAnnotation(ctx, {
      base: this.cropped,
      baseWidth: this.cropped.width,
      baseHeight: this.cropped.height,
      ops,
      dpr,
    });
  }

  /* ---------------- crop stage interactions ---------------- */

  /** Pointer capture is best-effort: synthetic events (tests) have no active pointer. */
  #grab(el: HTMLElement, event: PointerEvent): void {
    try {
      el.setPointerCapture(event.pointerId);
    } catch {
      /* drag still works while events target the same element */
    }
  }

  #release(el: HTMLElement, event: PointerEvent): void {
    try {
      el.releasePointerCapture(event.pointerId);
    } catch {
      /* nothing captured — nothing to release */
    }
  }

  #displayPoint(event: PointerEvent, host: HTMLElement): [number, number] {
    const rect = host.getBoundingClientRect();
    const scaleX = this.capture ? this.capture.width / rect.width : 1;
    const scaleY = this.capture ? this.capture.height / rect.height : 1;
    return [(event.clientX - rect.left) * scaleX, (event.clientY - rect.top) * scaleY];
  }

  #onCropPointerdown(event: PointerEvent): void {
    if (!this.capture) return;
    const [x, y] = this.#displayPoint(event, this.cropRectEl.parentElement ?? this.cropRectEl);
    const handle = hitTestHandle(this.crop, x, y);
    this.drag = {
      kind: handle ? "handle" : "move",
      handle: handle ?? undefined,
      startX: x,
      startY: y,
      origin: {...this.crop},
    };
    this.#grab(event.currentTarget as HTMLElement, event);
  }

  #onCropPointermove(event: PointerEvent): void {    if (!this.drag || !this.capture) return;
    const bounds = {width: this.capture.width, height: this.capture.height};
    const [x, y] = this.#displayPoint(event, this.cropRectEl.parentElement ?? this.cropRectEl);
    const dx = x - this.drag.startX;
    const dy = y - this.drag.startY;
    if (this.drag.kind === "move" && this.drag.origin) {
      this.crop = moveRect(this.drag.origin, dx, dy, bounds);
    } else if (this.drag.handle && this.drag.origin) {
      this.crop = applyHandleDrag(this.drag.origin, this.drag.handle, dx, dy, bounds);
    }
  }

  #onCropPointerup(event: PointerEvent): void {
    if (!this.drag) return;
    this.#release(event.currentTarget as HTMLElement, event);
    this.drag = null;
  }

  #onCropKeydown(event: KeyboardEvent): void {
    if (!this.capture) return;
    const bounds = {width: this.capture.width, height: this.capture.height};
    const step = event.shiftKey ? 10 : 1;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const move = moves[event.key];
    if (move && !event.altKey) {
      event.preventDefault();
      this.crop = moveRect(this.crop, move[0], move[1], bounds);
      return;
    }
    if (move && event.altKey) {
      // Alt+arrows resize from the south-east corner.
      event.preventDefault();
      this.crop = applyHandleDrag(this.crop, "se", move[0], move[1], bounds);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      this.#applyCrop();
    }
  }

  #applyCrop(): void {
    const bounds = {width: this.capture?.width ?? this.crop.width, height: this.capture?.height ?? this.crop.height};
    this.crop = clampRect(enforceMinSize(this.crop), bounds);
    this.cropped = this.#buildCropped();
    this.displayScale = this.#fitScale();
    this.stage = "annotate";
  }

  #startDraw(event: PointerEvent): void {
    const [x, y] = this.#displayPoint(event, this.drawCanvas);
    if (this.tool === "text") {
      this.textDraft = {
        x,
        y,
        displayX: event.clientX - this.drawCanvas.getBoundingClientRect().left,
        displayY: event.clientY - this.drawCanvas.getBoundingClientRect().top,
      };
      this.updateComplete.then(() => this.textInput?.focus());
      return;
    }
    const base = {id: opId(), color: this.color, strokeWidth: this.strokeWidth};
    const draft: AnnotateOp =
      this.tool === "rect"
        ? {...base, type: "rect", rect: normalizeRect(x, y, x, y)}
        : this.tool === "arrow"
          ? {...base, type: "arrow", x1: x, y1: y, x2: x, y2: y}
          : this.tool === "pen"
            ? {...base, type: "pen", points: [[x, y]]}
            : {...base, type: "pixelate", rect: normalizeRect(x, y, x, y), blockSize: Math.max(8, this.strokeWidth * 4)};
    this.drag = {kind: "draw", startX: x, startY: y, draft};
    this.#grab(this.drawCanvas, event);
  }

  #moveDraw(event: PointerEvent): void {
    if (!this.drag || this.drag.kind !== "draw" || !this.drag.draft) return;
    const [x, y] = this.#displayPoint(event, this.drawCanvas);
    const draft = this.drag.draft;
    if (draft.type === "pen") {
      draft.points.push([x, y]);
    } else if (draft.type === "rect" || draft.type === "pixelate") {
      draft.rect = normalizeRect(this.drag.startX, this.drag.startY, x, y);
    } else if (draft.type === "arrow") {
      draft.x2 = x;
      draft.y2 = y;
    }
    this.#paintDraw();
  }

  #endDraw(event: PointerEvent): void {
    if (!this.drag) return;
    this.#release(this.drawCanvas, event);
    if (this.drag.kind === "draw" && this.drag.draft) {
      const draft = this.drag.draft;
      const tiny =
        (draft.type === "pen" && draft.points.length < 2) ||
        ((draft.type === "rect" || draft.type === "pixelate") && (draft.rect.width < 2 || draft.rect.height < 2)) ||
        (draft.type === "arrow" && Math.hypot(draft.x2 - draft.x1, draft.y2 - draft.y1) < 2);
      if (!tiny) {
        this.history.push(draft);
        this.#syncHistoryFlags();
      }
    }
    this.drag = null;
    this.#paintDraw();
  }

  #commitText(): void {
    if (!this.textDraft) return;
    const text = this.textInput.value.trim();
    const at = this.textDraft;
    this.textDraft = null;
    if (!text) return;
    this.history.push({
      id: opId(),
      type: "text",
      x: at.x,
      y: at.y,
      text,
      fontSize: Math.max(14, this.strokeWidth * 4),
      color: this.color,
      strokeWidth: this.strokeWidth,
    });
    this.#syncHistoryFlags();
  }

  #syncHistoryFlags(): void {
    this.canUndo = this.history.canUndo;
    this.canRedo = this.history.canRedo;
  }

  #save(): void {
    this.#commitText();
    if (!this.cropped || !this.drawCanvas) {
      // Annotate stage always builds both; unreachable in practice.
      return;
    }
    const annotation: AnnotationDocument = {
      version: 1,
      crop: {...this.crop},
      ops: this.history.ops.map((op) => structuredClone(op)),
    };
    this.open = false;
    this.removeAttribute("data-open");
    document.removeEventListener("keydown", this.keyListener, true);
    this.keeper.restore();
    this.#send("pc-snip-save", {
      canvas: this.drawCanvas,
      width: this.cropped.width,
      height: this.cropped.height,
      annotation,
    });
  }

  override render(): TemplateResult {
    if (!this.open || !this.capture) return html`${nothing}`;
    return html`
      <div class="scrim" data-cy="comments.snip-modal" @click=${(e: Event) => {
        if (e.target === e.currentTarget) this.close();
      }}>
        <div class="dialog" role="dialog" aria-modal="true" aria-label="Screenshot editor">
          <header>
            <h2>${this.stage === "crop" ? "Crop screenshot" : "Annotate screenshot"}</h2>
            <button data-cy="comments.snip-cancel" aria-label="Discard screenshot" @click=${() => this.close()}>✕</button>
          </header>
          ${this.stage === "crop" ? this.#renderCrop() : this.#renderAnnotate()}
        </div>
      </div>
    `;
  }

  #renderCrop(): TemplateResult {
    const scale = this.displayScale || this.#fitScale();
    const style = `left: ${this.crop.x * scale}px; top: ${this.crop.y * scale}px; width: ${this.crop.width * scale}px; height: ${this.crop.height * scale}px;`;
    return html`
      <div class="stage-wrap">
        <canvas class="crop-canvas" role="img" aria-label="Full page capture"></canvas>
        <div
          class="crop-rect"
          data-cy="comments.crop-rect"
          style=${style}
          role="group"
          aria-label="Crop region — arrow keys move, Alt+arrow keys resize, Enter continues"
          tabindex="0"
          @keydown=${this.#onCropKeydown}
          @pointerdown=${this.#onCropPointerdown}
          @pointermove=${this.#onCropPointermove}
          @pointerup=${this.#onCropPointerup}
        >
          ${(["nw", "n", "ne", "e", "se", "s", "sw", "w"] as HandleId[]).map(
            (handle) => html`<div class="handle" data-handle=${handle} data-cy="comments.crop-handle"></div>`,
          )}
        </div>
      </div>
      <footer>
        <p class="hint">Arrow keys nudge · Alt+arrows resize · drag edges or corners</p>
        <span class="spacer"></span>
        <button data-cy="comments.snip-cancel" @click=${() => this.close()}>Cancel</button>
        <button class="primary" data-cy="comments.snip-apply" @click=${() => this.#applyCrop()}>Annotate →</button>
      </footer>
    `;
  }

  #renderAnnotate(): TemplateResult {
    return html`
      <div class="toolbar" role="toolbar" aria-label="Annotation tools">
        ${TOOLS.map(
          ([tool, glyph, label]) => html`
            <button
              data-cy="comments.tool-${tool}"
              aria-label=${label}
              aria-pressed=${this.tool === tool ? "true" : "false"}
              @click=${() => (this.tool = tool)}
            >${glyph}</button>
          `,
        )}
        <span aria-hidden="true">·</span>
        ${COLORS.map(
          ([value, name]) => html`
            <button
              class="swatch"
              style="background: ${value}"
              data-cy="comments.color"
              data-color=${value}
              aria-label="${name} color"
              aria-pressed=${this.color === value ? "true" : "false"}
              @click=${() => (this.color = value)}
            ></button>
          `,
        )}
        <span aria-hidden="true">·</span>
        ${STROKES.map(
          (width) => html`
            <button
              data-cy="comments.stroke"
              data-width=${width}
              aria-label="Stroke width ${width}"
              aria-pressed=${this.strokeWidth === width ? "true" : "false"}
              @click=${() => (this.strokeWidth = width)}
            >${width}px</button>
          `,
        )}
        <span aria-hidden="true">·</span>
        <button data-cy="comments.undo" aria-label="Undo annotation" ?disabled=${!this.canUndo} @click=${() => {
          this.history.undo();
          this.#syncHistoryFlags();
          this.#paintDraw();
        }}>↩</button>
        <button data-cy="comments.redo" aria-label="Redo annotation" ?disabled=${!this.canRedo} @click=${() => {
          this.history.redo();
          this.#syncHistoryFlags();
          this.#paintDraw();
        }}>↪</button>
        <button data-cy="comments.clear" aria-label="Clear all annotations" ?disabled=${!this.canUndo} @click=${() => {
          this.history.clear();
          this.#syncHistoryFlags();
          this.#paintDraw();
        }}>Clear</button>
      </div>
      <div class="stage-wrap">
        <canvas
          class="draw-canvas"
          data-cy="comments.annotate-canvas"
          role="img"
          aria-label="Screenshot annotation canvas — ${this.tool} tool active"
          @pointerdown=${this.#startDraw}
          @pointermove=${this.#moveDraw}
          @pointerup=${this.#endDraw}
        ></canvas>
        ${this.textDraft
          ? html`<input
              class="text-input"
              data-cy="comments.text-input"
              aria-label="Annotation text — Enter to place"
              style="left: ${this.textDraft.displayX}px; top: ${this.textDraft.displayY}px"
              @keydown=${(e: KeyboardEvent) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  this.#commitText();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  this.textDraft = null;
                }
              }}
            />`
          : nothing}
      </div>
      <footer>
        <button data-cy="comments.snip-recrop" @click=${() => {
          this.stage = "crop";
        }}>← Re-crop</button>
        <span class="spacer"></span>
        <button data-cy="comments.snip-cancel" @click=${() => this.close()}>Cancel</button>
        <button class="primary" data-cy="comments.snip-save" @click=${() => this.#save()}>Save screenshot</button>
      </footer>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "noizu-page-comments-snip": NoizuPageCommentsSnip;
  }
}
