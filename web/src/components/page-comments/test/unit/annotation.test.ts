import {assert} from "@open-wc/testing";

import {
  AnnotationHistory,
  applyHandleDrag,
  clampRect,
  enforceMinSize,
  hitTestHandle,
  moveRect,
  normalizeRect,
  padRect,
  parseAnnotation,
  renderAnnotation,
  scaleRect,
  serializeAnnotation,
  type AnnotateOp,
  type Rect,
} from "../../annotation.js";

const rect = (x: number, y: number, width: number, height: number): Rect => ({x, y, width, height});

const rectOp = (id: string): AnnotateOp => ({id, type: "rect", color: "#ff0000", strokeWidth: 2, rect: rect(1, 2, 3, 4)});

describe("crop math", () => {
  it("normalizes drag corners into a positive rect", () => {
    assert.deepEqual(normalizeRect(10, 10, 2, 4), rect(2, 4, 8, 6));
    assert.deepEqual(normalizeRect(0, 0, 5, 5), rect(0, 0, 5, 5));
  });

  it("clamps rects inside bounds without growing them", () => {
    assert.deepEqual(clampRect(rect(-5, -5, 10, 10), {width: 100, height: 100}), rect(0, 0, 10, 10));
    assert.deepEqual(clampRect(rect(95, 95, 10, 10), {width: 100, height: 100}), rect(90, 90, 10, 10));
    // Oversized rects shrink to the bounds.
    assert.deepEqual(clampRect(rect(0, 0, 200, 200), {width: 100, height: 80}), rect(0, 0, 100, 80));
  });

  it("pads an anchor rect and clamps to the capture", () => {
    const bounds = {width: 100, height: 100};
    assert.deepEqual(padRect(rect(40, 40, 20, 20), 10, bounds), rect(30, 30, 40, 40));
    // Near the edge the padded rect is clamped against the border.
    assert.deepEqual(padRect(rect(0, 0, 10, 10), 24, bounds), rect(0, 0, 58, 58));
  });

  it("moves rects but pins them to the bounds", () => {
    assert.deepEqual(moveRect(rect(10, 10, 5, 5), 5, -3, {width: 100, height: 100}), rect(15, 7, 5, 5));
    assert.deepEqual(moveRect(rect(10, 10, 5, 5), -50, 0, {width: 100, height: 100}), rect(0, 10, 5, 5));
  });

  it("enforces a minimum crop size", () => {
    assert.deepEqual(enforceMinSize(rect(0, 0, 2, 1)), rect(0, 0, 16, 16));
  });

  it("scales rects (display <-> capture coordinates)", () => {
    assert.deepEqual(scaleRect(rect(10, 20, 30, 40), 0.5), rect(5, 10, 15, 20));
  });

  it("hit-tests the eight handles", () => {
    const r = rect(0, 0, 100, 100);
    assert.equal(hitTestHandle(r, 0, 0), "nw");
    assert.equal(hitTestHandle(r, 100, 100), "se");
    assert.equal(hitTestHandle(r, 50, 0), "n");
    assert.equal(hitTestHandle(r, 100, 50), "e");
    assert.equal(hitTestHandle(r, 50, 50), null);
    assert.equal(hitTestHandle(r, 200, 200), null);
  });

  it("drags corner handles without inverting past the minimum", () => {
    const bounds = {width: 200, height: 200};
    const r = rect(50, 50, 100, 100);
    // Pull the north-west corner past the south-east corner: pins at min size.
    const dragged = applyHandleDrag(r, "nw", 200, 200, bounds, 16);
    assert.equal(dragged.width, 16);
    assert.equal(dragged.height, 16);
    // West edge only moves x.
    const west = applyHandleDrag(r, "w", -20, 999, bounds);
    assert.deepEqual(west, rect(30, 50, 120, 100));
    // Drags never leave the bounds.
    const east = applyHandleDrag(r, "e", 500, 0, bounds);
    assert.equal(east.x + east.width, 200);
  });
});

describe("annotation history", () => {
  it("pushes, undoes and redoes whole ops", () => {
    const history = new AnnotationHistory();
    history.push(rectOp("a"));
    history.push(rectOp("b"));
    assert.equal(history.ops.length, 2);
    assert.deepEqual(history.undo()?.id, "b");
    assert.equal(history.ops.length, 1);
    assert.deepEqual(history.redo()?.id, "b");
    assert.equal(history.ops.length, 2);
  });

  it("drops the redo tail when a new op lands", () => {
    const history = new AnnotationHistory();
    history.push(rectOp("a"));
    history.push(rectOp("b"));
    history.undo();
    history.push(rectOp("c"));
    assert.equal(history.ops.length, 2);
    assert.equal(history.canRedo, false);
    assert.deepEqual(history.ops[1].id, "c");
  });

  it("reports boundaries", () => {
    const history = new AnnotationHistory([rectOp("a")]);
    assert.equal(history.canUndo, true);
    assert.equal(history.canRedo, false);
    history.undo();
    assert.equal(history.canUndo, false);
    assert.equal(history.undo(), null);
    assert.deepEqual(history.ops, []);
  });

  it("clears everything", () => {
    const history = new AnnotationHistory([rectOp("a")]);
    history.clear();
    assert.equal(history.ops.length, 0);
    assert.equal(history.canUndo, false);
  });
});

describe("annotation serialization", () => {
  const doc = {
    version: 1 as const,
    crop: rect(10, 10, 80, 60),
    ops: [
      {id: "1", type: "rect", color: "#000", strokeWidth: 2, rect: rect(0, 0, 5, 5)},
      {id: "2", type: "arrow", color: "#000", strokeWidth: 4, x1: 0, y1: 0, x2: 10, y2: 10},
      {id: "3", type: "pen", color: "#000", strokeWidth: 3, points: [[0, 0], [5, 5], [6, 7]]},
      {id: "4", type: "text", color: "#000", strokeWidth: 2, x: 1, y: 1, text: "hi", fontSize: 14},
      {id: "5", type: "pixelate", rect: rect(2, 2, 20, 20), blockSize: 12},
    ] as AnnotateOp[],
  };

  it("round-trips a document losslessly", () => {
    const parsed = parseAnnotation(JSON.parse(JSON.stringify(serializeAnnotation(doc))));
    assert.deepEqual(parsed, doc);
  });

  it("rejects wrong versions and malformed crops", () => {
    assert.equal(parseAnnotation({...doc, version: 2}), null);
    assert.equal(parseAnnotation({...doc, crop: {x: 0}}), null);
    assert.equal(parseAnnotation(null), null);
    assert.equal(parseAnnotation("nope"), null);
  });

  it("drops unknown or malformed ops but keeps the rest", () => {
    const dirty = {
      version: 1,
      crop: doc.crop,
      ops: [
        ...doc.ops,
        {id: "x", type: "spray", color: "#000", strokeWidth: 1},
        {id: "y", type: "rect", color: "#000", strokeWidth: -1, rect: rect(0, 0, 1, 1)},
        "garbage",
      ],
    };
    const parsed = parseAnnotation(dirty);
    assert.equal(parsed?.ops.length, doc.ops.length);
  });

  it("rejects pen ops with fewer than two points", () => {
    const parsed = parseAnnotation({
      version: 1,
      crop: doc.crop,
      ops: [{id: "p", type: "pen", color: "#000", strokeWidth: 2, points: [[1, 1]]}],
    });
    assert.equal(parsed?.ops.length, 0);
  });
});

describe("renderAnnotation", () => {
  it("replays every op type onto a canvas without throwing", () => {
    const canvas = document.createElement("canvas");
    canvas.width = 40;
    canvas.height = 40;
    const ctx = canvas.getContext("2d")!;
    const ops: AnnotateOp[] = [
      {id: "1", type: "rect", color: "#f00", strokeWidth: 2, rect: rect(1, 1, 10, 10)},
      {id: "2", type: "arrow", color: "#0f0", strokeWidth: 4, x1: 2, y1: 2, x2: 20, y2: 20},
      {id: "3", type: "pen", color: "#00f", strokeWidth: 2, points: [[0, 0], [10, 10], [20, 5]]},
      {id: "4", type: "text", color: "#000", strokeWidth: 2, x: 4, y: 4, text: "note", fontSize: 10},
      {id: "5", type: "pixelate", rect: rect(0, 0, 8, 8), blockSize: 4},
    ];
    renderAnnotation(ctx, {base: canvas, baseWidth: 40, baseHeight: 40, ops, dpr: 2});
    // Something actually drew (corner pixel painted by the rect stroke).
    assert.notDeepEqual(Array.from(ctx.getImageData(1, 1, 1, 1).data), [0, 0, 0, 0]);
  });

  it("leaves the transform clean after rendering", () => {
    const canvas = document.createElement("canvas");
    canvas.width = 10;
    canvas.height = 10;
    const ctx = canvas.getContext("2d")!;
    renderAnnotation(ctx, {base: canvas, baseWidth: 10, baseHeight: 10, ops: [], dpr: 3});
    const m = ctx.getTransform();
    assert.deepEqual([m.a, m.b, m.c, m.d, m.e, m.f], [1, 0, 0, 1, 0, 0]);
  });
});
