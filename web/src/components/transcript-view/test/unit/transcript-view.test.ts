import { fixture, expect, html, waitUntil } from "@open-wc/testing";
import "../../transcript-view.js";
import { ToborTranscriptView } from "../../transcript-view.js";
import { createMemoryStore, type TranscriptStore } from "../../transcript-store.js";
import type { Turn } from "../../../../types.js";

const TURNS: Turn[] = [
  { id: "t1", role: "user", content: "Is the branch green?", created_at: "2026-01-01T00:00:00Z" },
  { id: "t2", role: "assistant", content: "Branch is green. Push to main.", created_at: "2026-01-01T00:00:05Z" },
];

describe("tobor-transcript-view", () => {
  it("renders turns with role styling", async () => {
    const el = await fixture<ToborTranscriptView>(
      html`<tobor-transcript-view .turns=${TURNS}></tobor-transcript-view>`,
    );
    const turns = el.shadowRoot!.querySelectorAll(".turn");
    expect(turns).to.have.lengthOf(2);
    expect(turns[0].getAttribute("data-role")).to.equal("user");
    expect(turns[1].getAttribute("data-role")).to.equal("assistant");
    expect(el.shadowRoot!.textContent).to.include("Branch is green.");
  });

  it("distinguishes a 501 not-server-backed load from an empty transcript", async () => {
    const el = await fixture<ToborTranscriptView>(
      html`<tobor-transcript-view .load=${{ status: "not_server_backed" }}></tobor-transcript-view>`,
    );
    await el.updateComplete;
    // The dedicated notice — NOT the empty message, NOT an error.
    expect(el.shadowRoot!.querySelector('[data-testid="not-server-backed"]')).to.exist;
    expect(el.shadowRoot!.querySelector('[data-testid="transcript-empty"]')).to.not.exist;
    expect(el.shadowRoot!.textContent).to.include("server stores no copy");
  });

  it("shows the empty state only when there genuinely are no turns", async () => {
    const el = await fixture<ToborTranscriptView>(
      html`<tobor-transcript-view .turns=${[]}></tobor-transcript-view>`,
    );
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[data-testid="transcript-empty"]')).to.exist;
    expect(el.shadowRoot!.querySelector('[data-testid="not-server-backed"]')).to.not.exist;
  });

  it("shows streaming pending text without collapsing it into a turn", async () => {
    const el = await fixture<ToborTranscriptView>(
      html`<tobor-transcript-view .turns=${[]} pending="working on it…"></tobor-transcript-view>`,
    );
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[data-testid="pending-turn"]')).to.exist;
    expect(el.shadowRoot!.querySelector('[data-testid="transcript-empty"]')).to.not.exist;
  });

  it("renders tool call results inside the turn that made them", async () => {
    const withTools: Turn[] = [
      {
        id: "t3",
        role: "assistant",
        content: "Checked the lane.",
        created_at: "2026-01-01T00:00:09Z",
        tool_calls: [{ id: "c1", name: "Github.BranchCreate", ok: true, summary: "green" }],
      },
    ];
    const el = await fixture<ToborTranscriptView>(
      html`<tobor-transcript-view .turns=${withTools}></tobor-transcript-view>`,
    );
    expect(el.shadowRoot!.querySelector('[data-testid="turn-tools"]')).to.exist;
    expect(el.shadowRoot!.textContent).to.include("Github.BranchCreate");
  });

  it("clears through the store and reports upward", async () => {
    const store: TranscriptStore = createMemoryStore();
    await store.append(TURNS[0]);
    const el = await fixture<ToborTranscriptView>(
      html`<tobor-transcript-view .turns=${TURNS} .store=${store}></tobor-transcript-view>`,
    );
    let cleared = false;
    el.addEventListener("tobor-transcript-clear", () => (cleared = true));
    (el.shadowRoot!.querySelector('[data-testid="transcript-clear"]') as HTMLButtonElement).click();
    await waitUntil(() => cleared);
    const loaded = await store.load();
    expect(loaded.status === "ok" ? loaded.turns : []).to.have.lengthOf(0);
    expect(el.turns).to.have.lengthOf(0);
  });
});
