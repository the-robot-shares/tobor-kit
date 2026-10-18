import { fixture, expect, html } from "@open-wc/testing";
import "../../task-menu.js";
import { ToborTaskMenu } from "../../task-menu.js";
import type { ToolInventory } from "../../../../types.js";

const INVENTORY: ToolInventory = {
  groups: [{ id: "Github", label: "Github" }],
  tools: [
    { name: "Github.BranchCreate", label: "New branch", group: "Github" },
    { name: "Github.PullCreate", label: "Open a PR", group: "Github", confirm: true },
  ],
  degraded: [{ server: "tickets", error: "timeout" }],
};

async function openMenu(inv: ToolInventory | null = INVENTORY): Promise<ToborTaskMenu> {
  const el = await fixture<ToborTaskMenu>(html`<tobor-task-menu .inventory=${inv}></tobor-task-menu>`);
  (el.shadowRoot!.querySelector('[data-testid="task-menu-trigger"]') as HTMLButtonElement).click();
  await el.updateComplete;
  return el;
}

describe("tobor-task-menu", () => {
  it("opens and lists server-dressed tools verbatim", async () => {
    const el = await openMenu();
    const items = [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>("button[role='menuitem']")];
    expect(items.map((b) => b.getAttribute("data-tool"))).to.deep.equal([
      "Github.BranchCreate",
      "Github.PullCreate",
    ]);
  });

  it("emits tobor-task-select immediately for non-confirm tools", async () => {
    const el = await openMenu();
    let detail: { tool?: { name: string } } | null = null;
    el.addEventListener("tobor-task-select", (e) => (detail = (e as CustomEvent).detail));
    (
      el.shadowRoot!.querySelector('[data-tool="Github.BranchCreate"]') as HTMLButtonElement
    ).click();
    expect((detail as { tool?: { name: string } } | null)?.tool?.name).to.equal("Github.BranchCreate");
    expect(el.open).to.be.false;
  });

  it("requires explicit confirmation for confirm:true tools", async () => {
    const el = await openMenu();
    let detail: { tool?: { name: string } } | null = null;
    el.addEventListener("tobor-task-select", (e) => (detail = (e as CustomEvent).detail));

    (el.shadowRoot!.querySelector('[data-tool="Github.PullCreate"]') as HTMLButtonElement).click();
    await el.updateComplete;
    // First click only asks.
    expect(detail).to.equal(null);
    expect(el.shadowRoot!.querySelector('[data-testid="task-confirm-text"]')).to.exist;

    (el.shadowRoot!.querySelector('[data-testid="task-confirm-yes"]') as HTMLButtonElement).click();
    expect((detail as { tool?: { name: string } } | null)?.tool?.name).to.equal("Github.PullCreate");
    expect(el.open).to.be.false;
  });

  it("shows degraded servers in the menu", async () => {
    const el = await openMenu();
    const notice = el.shadowRoot!.querySelector('[data-testid="task-menu-degraded"]')!;
    expect(notice).to.exist;
    expect(notice.textContent).to.include("tickets");
  });

  it("closes with Escape and renders an empty state without tools", async () => {
    const el = await openMenu({ groups: [], tools: [], degraded: [] });
    expect(el.shadowRoot!.querySelector('[data-testid="task-menu-empty"]')).to.exist;

    const panel = el.shadowRoot!.querySelector('[data-testid="task-menu-panel"]')!;
    panel.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await el.updateComplete;
    expect(el.open).to.be.false;
  });
});
