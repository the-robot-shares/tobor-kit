import { fixture, expect, html } from "@open-wc/testing";
import "../../noizu-footer-brand.js";
import { NoizuFooterBrand } from "../../noizu-footer-brand.js";

describe("noizu-footer-brand", () => {
  const text = (el: NoizuFooterBrand) =>
    (el.shadowRoot?.textContent ?? "").replace(/\s+/g, " ").trim();

  it("renders the default attribution line and link href", async () => {
    const el = await fixture<NoizuFooterBrand>(
      html`<noizu-footer-brand></noizu-footer-brand>`,
    );
    await el.updateComplete;
    expect(text(el)).to.equal("A The Robot Lives Joint");

    const link = el.shadowRoot!.querySelector<HTMLAnchorElement>(
      'a[data-cy="footer-brand-link"]',
    )!;
    expect(link.textContent).to.equal("The Robot Lives");
    expect(link.getAttribute("href")).to.equal("https://derobot.is");
    expect(link.hasAttribute("target")).to.be.false;
    expect(link.hasAttribute("rel")).to.be.false;
  });

  it("suppresses prefix/suffix pieces and their spacing when empty", async () => {
    const el = await fixture<NoizuFooterBrand>(
      html`<noizu-footer-brand prefix="" suffix=""></noizu-footer-brand>`,
    );
    await el.updateComplete;
    expect(text(el)).to.equal("The Robot Lives");

    const onlyPrefix = await fixture<NoizuFooterBrand>(
      html`<noizu-footer-brand prefix="Built by" suffix=""></noizu-footer-brand>`,
    );
    await onlyPrefix.updateComplete;
    expect(text(onlyPrefix)).to.equal("Built by The Robot Lives");

    const onlySuffix = await fixture<NoizuFooterBrand>(
      html`<noizu-footer-brand prefix="" suffix="Labs"></noizu-footer-brand>`,
    );
    await onlySuffix.updateComplete;
    expect(text(onlySuffix)).to.equal("The Robot Lives Labs");
  });

  it("adds rel=\"noopener noreferrer\" only for target=\"_blank\"", async () => {
    const blank = await fixture<NoizuFooterBrand>(
      html`<noizu-footer-brand target="_blank"></noizu-footer-brand>`,
    );
    await blank.updateComplete;
    const blankLink = blank.shadowRoot!.querySelector<HTMLAnchorElement>(
      'a[data-cy="footer-brand-link"]',
    )!;
    expect(blankLink.getAttribute("target")).to.equal("_blank");
    expect(blankLink.getAttribute("rel")).to.equal("noopener noreferrer");

    const named = await fixture<NoizuFooterBrand>(
      html`<noizu-footer-brand target="help"></noizu-footer-brand>`,
    );
    await named.updateComplete;
    const namedLink = named.shadowRoot!.querySelector<HTMLAnchorElement>(
      'a[data-cy="footer-brand-link"]',
    )!;
    expect(namedLink.getAttribute("target")).to.equal("help");
    expect(namedLink.hasAttribute("rel")).to.be.false;
  });

  it("reflects theme/palette/align attributes in both directions", async () => {
    const el = await fixture<NoizuFooterBrand>(
      html`<noizu-footer-brand theme="light" palette="mono"></noizu-footer-brand>`,
    );
    expect(el.getAttribute("theme")).to.equal("light");
    expect(el.getAttribute("palette")).to.equal("mono");

    el.palette = "accent";
    el.align = "end";
    await el.updateComplete;
    expect(el.getAttribute("palette")).to.equal("accent");
    expect(el.getAttribute("align")).to.equal("end");

    el.setAttribute("align", "start");
    await el.updateComplete;
    expect(el.align).to.equal("start");
  });

  it("maps align to text-align, defaulting to center", async () => {
    const el = await fixture<NoizuFooterBrand>(
      html`<noizu-footer-brand></noizu-footer-brand>`,
    );
    const root = el.shadowRoot!.querySelector<HTMLElement>(
      '[data-cy="footer-brand-root"]',
    )!;
    expect(getComputedStyle(root).textAlign).to.equal("center");

    el.align = "end";
    await el.updateComplete;
    expect(getComputedStyle(root).textAlign).to.equal("end");
  });

  it("lets an explicit --noizu-footer-brand-brand-color beat the palette", async () => {
    const el = await fixture<NoizuFooterBrand>(
      html`<noizu-footer-brand
        style="--noizu-footer-brand-brand-color: rgb(1, 2, 3)"
      ></noizu-footer-brand>`,
    );
    await el.updateComplete;
    const link = el.shadowRoot!.querySelector<HTMLAnchorElement>(
      'a[data-cy="footer-brand-link"]',
    )!;
    expect(getComputedStyle(link).color).to.equal("rgb(1, 2, 3)");
  });
  it("renders a parent-organization attribution from prefix/brand/suffix", async () => {
    const el = await fixture<NoizuFooterBrand>(
      html`<noizu-footer-brand
        prefix="a"
        brand="noizu.com"
        suffix="project"
        href="https://noizu.com"
      ></noizu-footer-brand>`,
    );
    await el.updateComplete;
    const root = el.shadowRoot!.querySelector<HTMLElement>(
      '[data-cy="footer-brand-root"]',
    )!;
    expect(root.textContent!.replace(/\s+/g, " ").trim()).to.equal(
      "a noizu.com project",
    );
    const link = el.shadowRoot!.querySelector<HTMLAnchorElement>(
      'a[data-cy="footer-brand-link"]',
    )!;
    expect(link.getAttribute("href")).to.equal("https://noizu.com");
  });

  it("hides light-DOM children, so a host may use them as pre-upgrade text", async () => {
    const el = await fixture<NoizuFooterBrand>(
      html`<noizu-footer-brand prefix="a" brand="noizu.com" suffix="project"
        >a noizu.com project</noizu-footer-brand
      >`,
    );
    await el.updateComplete;
    // No <slot> in the shadow root means the fallback copy a server rendered
    // for crawlers stops being painted the moment the element upgrades.
    expect(el.shadowRoot!.querySelector("slot")).to.equal(null);
  });
});
