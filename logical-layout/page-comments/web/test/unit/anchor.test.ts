import {expect} from "@open-wc/testing";
import {
  anchorFromElement,
  anchorFromRange,
  buildCssSelector,
  buildXpath,
  hashText,
  normalizeText,
  pageKey,
  resolve,
  resolveQuote,
  watchPageChanges,
} from "../../anchor.js";

function mount(html: string): HTMLDivElement {
  const host = document.createElement("div");
  host.setAttribute("data-pc-test", "");
  host.innerHTML = html;
  document.body.append(host);
  return host;
}

describe("anchor", () => {
  let host: HTMLDivElement;

  beforeEach(() => {
    host = mount(`
      <h2 id="doc-title">Release notes</h2>
      <p class="para lead">Paragraph one is the seeded anchor target.</p>
      <p class="para">Paragraph two follows with filler text.</p>
      <section id="tail"><p>Final paragraph lives in a section.</p></section>
    `);
  });

  afterEach(() => {
    host.remove();
  });

  it("hashText is deterministic and whitespace-insensitive", () => {
    expect(hashText("hello world")).to.equal(hashText("hello world"));
    expect(hashText("hello   world")).to.equal(hashText("hello world"));
    expect(hashText("a")).to.not.equal(hashText("b"));
    expect(normalizeText("  a\n\t b ")).to.equal("a b");
  });

  it("buildCssSelector prefers ids and data hooks over class chains", () => {
    const title = host.querySelector("#doc-title")!;
    expect(buildCssSelector(title)).to.equal("#doc-title");
    const tail = host.querySelector("#tail p")!;
    expect(buildCssSelector(tail)).to.contain("#tail");
  });

  it("buildXpath is positional from the document root", () => {
    const lead = host.querySelector(".lead")!;
    expect(buildXpath(lead)).to.match(/^\/html\[1\]\/body\[1\]/);
  });

  it("element anchors round-trip at high confidence", () => {
    const target = host.querySelector(".lead")!;
    const anchor = anchorFromElement(target);
    const hit = resolve(anchor);
    expect(hit).to.not.be.null;
    expect(hit!.target).to.equal(target);
    expect(hit!.confidence).to.equal("high");
  });

  it("re-anchoring survives an inserted same-class sibling", () => {
    const target = host.querySelectorAll(".para")[1] as HTMLParagraphElement;
    const anchor = anchorFromElement(target);
    const inserted = document.createElement("p");
    inserted.className = "para";
    inserted.textContent = "A brand new sibling paragraph shifts positions.";
    target.before(inserted);
    const hit = resolve(anchor);
    expect(hit).to.not.be.null;
    expect(hit!.target).to.equal(target);
    inserted.remove();
  });

  it("re-anchoring survives class-order changes", () => {
    const target = host.querySelector(".lead")!;
    const anchor = anchorFromElement(target);
    target.className = "lead para"; // same set, different order
    const hit = resolve(anchor);
    expect(hit).to.not.be.null;
    expect(hit!.target).to.equal(target);
    expect(hit!.confidence).to.equal("high");
  });

  it("re-anchoring survives text edits within prefix/suffix tolerance", () => {
    const target = host.querySelector(".lead")!;
    const anchor = anchorFromElement(target);
    // Edit text NEAR the quote (the sibling below = suffix context), not the quote itself.
    (host.querySelectorAll(".para")[1] as HTMLParagraphElement).textContent = "Rewritten suffix neighbourhood text.";
    const hit = resolve(anchor);
    expect(hit).to.not.be.null;
    expect(hit!.target).to.equal(target);
  });

  it("a small edit inside an element still downgrades but resolves", () => {
    const target = host.querySelector(".lead")!;
    const anchor = anchorFromElement(target);
    target.textContent = "Paragraph one is the seeded anchor target (edited).";
    const hit = resolve(anchor);
    expect(hit).to.not.be.null;
    expect(hit!.target).to.equal(target);
    expect(hit!.confidence).to.equal("medium");
  });

  it("a deleted node resolves to null (orphan)", () => {
    const target = host.querySelector("#tail p")!;
    const anchor = anchorFromElement(target);
    target.remove();
    host.querySelector("#tail")!.remove();
    expect(resolve(anchor)).to.be.null;
  });

  it("range anchors resolve back to the live Range (quote-first)", () => {
    const target = host.querySelector(".lead")!;
    const range = document.createRange();
    range.selectNodeContents(target.firstChild!);
    const anchor = anchorFromRange(range);
    expect(anchor.target).to.equal("range");
    expect(anchor.textQuote.exact.toLowerCase()).to.contain("paragraph one");
    const hit = resolve(anchor);
    expect(hit).to.not.be.null;
    // A range anchor must come back as a Range covering the same words —
    // resolving to the containing element would redraw the highlight as one
    // big rectangle and lose the precise quote.
    expect(hit!.target).to.be.instanceOf(Range);
    expect((hit!.target as Range).toString().toLowerCase()).to.contain("paragraph one");
    expect(hit!.confidence).to.equal("high");
  });

  it("legacy anchors (no target field) still resolve to their element", () => {
    const target = host.querySelector(".lead")!;
    const anchor = anchorFromElement(target);
    delete (anchor as {target?: string}).target; // simulate a stored legacy anchor
    const hit = resolve(anchor);
    expect(hit).to.not.be.null;
    expect(hit!.target).to.equal(target);
  });

  it("resolveQuote finds text across sibling nodes", () => {
    const quote = {prefix: "", exact: "seeded anchor target", suffix: ""};
    const range = resolveQuote(quote, document);
    expect(range).to.not.be.null;
    expect(range!.toString().toLowerCase()).to.contain("seeded anchor target");
  });

  it("pageKey strips query and hash by default", () => {
    expect(pageKey("https://x.test/p/a?b=1#frag")).to.equal("https://x.test/p/a");
    expect(pageKey("https://x.test/p/a?b=1#frag", "full")).to.equal("https://x.test/p/a?b=1#frag");
  });

  it("watchPageChanges fires on pushState and disposes cleanly", () => {
    const seen: string[] = [];
    const watcher = watchPageChanges((href) => seen.push(href));
    history.pushState({}, "", "?pc-watch=1");
    expect(seen.length).to.equal(1);
    watcher.dispose();
    history.pushState({}, "", "?pc-watch=2");
    expect(seen.length).to.equal(1);
    history.replaceState({}, "", location.pathname);
  });

  it("concurrent watchers: inner disposed first never fires again", () => {
    const seenA: string[] = [];
    const seenB: string[] = [];
    const a = watchPageChanges((href) => seenA.push(href));
    const b = watchPageChanges((href) => seenB.push(href));
    history.pushState({}, "", "?pc-two=1");
    expect(seenA.length).to.equal(1);
    expect(seenB.length).to.equal(1);
    // A disposed while B still wraps it: A stays buried in the chain but
    // must never fire again; B keeps working.
    a.dispose();
    history.pushState({}, "", "?pc-two=2");
    expect(seenA.length).to.equal(1);
    expect(seenB.length).to.equal(2);
    b.dispose();
    history.pushState({}, "", "?pc-two=3");
    history.replaceState({}, "", "?pc-two=4");
    expect(seenA.length).to.equal(1);
    expect(seenB.length).to.equal(2);
    // B's dispose restored A's (dead) wrapper — put the pristine methods
    // back so later tests see an unwrapped history.
    history.pushState = History.prototype.pushState;
    history.replaceState = History.prototype.replaceState;
  });

  it("concurrent watchers: outer disposed first silences only itself", () => {
    const seenInner: string[] = [];
    const seenOuter: string[] = [];
    const inner = watchPageChanges((href) => seenInner.push(href));
    const outer = watchPageChanges((href) => seenOuter.push(href));
    outer.dispose();
    history.pushState({}, "", "?pc-outer=1");
    expect(seenOuter.length).to.equal(0);
    expect(seenInner.length).to.equal(1); // inner still live, still fires
    inner.dispose();
    history.pushState({}, "", "?pc-outer=2");
    expect(seenInner.length).to.equal(1);
    history.replaceState({}, "", location.pathname);
  });
});

describe("range anchors (text-selection flow)", () => {
  let host: HTMLDivElement;

  function mount(html: string): HTMLDivElement {
    const el = document.createElement("div");
    el.setAttribute("data-pc-test", "");
    el.innerHTML = html;
    document.body.append(el);
    return el;
  }

  /** Range over [wordStart, wordEnd) word indices of the host's flat text. */
  function rangeOverWords(start: number, end: number): Range {
    const range = document.createRange();
    let seen = 0;
    let started = false;
    const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
    let node: Node | null = walker.nextNode();
    while (node) {
      const words = (node.textContent ?? "").split(/(\s+)/).filter((part) => part.trim());
      for (const [index, word] of words.entries()) {
        if (!started && seen === start) {
          range.setStart(node, (node.textContent ?? "").indexOf(word));
          started = true;
        }
        if (started && seen === end - 1) {
          range.setEnd(node, (node.textContent ?? "").indexOf(word) + word.length);
          return range;
        }
        seen += 1;
        void index;
      }
      node = walker.nextNode();
    }
    throw new Error("word range not found");
  }

  function select(range: Range): void {
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
  }

  /**
   * Whitespace-free comparison form: raw Range.toString() cannot reproduce
   * the join whitespace the flat-text model inserts at element/block
   * boundaries ("</p><p>" yields "about.The second"), so quote equality is
   * asserted modulo all whitespace.
   */
  function mash(text: string): string {
    return text.replace(/\s+/g, "").toLowerCase();
  }

  beforeEach(() => {
    host = mount(`
      <p id="ra-one">Commenting starts with selecting exactly the words worth talking about.</p>
      <p id="ra-two">The second paragraph continues with more filler sentences to anchor against.</p>
    `);
  });

  afterEach(() => {
    host.remove();
    window.getSelection()?.removeAllRanges();
  });

  it("round-trips a multi-paragraph selection to the same words", () => {
    const range = rangeOverWords(4, 12); // "selecting exactly … filler"
    select(range);
    const anchor = anchorFromRange(range);
    expect(anchor.target).to.equal("range");
    // exact is stored boundary-safe (never "about.The second").
    expect(anchor.textQuote.exact).to.equal("exactly the words worth talking about. The second");
    const hit = resolve(anchor, document);
    expect(hit).to.not.be.null;
    expect(hit!.target).to.be.instanceOf(Range);
    expect(mash((hit!.target as Range).toString())).to.equal(mash(anchor.textQuote.exact));
  });

  it("survives a markup reshuffle that keeps the words", () => {
    const range = rangeOverWords(0, 6);
    const anchor = anchorFromRange(range);
    // Split the prose across inline elements and line breaks: css/xpath and
    // the container fingerprint all change shape, the quote must carry it.
    host.innerHTML = `
      <p id="ra-one"><em>Commenting</em> starts with<br>selecting exactly the words worth talking about.</p>
      <p id="ra-two">The second paragraph continues with more filler sentences to anchor against.</p>
    `;
    const hit = resolve(anchor, document);
    expect(hit).to.not.be.null;
    expect(hit!.target).to.be.instanceOf(Range);
    expect(mash((hit!.target as Range).toString())).to.equal(mash(anchor.textQuote.exact));
  });

  it("recovers from a small mid-quote edit via the head/tail split", () => {
    const range = rangeOverWords(0, 11);
    const anchor = anchorFromRange(range);
    expect(anchor.textQuote.exact.length).to.be.greaterThan(24);
    host.querySelector("#ra-one")!.textContent =
      "Commenting starts with selecting roughly the words worth talking about.";
    const hit = resolve(anchor, document);
    expect(hit).to.not.be.null;
    expect(hit!.target).to.be.instanceOf(Range);
    const got = mash((hit!.target as Range).toString());
    expect(got).to.contain(mash("Commenting starts with selecting"));
    expect(got).to.contain(mash("the words worth talking about"));
  });

  it("orphans when the quoted text is gone (no element fallback)", () => {
    const range = rangeOverWords(0, 6);
    const anchor = anchorFromRange(range);
    // Replace the quote entirely; the container element and its fingerprint
    // stay behind — a range anchor must NOT silently widen to them.
    host.querySelector("#ra-one")!.textContent = "Wholly different replacement prose lives here now.";
    expect(resolve(anchor, document)).to.be.null;
  });

  it("matches quotes whose whitespace drifts across element boundaries", () => {
    const quote = {prefix: "", exact: "about. The second", suffix: ""};
    const hit = resolveQuote(quote, document);
    expect(hit).to.not.be.null;
    expect(mash(hit!.toString())).to.equal(mash("about. The second"));
  });

  it("prefix context disambiguates repeated text", () => {
    // Repeat the words in the second paragraph; only the copy after the
    // first paragraph's text matches prefix + exact.
    host.querySelector("#ra-two")!.textContent =
      "The second paragraph continues with selecting exactly the words worth talking about.";
    const range = rangeOverWords(4, 10); // first copy, in #ra-one
    const anchor = anchorFromRange(range);
    expect(anchor.textQuote.prefix.length).to.be.greaterThan(0);
    const hit = resolve(anchor, document);
    expect(hit).to.not.be.null;
    const startEl = (hit!.target as Range).startContainer.parentElement;
    expect(startEl!.id).to.equal("ra-one");
  });
});
