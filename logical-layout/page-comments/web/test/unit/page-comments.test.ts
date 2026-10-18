import {expect, aTimeout} from "@open-wc/testing";
import {hashText, normalizeText, pageKey} from "../../anchor.js";
import {renderMarkdown} from "../../markdown.js";
import {MemoryDataSource} from "../../data-source.js";
import type {CommentThread} from "../../data-source.js";
import "../../page-comments.js";
import {NoizuPageComments} from "../../page-comments.js";

describe("renderMarkdown", () => {
  it("never lets raw HTML through", () => {
    const html = renderMarkdown("<script>alert(1)</script> and <img src=x onerror=alert(2)>");
    expect(html).to.not.contain("<script>");
    expect(html).to.not.contain("<img");
    expect(html).to.contain("&lt;script&gt;");
  });

  it("renders bold, italic, code and links", () => {
    const html = renderMarkdown("**bold** and *em* and `code` and [x](https://x.test/a)");
    expect(html).to.contain("<strong>bold</strong>");
    expect(html).to.contain("<em>em</em>");
    expect(html).to.contain("<code>code</code>");
    expect(html).to.contain('href="https://x.test/a"');
    expect(html).to.contain('rel="noopener noreferrer"');
  });

  it("rejects javascript: links and escapes lists", () => {
    const bad = renderMarkdown("[x](javascript:alert(1))");
    expect(bad).to.not.contain("<a ");
    expect(bad).to.not.contain('href="javascript');
    expect(bad).to.contain("[x](javascript:alert(1))"); // falls through as plain text
    expect(renderMarkdown("- one\n- two")).to.contain("<li>one</li>");
    expect(renderMarkdown("```\n<b>\n```")).to.contain("&lt;b&gt;");
  });

  it("rejects data: URLs like javascript:", () => {
    const bad = renderMarkdown("[x](data:text/html,<b>hi</b>)");
    expect(bad).to.not.contain("<a ");
    expect(bad).to.not.contain('href="data:');
  });

  it("keeps query-string ampersands singly escaped in link hrefs", () => {
    const html = renderMarkdown("[q](https://x.test/?a=1&b=2)");
    expect(html).to.contain('href="https://x.test/?a=1&amp;b=2"');
    expect(html).to.not.contain("&amp;amp;"); // no double-escaping
  });

  it("escapes raw HTML inside link labels and urls", () => {
    const html = renderMarkdown("[<b>label</b>](https://x.test/?q=<i>)");
    expect(html).to.contain("&lt;b&gt;label&lt;/b&gt;");
    expect(html).to.not.contain("<b>");
  });
});

describe("MemoryDataSource", () => {
  const seed: CommentThread = {
    id: "t1",
    page_key: "/page",
    url: "https://x.test/page",
    anchor: {
      css: "#a",
      xpath: "/html[1]/body[1]/div[1]",
      textQuote: {prefix: "", exact: "hello", suffix: ""},
      fingerprint: {tag: "div", textHash: "abc", relPos: 0},
    },
    body_md: "root **body**",
    resolved: false,
    comments: [{id: "c1", body_md: "reply", thread_id: "t1"}],
  };

  it("filters by page_key and clones seeds", async () => {
    const source = new MemoryDataSource([seed]);
    expect((await source.listThreads("/page")).map((t) => t.id)).to.deep.equal(["t1"]);
    expect(await source.listThreads("/other")).to.deep.equal([]);
    const listed = (await source.listThreads("/page"))[0];
    listed.body_md = "mutated";
    expect((await source.listThreads("/page"))[0].body_md).to.equal("root **body**");
  });

  it("create/reply/edit/remove/resolve/reopen round-trip", async () => {
    const source = new MemoryDataSource([]);
    const created = await source.createThread({
      page_key: "/p",
      url: "https://x.test/p",
      title: "T",
      anchor: seed.anchor,
      body_md: "new",
    });
    expect(created.resolved).to.equal(false);
    const reply = await source.reply(created.id, "re", created.id);
    expect(reply.parent_id).to.equal(created.id);
    await source.edit(reply.id, "edited");
    await source.resolve(created.id);
    expect((await source.listThreads("/p"))[0].resolved).to.equal(true);
    await source.reopen(created.id);
    await source.remove(reply.id);
    expect((await source.listThreads("/p"))[0].comments).to.have.lengthOf(0);
  });
});

describe("noizu-page-comments (element)", () => {
  const ANCHOR_TEXT = "Unit anchor paragraph text.";
  let host: HTMLDivElement;
  let el: NoizuPageComments;

  function seed(): CommentThread {
    return {
      id: "unit-thread",
      // Compute the key exactly the way the element will.
      page_key: pageKey(location.href),
      url: location.href,
      anchor: {
        css: "#pc-unit-anchor",
        xpath: "",
        textQuote: {prefix: "", exact: ANCHOR_TEXT, suffix: ""},
        fingerprint: {tag: "p", textHash: hashText(normalizeText(ANCHOR_TEXT)), relPos: 0},
      },
      body_md: "seeded **thread**",
      resolved: false,
      comments: [],
    };
  }

  beforeEach(() => {
    host = document.createElement("div");
    host.innerHTML = `<p id="pc-unit-anchor">${ANCHOR_TEXT}</p>`;
    document.body.append(host);
    el = document.createElement("noizu-page-comments") as NoizuPageComments;
    el.setAttribute("site", "unit");
    el.dataSource = new MemoryDataSource([seed()]);
    document.body.append(el);
  });

  afterEach(() => {
    el.remove();
    host.remove();
    // Layers are appended to document.body by the controller.
    document.querySelectorAll("noizu-page-comments-rail, noizu-page-comments-overlay").forEach((n) => n.remove());
  });

  function railShadow(): ShadowRoot | null {
    return document.querySelector("noizu-page-comments-rail")?.shadowRoot ?? null;
  }

  it("launcher toggles enabled and emits page-comments-toggle", async () => {
    await el.updateComplete;
    await aTimeout(30);
    const launcher = railShadow()?.querySelector('[data-cy="comments.launcher"]') as HTMLButtonElement;
    expect(launcher).to.exist;
    const events: boolean[] = [];
    el.addEventListener("page-comments-toggle", (e) => events.push((e as CustomEvent<{enabled: boolean}>).detail.enabled));
    launcher.click();
    expect(el.enabled).to.equal(true);
    await aTimeout(50);
    expect(events).to.deep.equal([true]);
    expect(railShadow()?.querySelector('[data-cy="comments.rail"]')).to.exist;
  });

  it("renders a seeded thread as a card once enabled", async () => {
    el.enabled = true;
    await aTimeout(80);
    const card = railShadow()?.querySelector('[data-cy="comments.card"][data-thread-id="unit-thread"]');
    expect(card).to.exist;
    expect(card?.textContent).to.contain("seeded");
  });

  it("moves a thread to Orphaned when its anchor leaves the DOM", async () => {
    el.enabled = true;
    await aTimeout(80);
    const orphans: string[] = [];
    el.addEventListener("page-comments-thread-orphan", (e) => orphans.push((e as CustomEvent<{id: string}>).detail.id));
    host.querySelector("#pc-unit-anchor")!.remove();
    // MutationObserver debounce is 200ms; give it room.
    await aTimeout(500);
    expect(orphans).to.deep.equal(["unit-thread"]);
    expect(railShadow()?.querySelector('[data-cy="comments.orphan-section"] [data-thread-id="unit-thread"]')).to.exist;
  });

  it("resolve marks the thread and shows the badge", async () => {
    el.enabled = true;
    await aTimeout(80);
    const resolveButton = railShadow()?.querySelector('[data-cy="comments.resolve"]') as HTMLButtonElement;
    resolveButton.click();
    await aTimeout(80);
    // The default Open tab hides resolved threads — switch over to inspect.
    (railShadow()?.querySelector('[data-cy="comments.tab-resolved"]') as HTMLButtonElement).click();
    await aTimeout(30);
    expect(railShadow()?.querySelector('[data-cy="comments.resolved-badge"]')).to.exist;
    expect(railShadow()?.querySelector('[data-cy="comments.reopen"]')).to.exist;
  });

  it("captures host clicks only in pick mode", async () => {
    el.enabled = true;
    await aTimeout(80);
    // Enabled but not picking: a host click must not open the composer.
    (host.querySelector("#pc-unit-anchor") as HTMLElement).click();
    await aTimeout(30);
    expect(railShadow()?.querySelector('[data-cy="comments.composer-card"]')).to.not.exist;
    // "+ Comment" enters pick mode (button flips to its pressed state).
    (railShadow()?.querySelector('[data-cy="comments.pick"]') as HTMLButtonElement).click();
    await aTimeout(30);
    expect(railShadow()?.querySelector('[data-cy="comments.pick"]')?.getAttribute("aria-pressed")).to.equal("true");
    // Esc exits pick mode.
    document.dispatchEvent(new KeyboardEvent("keydown", {key: "Escape", bubbles: true}));
    await aTimeout(30);
    expect(railShadow()?.querySelector('[data-cy="comments.pick"]')?.getAttribute("aria-pressed")).to.be.null;
  });
});
