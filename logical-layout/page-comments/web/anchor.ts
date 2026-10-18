/**
 * Anchor engine for `<noizu-page-comments>` — pure DOM + string logic, no Lit,
 * no network. A thread is pinned to a W3C Web Annotation-style anchor:
 *
 *   { css, xpath, textQuote: {prefix, exact, suffix}, fingerprint }
 *
 * `resolve(anchor, root)` re-finds the target after the page shifts under it:
 * css → xpath → text-quote search, each hit validated against the fingerprint.
 * A mismatch downgrades the confidence instead of rejecting, so a class
 * reshuffle or a small text edit still lands. Every strategy misses ⇒ `null`
 * — the thread is an orphan and the rail lists it separately. `pageKey` and
 * `watchPageChanges` give the SPA story; the element listens and reloads
 * threads per page.
 */

export type AnchorConfidence = "high" | "medium" | "low";

export interface TextQuoteSelector {
  prefix: string;
  exact: string;
  suffix: string;
}

export interface AnchorFingerprint {
  tag: string;
  /** djb2 hex of the element's normalized text at anchor time. */
  textHash: string;
  /** 0-based index among same-tag previous siblings. */
  relPos: number;
}

export interface PageAnchor {
  css: string;
  xpath: string;
  textQuote: TextQuoteSelector;
  fingerprint: AnchorFingerprint;
  /**
   * What the user picked. `"element"` (also the default for legacy anchors
   * that omit the field) anchors a whole element; `"range"` anchors a text
   * selection. Range anchors resolve quote-first — css/xpath are skipped —
   * and surface the live `Range` so per-line highlighting and the precise
   * quote survive reloads. A quote miss orphans the thread instead of
   * silently widening to the containing element.
   */
  target?: "element" | "range";
}

export interface ResolvedAnchor {
  /** Element anchors resolve to an element; range anchors to a Range. */
  target: Element | Range;
  confidence: AnchorConfidence;
}

const QUOTE_CONTEXT = 32;
const ELEMENT_EXACT_CHARS = 64;

/* ------------------------------------------------------------------ */
/* hashing + text helpers                                              */
/* ------------------------------------------------------------------ */

/** Deterministic djb2 hex hash of whitespace-normalized text — stable across sessions, not cryptographic. */
export function hashText(text: string): string {
  const normalized = normalizeText(text);
  let hash = 5381;
  for (let i = 0; i < normalized.length; i++) {
    hash = ((hash << 5) + hash + normalized.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(16);
}

/** Collapse whitespace runs and trim so reflow never breaks a quote match. */
export function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Search form: normalizeText + lowercase. */
function searchForm(text: string): string {
  return normalizeText(text).toLowerCase();
}

/* ------------------------------------------------------------------ */
/* page key                                                            */
/* ------------------------------------------------------------------ */

export type PageKeyStrategy = "strip-query-hash" | "full";

/**
 * Default `strip-query-hash`: origin + pathname — pagination params, campaign
 * tags and `#fragments` do not fork the thread list. `full` keeps everything.
 */
export function pageKey(url: string, strategy: PageKeyStrategy = "strip-query-hash"): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  if (strategy === "full") return parsed.href;
  const path = parsed.pathname.replace(/\/+$/, "");
  return parsed.origin + (path || "/");
}

/* ------------------------------------------------------------------ */
/* selector building                                                   */
/* ------------------------------------------------------------------ */

/** Classes that look framework-generated (css-*, jsx-*, sc-*, …) are skipped. */
const UNSTABLE_CLASS = /^(?:css-|jsx-|sc-|ember-|is-|has-|ng-|chr-|_|[\d-])/;

function usableClass(cls: string): boolean {
  return /^[A-Za-z][\w-]*$/.test(cls) && !UNSTABLE_CLASS.test(cls);
}

function stableHook(el: Element): {name: string; value: string} | null {
  if (el.id) return null; // ids take the simple `#id` route instead
  const attr = Array.from(el.attributes).find(
    (a) => a.name.startsWith("data-") && a.name !== "data-pc-owned",
  );
  return attr ? {name: attr.name, value: attr.value} : null;
}

function simpleSelector(el: Element): string {
  if (el.id) return `#${CSS.escape(el.id)}`;
  const hook = stableHook(el);
  if (hook) return `[${hook.name}="${CSS.escape(hook.value)}"]`;
  const classes = Array.from(el.classList).filter(usableClass);
  if (classes.length) {
    return `${el.localName.toLowerCase()}.${classes.map((c) => CSS.escape(c)).join(".")}`;
  }
  return nthOfTypeSelector(el);
}

function nthOfTypeSelector(el: Element): string {
  const tag = el.localName.toLowerCase();
  let index = 1;
  let sibling: Element | null = el.previousElementSibling;
  while (sibling) {
    if (sibling.localName.toLowerCase() === tag) index++;
    sibling = sibling.previousElementSibling;
  }
  return `${tag}:nth-of-type(${index})`;
}

/**
 * css path, most-stable-first: `#id` / `[data-*]` hooks stop the walk early;
 * usable classes carry middle segments; generated classes fall through to a
 * `:nth-of-type` chain rooted at `root` (default document).
 */
export function buildCssSelector(el: Element, root: ParentNode = document): string {
  const stop = root instanceof Element ? root : null;
  const parts: string[] = [];
  let node: Element | null = el;
  while (node && node !== stop) {
    parts.unshift(simpleSelector(node));
    if (node.id || (parts.length === 1 && stableHook(node))) break;
    node = node.parentElement;
  }
  return parts.join(" > ");
}

/** Positional XPath like `/html[1]/body[1]/main[1]/article[2]`. */
export function buildXpath(el: Element, stopAt?: Element): string {
  const segments: string[] = [];
  let node: Element | null = el;
  while (node && node !== stopAt && node.localName.toLowerCase() !== "html") {
    const tag = node.localName.toLowerCase();
    let index = 1;
    let sibling: Element | null = node.previousElementSibling;
    while (sibling) {
      if (sibling.localName.toLowerCase() === tag) index++;
      sibling = sibling.previousElementSibling;
    }
    segments.unshift(`${tag}[${index}]`);
    node = node.parentElement;
  }
  return "/" + ["html[1]", ...segments].join("/");
}

/* ------------------------------------------------------------------ */
/* anchor building                                                     */
/* ------------------------------------------------------------------ */

function sameTagIndex(el: Element): number {
  const tag = el.localName.toLowerCase();
  let index = 0;
  let sibling: Element | null = el.previousElementSibling;
  while (sibling) {
    if (sibling.localName.toLowerCase() === tag) index++;
    sibling = sibling.previousElementSibling;
  }
  return index;
}

function fingerprintOf(el: Element): AnchorFingerprint {
  return {
    tag: el.localName.toLowerCase(),
    textHash: hashText(normalizeText(el.textContent ?? "")),
    relPos: sameTagIndex(el),
  };
}

/** Document text immediately before `el` (last `chars` chars, normalized). */
function textBefore(el: Element, chars: number): string {
  const walker = document.createTreeWalker(document, NodeFilter.SHOW_TEXT);
  let flat = "";
  let current: Node | null = walker.nextNode();
  while (current) {
    if (current === el) break;
    flat += current.textContent ?? "";
    current = walker.nextNode();
  }
  return normalizeText(flat).slice(-chars);
}

/** Element anchor: textQuote.exact is the first ~64 chars of its own text. */
export function anchorFromElement(el: Element, root: ParentNode = document): PageAnchor {
  const text = normalizeText(el.textContent ?? "");
  const exact = text.slice(0, ELEMENT_EXACT_CHARS);
  const suffix = normalizeText(text.slice(ELEMENT_EXACT_CHARS, ELEMENT_EXACT_CHARS + QUOTE_CONTEXT));
  return {
    css: buildCssSelector(el, root),
    xpath: buildXpath(el, root instanceof Element ? root : undefined),
    textQuote: {prefix: textBefore(el, QUOTE_CONTEXT), exact, suffix},
    fingerprint: fingerprintOf(el),
  };
}

/** Range anchor: quote spans the selection; context read from surrounding text. */
export function anchorFromRange(range: Range, root: ParentNode = document): PageAnchor {
  const container = range.commonAncestorContainer;
  const element = container instanceof Element ? container : container.parentElement;
  const host = element ?? (root instanceof Element ? root : document.body);
  return {
    css: element ? buildCssSelector(element, root) : "",
    xpath: element ? buildXpath(element, root instanceof Element ? root : undefined) : "",
    textQuote: flatQuote(range, root),
    fingerprint: fingerprintOf(host),
    target: "range",
  };
}

/** Raw-offset → normalized-index inside a segment (count of rawAt < raw). */
function normIndexOf(segment: TextSegment, raw: number): number {
  const at = segment.rawAt.findIndex((offset) => offset >= raw);
  return at === -1 ? segment.rawAt.length : at;
}

/** Raw (original-case) text for a [start, end) span of the flat text. */
function rawSlice(segments: TextSegment[], start: number, end: number): string {
  let out = "";
  for (const segment of segments) {
    const segEnd = segment.normStart + segment.rawAt.length;
    if (segEnd <= start) continue;
    if (segment.normStart >= end) break;
    const from = Math.max(0, start - segment.normStart);
    const to = Math.min(segment.rawAt.length, end - segment.normStart);
    const rawFrom = segment.rawAt[from];
    const rawTo = to < segment.rawAt.length ? segment.rawAt[to] : undefined;
    const piece = rawTo === undefined ? segment.raw.slice(rawFrom) : segment.raw.slice(rawFrom, rawTo);
    if (out && piece && !/\s$/.test(out)) out += " "; // segments join like the flat text does
    out += piece;
  }
  return out.trim();
}

/**
 * exact/prefix/suffix read from the whitespace-collapsed flat document text
 * (the same model `resolveQuote` searches), so a selection crossing element
 * or block boundaries stores a quote that round-trips — `Range.toString()`
 * mashes words at boundaries ("with<br>selecting" → "withselecting"), which
 * would never match the normalized page text again. Returns empty strings
 * when the range cannot be located (e.g. detached nodes).
 */
function flatQuote(range: Range, root: ParentNode): TextQuoteSelector {
  const {segments} = collectSegments(root);
  let start = -1;
  let end = -1;
  for (const segment of segments) {
    if (!range.intersectsNode(segment.node)) continue;
    if (start === -1) {
      start = segment.normStart + (segment.node === range.startContainer ? normIndexOf(segment, range.startOffset) : 0);
    }
    end = segment.normStart + (segment.node === range.endContainer ? normIndexOf(segment, range.endOffset) : segment.rawAt.length);
  }
  if (start === -1 || end <= start) return {prefix: "", exact: "", suffix: ""};
  return {
    prefix: rawSlice(segments, Math.max(0, start - QUOTE_CONTEXT), start),
    exact: rawSlice(segments, start, end),
    suffix: rawSlice(segments, end, end + QUOTE_CONTEXT),
  };
}

/* ------------------------------------------------------------------ */
/* resolution                                                          */
/* ------------------------------------------------------------------ */

interface Candidate {
  target: Element | Range;
  confidence: AnchorConfidence;
  /** Tag + text hash matched — a strong identity signal used to break ties. */
  hashExact: boolean;
}

const RANK: Record<AnchorConfidence, number> = {high: 3, medium: 2, low: 1};

function better(current: Candidate | null, next: Candidate): Candidate {
  if (!current) return next;
  const currentRank = RANK[current.confidence] + (current.hashExact ? 0.5 : 0);
  const nextRank = RANK[next.confidence] + (next.hashExact ? 0.5 : 0);
  return nextRank > currentRank ? next : current;
}

/**
 * Re-find an anchor. Order: css → xpath → text quote. Each hit is validated
 * against the fingerprint; a mismatch downgrades (element still found but the
 * page moved on) rather than rejecting, and the next strategy may still
 * rescue a higher-confidence hit.
 */
export function resolve(anchor: PageAnchor, root: ParentNode = document): ResolvedAnchor | null {
  const scope = root as Document | Element;
  let best: Candidate | null = null;

  // Range anchors target the quote, not the container: the css/xpath path
  // only ever knows the common ancestor, and letting it win (it ties with
  // the quote hit and is evaluated first) would redraw a text selection as
  // one big element rectangle after a reload. Quote strategies only — a
  // miss means orphan.
  if (anchor.target === "range") {
    const quoteHit = resolveQuote(anchor.textQuote, scope);
    if (!quoteHit) return null;
    const start = quoteHit.startContainer;
    const host = start instanceof Element ? start : start.parentElement;
    let confidence: AnchorConfidence = "low";
    if (host) {
      const fp = scoreFingerprint(host, anchor.fingerprint);
      confidence = fp.tagMatch && fp.exact && fp.pos ? "high"
        : fp.tagMatch && (fp.exact || fp.pos) ? "medium"
        : "low";
    }
    return {target: quoteHit, confidence};
  }

  if (anchor.css) {
    try {
      const hit = scope.querySelector(anchor.css);
      if (hit) best = better(best, scoreElement(hit, anchor.fingerprint));
    } catch {
      /* selector invalid in this browser — fall through */
    }
  }

  if (anchor.xpath) {
    const hit = resolveXpath(anchor.xpath);
    if (hit) best = better(best, scoreElement(hit, anchor.fingerprint));
  }

  const quoteHit = resolveQuote(anchor.textQuote, scope);
  if (quoteHit) {
    const start = quoteHit.startContainer;
    const host = start instanceof Element ? start : start.parentElement;
    if (host) {
      const fp = scoreFingerprint(host, anchor.fingerprint);
      const confidence: AnchorConfidence = fp.tagMatch && fp.exact && fp.pos ? "high"
        : fp.tagMatch && (fp.exact || fp.pos) ? "medium"
        : "low";
      // Element anchors stay element anchors: when the quote's containing
      // element matches the fingerprint, hand back the element (the rail and
      // overlay both work in elements); only a fingerprint-less quote hit
      // surfaces the raw Range.
      best = better(best, {target: fp.tagMatch ? host : quoteHit, confidence, hashExact: fp.exact});
    }
  }

  return best ? {target: best.target, confidence: best.confidence} : null;
}

function scoreElement(el: Element, fingerprint: AnchorFingerprint): Candidate {
  const fp = scoreFingerprint(el, fingerprint);
  let confidence: AnchorConfidence = "low";
  if (fp.tagMatch && fp.exact && fp.pos) confidence = "high";
  else if (fp.tagMatch && (fp.exact || fp.pos)) confidence = "medium";
  return {target: el, confidence, hashExact: fp.exact};
}

interface FingerprintScore {
  tagMatch: boolean;
  exact: boolean;
  pos: boolean;
}

function scoreFingerprint(el: Element, fingerprint: AnchorFingerprint): FingerprintScore {
  const tagMatch = el.localName.toLowerCase() === fingerprint.tag.toLowerCase();
  const hash = hashText(normalizeText(el.textContent ?? ""));
  return {
    tagMatch,
    exact: tagMatch && hash === fingerprint.textHash,
    pos: tagMatch && sameTagIndex(el) === fingerprint.relPos,
  };
}

function resolveXpath(xpath: string): Element | null {
  try {
    const hit = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
    return hit.singleNodeValue instanceof Element ? hit.singleNodeValue : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* text-quote search                                                   */
/* ------------------------------------------------------------------ */

interface TextSegment {
  node: Text;
  raw: string;
  /** normalized-search-form index where this segment starts in the flat text */
  normStart: number;
  /** per-normalized-char raw offset inside `raw` */
  rawAt: number[];
}

interface FlatText {
  flat: string;
  segments: TextSegment[];
}

function collectSegments(root: ParentNode): FlatText {
  const scope = root instanceof Element ? root : document.body;
  const segments: TextSegment[] = [];
  const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
  let flat = "";
  let current: Node | null = walker.nextNode();
  while (current) {
    const raw = current.textContent ?? "";
    if (raw.trim()) {
      const rawAt: number[] = [];
      let norm = "";
      let lastWasSpace = !norm; // leading whitespace collapses away
      for (let i = 0; i < raw.length; i++) {
        const ch = raw[i];
        if (/\s/.test(ch)) {
          if (lastWasSpace) continue;
          norm += " ";
          rawAt.push(i);
          lastWasSpace = true;
        } else {
          norm += ch.toLowerCase();
          rawAt.push(i);
          lastWasSpace = false;
        }
      }
      while (norm.endsWith(" ")) {
        norm = norm.slice(0, -1);
        rawAt.pop();
      }
      if (norm) {
        if (flat && !flat.endsWith(" ")) flat += " ";
        segments.push({node: current as Text, raw, normStart: flat.length, rawAt});
        flat += norm;
      }
    }
    current = walker.nextNode();
  }
  return {flat, segments};
}

interface AttemptSegment {
  text: string;
  /** Prefix/suffix context locates the quote but is excluded from the range. */
  context: boolean;
}

/**
 * Quote search over the whitespace-collapsed flat text of `root`: full
 * `prefix + exact + suffix` first, then exact alone, then a head/tail split
 * that survives a small edit inside the quote. The returned Range covers
 * only the quote — context segments disambiguate but never widen it.
 * Returns a Range over the live text nodes, or null.
 */
export function resolveQuote(quote: TextQuoteSelector, root: ParentNode = document): Range | null {
  if (!normalizeText(quote.exact)) return null;
  const {flat, segments} = collectSegments(root);
  if (!segments.length) return null;

  const prefix = searchForm(quote.prefix);
  const suffix = searchForm(quote.suffix);
  const exact = searchForm(quote.exact);

  const attempts: AttemptSegment[][] = [];
  if (prefix) attempts.push([{text: prefix, context: true}, {text: exact, context: false}]);
  attempts.push([{text: exact, context: false}]);
  if (suffix) attempts.push([{text: exact, context: false}, {text: suffix, context: true}]);
  if (prefix && suffix) {
    attempts.push([{text: prefix, context: true}, {text: exact, context: false}, {text: suffix, context: true}]);
  }
  if (exact.length > 24) {
    const half = Math.floor(exact.length / 2);
    const head = exact.slice(0, half - 4);
    const tail = exact.slice(half + 4);
    attempts.push([{text: head, context: false}, {text: tail, context: false}]);
    if (prefix) attempts.push([{text: prefix, context: true}, {text: head, context: false}]);
    if (suffix) attempts.push([{text: tail, context: false}, {text: suffix, context: true}]);
  }

  for (const attempt of attempts) {
    const at = findParts(flat, attempt);
    if (at) return rangeForSpan(segments, at.quoteStart, at.quoteEnd);
  }
  return null;
}

/**
 * Find each part in order (whitespace runs may drift between parts); the
 * quote span covers only the non-context parts, so a prefix match that
 * starts earlier than the quote never leaks into the returned Range.
 */
function findParts(flat: string, parts: AttemptSegment[]): {quoteStart: number; quoteEnd: number} | null {
  let cursor = 0;
  let quoteStart = -1;
  let quoteEnd = -1;
  for (const part of parts) {
    const at = flat.indexOf(part.text, cursor);
    if (at === -1) return null;
    if (part.context) {
      cursor = at + part.text.length;
      continue;
    }
    if (quoteStart === -1) quoteStart = at;
    quoteEnd = at + part.text.length;
    cursor = quoteEnd;
  }
  return quoteStart === -1 ? null : {quoteStart, quoteEnd};
}

/** Map a [start, end) span of the flat normalized text onto live text nodes. */
function rangeForSpan(segments: TextSegment[], start: number, end: number): Range | null {
  const range = document.createRange();
  let startSet = false;
  for (const segment of segments) {
    const segEnd = segment.normStart + segment.rawAt.length;
    if (!startSet && end <= segment.normStart) break;
    if (!startSet && start < segEnd) {
      const local = Math.max(0, start - segment.normStart);
      range.setStart(segment.node, segment.rawAt[local] ?? segment.raw.length);
      startSet = true;
    }
    if (startSet && end <= segEnd) {
      const local = Math.max(0, end - segment.normStart);
      range.setEnd(segment.node, Math.min(segment.raw.length, segment.rawAt[local] ?? segment.raw.length));
      return range.collapsed ? null : range;
    }
  }
  if (!startSet) return null;
  const last = segments[segments.length - 1];
  range.setEnd(last.node, last.raw.length);
  return range.collapsed ? null : range;
}

/* ------------------------------------------------------------------ */
/* SPA page tracking                                                   */
/* ------------------------------------------------------------------ */

export interface PageChangeWatcher {
  dispose(): void;
}

/**
 * Patch history.pushState/replaceState and listen for popstate; every URL
 * change calls back with the current href. The element turns this into a
 * `page-change` event and reloads threads for the new pageKey.
 *
 * Concurrent instances onion-wrap each other; when one disposes out of
 * order it can stay buried in the chain, so each wrapper checks a
 * `disposed` flag before calling back — the flag, not method identity, is
 * what silences a dead watcher.
 */
export function watchPageChanges(onChange: (href: string) => void): PageChangeWatcher {
  let disposed = false;
  const originalPush = history.pushState;
  const originalReplace = history.replaceState;
  const wrappedPush: typeof history.pushState = function pushState(this: History, data, unused, url) {
    const result = originalPush.call(this, data, unused, url);
    if (!disposed) onChange(location.href);
    return result;
  };
  const wrappedReplace: typeof history.replaceState = function replaceState(this: History, data, unused, url) {
    const result = originalReplace.call(this, data, unused, url);
    if (!disposed) onChange(location.href);
    return result;
  };
  history.pushState = wrappedPush;
  history.replaceState = wrappedReplace;
  const onPop = () => {
    if (!disposed) onChange(location.href);
  };
  window.addEventListener("popstate", onPop);
  return {
    dispose(): void {
      disposed = true;
      window.removeEventListener("popstate", onPop);
      if (history.pushState === wrappedPush) history.pushState = originalPush;
      if (history.replaceState === wrappedReplace) history.replaceState = originalReplace;
    },
  };
}
