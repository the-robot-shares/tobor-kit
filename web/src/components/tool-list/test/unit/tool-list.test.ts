import { fixture, expect, html } from "@open-wc/testing";
import "../../tool-list.js";
import type { ToborToolList } from "../../tool-list.js";
import type { ToolInventory } from "../../../../types.js";

const INVENTORY: ToolInventory = {
  groups: [
    { id: "Github", label: "Github" },
    { id: "Tickets", label: "Tickets" },
  ],
  tools: [
    { name: "Github.BranchCreate", label: "New branch", group: "Github", read_only: true },
    { name: "Github.PullCreate", label: "Open a PR", group: "Github", confirm: true },
    { name: "Ticket.Create", label: "File a ticket", group: "Tickets" },
  ],
  degraded: [
    { server: "seo", error: "connection refused" },
    { server: "analytics" },
  ],
};

describe("tobor-tool-list", () => {
  it("renders tools grouped by the server-dressed groups", async () => {
    const el = await fixture<ToborToolList>(
      html`<tobor-tool-list .inventory=${INVENTORY}></tobor-tool-list>`,
    );
    const groups = el.shadowRoot!.querySelectorAll("section.group");
    expect(groups).to.have.lengthOf(2);
    expect(groups[0].getAttribute("data-group")).to.equal("Github");
    expect(el.shadowRoot!.querySelectorAll("button.tool")).to.have.lengthOf(3);
  });

  it("surfaces degraded servers prominently — never silently shortens the list", async () => {
    const el = await fixture<ToborToolList>(
      html`<tobor-tool-list .inventory=${INVENTORY}></tobor-tool-list>`,
    );
    const degraded = el.shadowRoot!.querySelector('[data-testid="degraded-servers"]')!;
    expect(degraded).to.exist;
    const items = degraded.querySelectorAll("li");
    expect(items).to.have.lengthOf(2);
    expect(items[0].textContent).to.include("seo");
    expect(items[0].textContent).to.include("connection refused");
    expect(items[1].textContent).to.include("analytics");
  });

  it("renders the generic message for degraded entries with no identity (contract resolution 6)", async () => {
    const el = await fixture<ToborToolList>(
      html`<tobor-tool-list .inventory=${{ groups: [], tools: [], degraded: [{}, { server: "seo", error: "timeout" }] }}></tobor-tool-list>`,
    );
    const unidentified = el.shadowRoot!.querySelector('[data-testid="degraded-unidentified"]')!;
    expect(unidentified).to.exist;
    expect(unidentified.textContent).to.include("A tool server is unreachable");
    // The identified one still renders its name.
    expect(el.shadowRoot!.querySelector('li[data-server="seo"]')).to.exist;
  });

  it("renders badges for read_only and confirm", async () => {
    const el = await fixture<ToborToolList>(
      html`<tobor-tool-list .inventory=${INVENTORY}></tobor-tool-list>`,
    );
    expect(el.shadowRoot!.textContent).to.include("read-only");
    expect(el.shadowRoot!.textContent).to.include("confirm");
  });

  it("emits tobor-tool-select with the tool on click", async () => {
    const el = await fixture<ToborToolList>(
      html`<tobor-tool-list .inventory=${INVENTORY}></tobor-tool-list>`,
    );
    let detail: { tool?: { name: string } } | null = null;
    el.addEventListener("tobor-tool-select", (e) => (detail = (e as CustomEvent).detail));
    (el.shadowRoot!.querySelector('[data-tool="Ticket.Create"]') as HTMLButtonElement).click();
    expect((detail as { tool?: { name: string } } | null)?.tool?.name).to.equal("Ticket.Create");
  });

  it("renders distinct empty states for no inventory vs empty tools", async () => {
    const none = await fixture<ToborToolList>(html`<tobor-tool-list></tobor-tool-list>`);
    expect(none.shadowRoot!.querySelector('[data-testid="tools-unavailable"]')).to.exist;

    const empty = await fixture<ToborToolList>(
      html`<tobor-tool-list .inventory=${{ groups: [], tools: [], degraded: [] }}></tobor-tool-list>`,
    );
    expect(empty.shadowRoot!.querySelector('[data-testid="tools-empty"]')).to.exist;
    expect(empty.shadowRoot!.querySelector('[data-testid="degraded-servers"]')).to.not.exist;
  });
});
