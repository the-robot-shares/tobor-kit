/**
 * Screenshot annotation model for `<noizu-page-comments>` — pure logic, no
 * Lit, no network. The stored artifact is a vector-op document:
 *
 *   { version: 1, crop: {x, y, width, height}, ops: AnnotateOp[] }
 *
 * `crop` is the region of the original capture, in capture CSS pixels; `ops`
 * draw on top of the cropped bitmap. Rendering is a straight replay onto a
 * canvas (deterministic), so a stored annotation always re-renders exactly —
 * the editor only ever appends/undoes whole ops, never mutates one.
 */

export const ANNOTATION_VERSION = 1;
export const MIN_CROP_SIZE = 16;
/** Hard cap on stored ops so a runaway session can't bloat the payload. */
export const MAX_OPS = 500;

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type AnnotateTool = "rect" | "arrow" | "pen" | "text" | "pixelate";

interface OpBase {
  id: string;
  color: string;
  strokeWidth: number;
}

export type AnnotateOp =
  | (OpBase & {type: "rect"; rect: Rect})
  | (OpBase & {type: "arrow"; x1: number; y1: number; x2: number; y2: number})
  | (OpBase & {type: "pen"; points: Array<[number, number]>})
  | (OpBase & {type: "text"; x: number; y: number; text: string; fontSize: number})
  | {id: string; type: "pixelate"; rect: Rect; blockSize: number};

export interface AnnotationDocument {
  version: 1;
  crop: Rect;
  ops: AnnotateOp[];
}

let opCounter = 0;

/** Opaque unique-enough op id (stable within a session; serialization keeps it). */
export function opId(): string {
  opCounter += 1;
  return `op-${Date.now().toString(36)}-${opCounter}`;
}

/* ------------------------------------------------------------------ */
/* crop math (pure, unit-tested)                                       */
/* ------------------------------------------------------------------ */

/** Normalize two drag corners into a positive-size rect. */
export function normalizeRect(x1: number, y1: number, x2: number, y2: number): Rect {
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
  };
}

/** Clamp a rect fully inside `bounds`, preserving size where possible. */
export function clampRect(rect: Rect, bounds: {width: number; height: number}): Rect {
  const width = Math.min(rect.width, bounds.width);
  const height = Math.min(rect.height, bounds.height);
  return {
    x: Math.min(Math.max(rect.x, 0), Math.max(0, bounds.width - width)),
    y: Math.min(Math.max(rect.y, 0), Math.max(0, bounds.height - height)),
    width,
    height,
  };
}

/** Preset crop around an anchor rect plus padding, clamped to the capture. */
export function padRect(
  anchor: Rect,
  padding: number,
  bounds: {width: number; height: number},
): Rect {
  return clampRect(
    {
      x: anchor.x - padding,
      y: anchor.y - padding,
      width: anchor.width + padding * 2,
      height: anchor.height + padding * 2,
    },
    bounds,
  );
}

export function moveRect(rect: Rect, dx: number, dy: number, bounds: {width: number; height: number}): Rect {
  return clampRect({...rect, x: rect.x + dx, y: rect.y + dy}, bounds);
}

export function scaleRect(rect: Rect, factor: number): Rect {
  return {x: rect.x * factor, y: rect.y * factor, width: rect.width * factor, height: rect.height * factor};
}

/** Crop rects under the display minimum collapse to the minimum. */
export function enforceMinSize(rect: Rect, min = MIN_CROP_SIZE): Rect {
  return {
    ...rect,
    width: Math.max(rect.width, min),
    height: Math.max(rect.height, min),
  };
}

export type HandleId = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

const HANDLE_TOLERANCE = 8;

/** Which resize handle sits at (x, y) in rect-local display space, if any. */
export function hitTestHandle(rect: Rect, x: number, y: number, tolerance = HANDLE_TOLERANCE): HandleId | null {
  const left = rect.x;
  const right = rect.x + rect.width;
  const top = rect.y;
  const bottom = rect.y + rect.height;
  const onW = near(x, left, tolerance);
  const onE = near(x, right, tolerance);
  const onN = near(y, top, tolerance);
  const onS = near(y, bottom, tolerance);
  const inX = x > left - tolerance && x < right + tolerance;
  const inY = y > top - tolerance && y < bottom + tolerance;
  if (onW && onN) return "nw";
  if (onE && onN) return "ne";
  if (onE && onS) return "se";
  if (onW && onS) return "sw";
  if (onN && inX) return "n";
  if (onS && inX) return "s";
  if (onE && inY) return "e";
  if (onW && inY) return "w";
  return null;
}

function near(value: number, target: number, tolerance: number): boolean {
  return Math.abs(value - target) <= tolerance;
}

/**
 * Drag `handle` by (dx, dy) in capture coordinates. Corners move two edges,
 * edges one; the rect never inverts (a drag past the opposite edge pins to
 * the minimum size) and never leaves `bounds`.
 */
export function applyHandleDrag(
  rect: Rect,
  handle: HandleId,
  dx: number,
  dy: number,
  bounds: {width: number; height: number},
  min = MIN_CROP_SIZE,
): Rect {
  let {x, y, width, height} = rect;
  let left = x;
  let top = y;
  let right = x + width;
  let bottom = y + height;

  if (handle.includes("w")) {
    left = Math.min(Math.max(0, x + dx), right - min);
  }
  if (handle.includes("e")) {
    right = Math.max(Math.min(bounds.width, x + width + dx), left + min);
  }
  if (handle.includes("n")) {
    top = Math.min(Math.max(0, y + dy), bottom - min);
  }
  if (handle.includes("s")) {
    bottom = Math.max(Math.min(bounds.height, y + height + dy), top + min);
  }
  return clampRect({x: left, y: top, width: right - left, height: bottom - top}, bounds);
}

/* ------------------------------------------------------------------ */
/* history (additive ops; undo/redo re-slice the log)                  */
/* ------------------------------------------------------------------ */

export class AnnotationHistory {
  private log: AnnotateOp[] = [];
  private cursor = 0;

  constructor(ops: AnnotateOp[] = []) {
    this.log = ops.map((op) => ({...op}));
    this.cursor = this.log.length;
  }

  get ops(): readonly AnnotateOp[] {
    return this.log.slice(0, this.cursor);
  }

  get canUndo(): boolean {
    return this.cursor > 0;
  }

  get canRedo(): boolean {
    return this.cursor < this.log.length;
  }

  /** Append an op; anything previously undone is dropped for good. */
  push(op: AnnotateOp): void {
    this.log = this.log.slice(0, this.cursor);
    this.log.push(op);
    if (this.log.length > MAX_OPS) this.log = this.log.slice(-MAX_OPS);
    this.cursor = this.log.length;
  }

  undo(): AnnotateOp | null {
    if (!this.canUndo) return null;
    this.cursor -= 1;
    return this.log[this.cursor];
  }

  redo(): AnnotateOp | null {
    if (!this.canRedo) return null;
    const op = this.log[this.cursor];
    this.cursor += 1;
    return op;
  }

  clear(): void {
    this.log = [];
    this.cursor = 0;
  }
}

/* ------------------------------------------------------------------ */
/* serialization                                                       */
/* ------------------------------------------------------------------ */

const OP_TYPES = new Set(["rect", "arrow", "pen", "text", "pixelate"]);

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function parseRect(value: unknown): Rect | null {
  if (!value || typeof value !== "object") return null;
  const rect = value as Record<string, unknown>;
  if (!isFiniteNumber(rect.x) || !isFiniteNumber(rect.y) || !isFiniteNumber(rect.width) || !isFiniteNumber(rect.height)) {
    return null;
  }
  return {x: rect.x, y: rect.y, width: rect.width, height: rect.height};
}

function parseOp(value: unknown): AnnotateOp | null {
  if (!value || typeof value !== "object") return null;
  const op = value as Record<string, unknown>;
  if (typeof op.id !== "string" || typeof op.type !== "string" || !OP_TYPES.has(op.type)) return null;
  if (op.type === "pixelate") {
    const rect = parseRect(op.rect);
    if (!rect || !isFiniteNumber(op.blockSize) || op.blockSize < 1) return null;
    return {id: op.id, type: "pixelate", rect, blockSize: op.blockSize};
  }
  if (typeof op.color !== "string" || !isFiniteNumber(op.strokeWidth) || op.strokeWidth <= 0) return null;
  const base = {id: op.id, color: op.color, strokeWidth: op.strokeWidth};
  switch (op.type) {
    case "rect": {
      const rect = parseRect(op.rect);
      return rect ? {type: "rect", rect, ...base} : null;
    }
    case "arrow":
      return isFiniteNumber(op.x1) && isFiniteNumber(op.y1) && isFiniteNumber(op.x2) && isFiniteNumber(op.y2)
        ? {type: "arrow", x1: op.x1, y1: op.y1, x2: op.x2, y2: op.y2, ...base}
        : null;
    case "pen": {
      if (!Array.isArray(op.points)) return null;
      const points: Array<[number, number]> = [];
      for (const point of op.points) {
        if (Array.isArray(point) && isFiniteNumber(point[0]) && isFiniteNumber(point[1])) {
          points.push([point[0], point[1]]);
        }
      }
      return points.length >= 2 ? {type: "pen", points, ...base} : null;
    }
    case "text":
      return typeof op.text === "string" && isFiniteNumber(op.x) && isFiniteNumber(op.y) && isFiniteNumber(op.fontSize)
        ? {type: "text", x: op.x, y: op.y, text: op.text, fontSize: op.fontSize, ...base}
        : null;
    default:
      return null;
  }
}

/**
 * Validate an untrusted annotation payload (thread GET returns stored JSON).
 * Anything malformed is dropped; a document that cannot be salvaged yields
 * `null` (the attachment still shows as an image — it just has no editable
 * overlay).
 */
export function parseAnnotation(value: unknown): AnnotationDocument | null {
  if (!value || typeof value !== "object") return null;
  const doc = value as Record<string, unknown>;
  if (doc.version !== ANNOTATION_VERSION) return null;
  const crop = parseRect(doc.crop);
  if (!crop || !Array.isArray(doc.ops)) return null;
  const ops: AnnotateOp[] = [];
  for (const entry of doc.ops.slice(0, MAX_OPS)) {
    const op = parseOp(entry);
    if (op) ops.push(op);
  }
  return {version: 1, crop, ops};
}

/** Plain-JSON clone safe to hand to `JSON.stringify` / the network. */
export function serializeAnnotation(doc: AnnotationDocument): AnnotationDocument {
  return JSON.parse(JSON.stringify(doc)) as AnnotationDocument;
}

/* ------------------------------------------------------------------ */
/* rendering                                                           */
/* ------------------------------------------------------------------ */

export interface RenderAnnotationOptions {
  base: CanvasImageSource;
  baseWidth: number;
  baseHeight: number;
  ops: readonly AnnotateOp[];
  /** Device pixel ratio the target canvas is scaled by (ctx.scale applied here). */
  dpr?: number;
}

/** Replay `ops` over `base` onto `ctx`. Deterministic; safe to call per frame. */
export function renderAnnotation(ctx: CanvasRenderingContext2D, options: RenderAnnotationOptions): void {
  const dpr = options.dpr ?? 1;
  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.drawImage(options.base, 0, 0, options.baseWidth, options.baseHeight);
  for (const op of options.ops) {
    drawOp(ctx, op, options.baseWidth, options.baseHeight, dpr);
  }
  ctx.restore();
}

function drawOp(ctx: CanvasRenderingContext2D, op: AnnotateOp, baseWidth: number, baseHeight: number, dpr: number): void {
  switch (op.type) {
    case "rect": {
      ctx.strokeStyle = op.color;
      ctx.lineWidth = op.strokeWidth;
      ctx.strokeRect(op.rect.x, op.rect.y, op.rect.width, op.rect.height);
      return;
    }
    case "arrow": {
      ctx.strokeStyle = op.color;
      ctx.fillStyle = op.color;
      ctx.lineWidth = op.strokeWidth;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(op.x1, op.y1);
      ctx.lineTo(op.x2, op.y2);
      ctx.stroke();
      const angle = Math.atan2(op.y2 - op.y1, op.x2 - op.x1);
      const head = Math.max(10, op.strokeWidth * 3);
      const spread = Math.PI / 7;
      ctx.beginPath();
      ctx.moveTo(op.x2, op.y2);
      ctx.lineTo(op.x2 - head * Math.cos(angle - spread), op.y2 - head * Math.sin(angle - spread));
      ctx.lineTo(op.x2 - head * Math.cos(angle + spread), op.y2 - head * Math.sin(angle + spread));
      ctx.closePath();
      ctx.fill();
      return;
    }
    case "pen": {
      if (op.points.length < 2) return;
      ctx.strokeStyle = op.color;
      ctx.lineWidth = op.strokeWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(op.points[0][0], op.points[0][1]);
      for (const [x, y] of op.points.slice(1)) ctx.lineTo(x, y);
      ctx.stroke();
      return;
    }
    case "text": {
      ctx.fillStyle = op.color;
      ctx.font = `${op.fontSize}px system-ui, sans-serif`;
      ctx.textBaseline = "top";
      ctx.fillText(op.text, op.x, op.y);
      return;
    }
    case "pixelate": {
      // The context is dpr-scaled: destination coords are CSS px, but the
      // source bitmap (ctx.canvas) is device px — scale the read region.
      const x = Math.max(0, Math.floor(op.rect.x));
      const y = Math.max(0, Math.floor(op.rect.y));
      const width = Math.min(Math.ceil(op.rect.width), baseWidth - x);
      const height = Math.min(Math.ceil(op.rect.height), baseHeight - y);
      if (width < 1 || height < 1) return;
      const block = Math.max(2, op.blockSize);
      const sx = Math.floor(x * dpr);
      const sy = Math.floor(y * dpr);
      const sw = Math.max(1, Math.floor(width * dpr));
      const sh = Math.max(1, Math.floor(height * dpr));
      const small = document.createElement("canvas");
      small.width = Math.max(1, Math.floor(sw / block));
      small.height = Math.max(1, Math.floor(sh / block));
      const smallCtx = small.getContext("2d");
      if (!smallCtx) return;
      smallCtx.drawImage(ctx.canvas, sx, sy, sw, sh, 0, 0, small.width, small.height);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(small, 0, 0, small.width, small.height, x, y, width, height);
      ctx.imageSmoothingEnabled = true;
      return;
    }
  }
}
