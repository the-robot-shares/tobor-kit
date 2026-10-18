import { fixture, expect, html } from "@open-wc/testing";
import "../../mode-toggle.js";
import { ToborModeToggle } from "../../mode-toggle.js";

describe("tobor-mode-toggle", () => {
  it("renders modes in projection display order", async () => {
    const el = await fixture<ToborModeToggle>(
      html`<tobor-mode-toggle .modes=${["text", "voice", "transcript"]}></tobor-mode-toggle>`,
    );
    const buttons = [...el.shadowRoot!.querySelectorAll("button[role='radio']")];
    expect(buttons.map((b) => b.getAttribute("data-mode"))).to.deep.equal([
      "text",
      "voice",
      "transcript",
    ]);
  });

  it("marks the active mode and fires tobor-mode-change on select", async () => {
    const el = await fixture<ToborModeToggle>(
      html`<tobor-mode-toggle .modes=${["text", "voice"]} mode="text"></tobor-mode-toggle>`,
    );
    let detail: { mode: string; previous: string } | null = null;
    el.addEventListener("tobor-mode-change", (e) => (detail = (e as CustomEvent).detail));

    const radios = [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>("button[role='radio']")];
    expect(radios[0].getAttribute("aria-checked")).to.equal("true");
    radios[1].click();

    expect((detail as { mode: string } | null)?.mode).to.equal("voice");
    expect((detail as { previous: string } | null)?.previous).to.equal("text");
    expect(el.mode).to.equal("voice");
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector("button[data-mode='voice']")!.getAttribute("aria-checked")).to.equal("true");
  });

  it("does not fire when the active mode is re-selected", async () => {
    const el = await fixture<ToborModeToggle>(
      html`<tobor-mode-toggle .modes=${["text", "voice"]} mode="text"></tobor-mode-toggle>`,
    );
    let fired = 0;
    el.addEventListener("tobor-mode-change", () => (fired += 1));
    (el.shadowRoot!.querySelector("button[data-mode='text']") as HTMLButtonElement).click();
    expect(fired).to.equal(0);
  });

  it("ignores clicks while disabled", async () => {
    const el = await fixture<ToborModeToggle>(
      html`<tobor-mode-toggle .modes=${["text", "voice"]} mode="text" disabled></tobor-mode-toggle>`,
    );
    let fired = 0;
    el.addEventListener("tobor-mode-change", () => (fired += 1));
    (el.shadowRoot!.querySelector("button[data-mode='voice']") as HTMLButtonElement).click();
    expect(fired).to.equal(0);
  });

  it("renders nothing without modes", async () => {
    const el = await fixture<ToborModeToggle>(html`<tobor-mode-toggle .modes=${[]}></tobor-mode-toggle>`);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector("[role='radiogroup']")).to.not.exist;
  });
});
