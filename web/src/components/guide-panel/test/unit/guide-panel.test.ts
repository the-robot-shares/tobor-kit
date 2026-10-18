import { fixture, expect, html, waitUntil } from "@open-wc/testing";
import "../../guide-panel.js";
import { ToborGuidePanel } from "../../guide-panel.js";
import { ToborKitClient } from "../../../../client.js";
import type { GuideProjection } from "../../../../types.js";

function sseResponse(frames: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const frame of frames) controller.enqueue(encoder.encode(frame));
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

const GUIDE: GuideProjection = {
  slug: "deploy-guide",
  name: "Tobor",
  title: "Deployment Guide",
  greeting: "Shipping something? Tell me the app.",
  modes: ["text", "transcript"],
  default_mode: "text",
  ui: {
    robot: { renderer: "glyph", reduced_motion: "respect" },
    panel: { placement: "inline", start_expanded: true, show_tool_list: true, show_task_menu: true },
    theme: { "--tobor-kit-accent": "#7c5cff" },
  },
  auth: { required: false, provider: "none" },
  telemetry: { enabled: true, default: "on", user_overridable: true },
  voice: { adapter: "none" },
  transcript: { store: "memory", retain_turns: 50 },
};

interface RecordedCall {
  url: string;
  init: RequestInit;
}

function makeFetch(guide = GUIDE): {
  fetch: typeof fetch;
  calls: RecordedCall[];
  respondTurn: (frames: string[]) => void;
} {
  const calls: RecordedCall[] = [];
  let turnResponse: Response | null = null;
  const respondTurn = (frames: string[]) => {
    turnResponse = sseResponse(frames);
  };
  const fetchImpl = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.endsWith("/guide")) {
      return new Response(JSON.stringify(guide), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.endsWith("/mcp/tools")) {
      return new Response(
        JSON.stringify({
          groups: [{ id: "Github", label: "Github" }],
          tools: [{ name: "Github.BranchCreate", label: "New branch", group: "Github" }],
          degraded: [{ server: "seo", error: "timeout" }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    if (url.endsWith("/sessions") && init.method === "POST") {
      return new Response(
        JSON.stringify({ id: "11111111-1111-1111-1111-111111111111", created_at: "z", state: "idle" }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      );
    }
    if (url.includes("/turn")) {
      return (turnResponse ?? sseResponse([])) as Response;
    }
    return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  return { fetch: fetchImpl, calls, respondTurn };
}

async function mountedPanel(io = makeFetch()): Promise<ToborGuidePanel> {
  const client = new ToborKitClient({ fetchImpl: io.fetch, token: () => null });
  const el = await fixture<ToborGuidePanel>(
    html`<tobor-guide-panel .client=${client} .guide=${GUIDE}></tobor-guide-panel>`,
  );
  await el.updateComplete;
  return el;
}

describe("tobor-guide-panel", () => {
  it("fetches the projection itself when only a client is given", async () => {
    const io = makeFetch();
    const client = new ToborKitClient({ fetchImpl: io.fetch });
    const el = await fixture<ToborGuidePanel>(
      html`<tobor-guide-panel .client=${client}></tobor-guide-panel>`,
    );
    await waitUntil(() => el.guide?.slug === "deploy-guide");
    expect(io.calls.some((c) => c.url.endsWith("/guide"))).to.be.true;
    expect(el.getAttribute("placement")).to.equal("inline");
  });

  it("applies the ui.theme map as custom properties", async () => {
    const el = await mountedPanel();
    await waitUntil(() => el.style.getPropertyValue("--tobor-kit-accent") === "#7c5cff");
  });

  it("renders header, greeting, modes, inventory-driven menu, and degraded servers", async () => {
    const el = await mountedPanel();
    await waitUntil(() => (el as any)._inventory !== null);
    expect(el.shadowRoot!.querySelector("tobor-robot-avatar")).to.exist;
    expect(el.shadowRoot!.querySelector('[data-testid="greeting"]')!.textContent).to.include(
      "Shipping something",
    );
    const modeToggle = el.shadowRoot!.querySelector("tobor-mode-toggle")!;
    const modes = [...modeToggle.shadowRoot!.querySelectorAll("button[role='radio']")];
    expect(modes.map((b) => b.getAttribute("data-mode"))).to.deep.equal(["text", "transcript"]);

    // Open the task menu: server-dressed tools + degraded note visible.
    const taskMenu = el.shadowRoot!.querySelector("tobor-task-menu")!;
    (
      taskMenu.shadowRoot!.querySelector('[data-testid="task-menu-trigger"]') as HTMLButtonElement
    ).click();
    await taskMenu.updateComplete;
    expect(taskMenu.shadowRoot!.querySelector('[data-tool="Github.BranchCreate"]')).to.exist;
    expect(taskMenu.shadowRoot!.querySelector('[data-testid="task-menu-degraded"]')).to.exist;
  });

  it("streams a turn: drives the avatar, accumulates deltas, finalizes the transcript", async () => {
    const io = makeFetch();
    const el = await mountedPanel(io);
    io.respondTurn([
      'event: state\ndata: {"state":"thinking"}\n\n',
      'event: state\ndata: {"state":"speaking"}\n\n',
      'event: delta\ndata: {"text":"Branch is "}\n\n',
      'event: delta\ndata: {"text":"green."}\n\n',
      'event: message\ndata: {"id":"t9","role":"assistant","content":"Branch is green.","created_at":"z"}\n\n',
    ]);

    const states: string[] = [];
    el.addEventListener("tobor-state-change", (e) => states.push((e as CustomEvent).detail.state));

    const input = el.shadowRoot!.querySelector('[data-testid="text-input"]') as HTMLInputElement;
    input.value = "is the branch green?";
    input.dispatchEvent(new InputEvent("input"));
    (el.shadowRoot!.querySelector('[data-testid="send"]') as HTMLButtonElement).click();

    await waitUntil(() => (el as any)._turns.length === 1);
    expect((el as any)._turns[0].content).to.equal("Branch is green.");
    expect(states).to.deep.equal(["thinking", "speaking"]);
    expect((el as any)._state).to.equal("idle");

    const turnCall = io.calls.find((c) => c.url.includes("/turn"))!;
    expect(JSON.parse(String(turnCall.init.body)).input).to.equal("is the branch green?");
  });

  it("surfaces stream failure instead of leaving the avatar spinning", async () => {
    const io = makeFetch();
    const el = await mountedPanel(io);
    io.respondTurn(['event: state\ndata: {"state":"thinking"}\n\n']);

    const input = el.shadowRoot!.querySelector('[data-testid="text-input"]') as HTMLInputElement;
    input.value = "hello";
    input.dispatchEvent(new InputEvent("input"));
    (el.shadowRoot!.querySelector('[data-testid="send"]') as HTMLButtonElement).click();

    await waitUntil(() => (el as any)._error !== null);
    expect((el as any)._error?.code).to.equal("stream_incomplete");
    expect((el as any)._state).to.equal("error");
    expect(el.shadowRoot!.querySelector('[data-testid="turn-error"]')).to.exist;
  });

  it("carries a task-menu selection as task_id on the next turn", async () => {
    const io = makeFetch();
    const el = await mountedPanel(io);
    io.respondTurn([
      'event: message\ndata: {"id":"t1","role":"assistant","content":"ok","created_at":"z"}\n\n',
    ]);

    const taskMenu = el.shadowRoot!.querySelector("tobor-task-menu")!;
    await waitUntil(() => (el as any)._inventory !== null, "inventory loaded");
    (
      taskMenu.shadowRoot!.querySelector('[data-testid="task-menu-trigger"]') as HTMLButtonElement
    ).click();
    await taskMenu.updateComplete;
    (
      taskMenu.shadowRoot!.querySelector('[data-tool="Github.BranchCreate"]') as HTMLButtonElement
    ).click();
    await el.updateComplete;
    expect((el as any)._pendingTaskId).to.equal("Github.BranchCreate");

    const input = el.shadowRoot!.querySelector('[data-testid="text-input"]') as HTMLInputElement;
    input.value = "cut a branch for the fix";
    input.dispatchEvent(new InputEvent("input"));
    (el.shadowRoot!.querySelector('[data-testid="send"]') as HTMLButtonElement).click();

    await waitUntil(() => (el as any)._turns.length === 1);
    const turnCall = io.calls.find((c) => c.url.includes("/turn"))!;
    expect(JSON.parse(String(turnCall.init.body)).task_id).to.equal("Github.BranchCreate");
  });

  it("renders the transcript mode with the 501 distinction intact", async () => {
    const el = await mountedPanel();
    // memory store: loads empty — plain empty state, not the not-backed notice.
    const modeToggle = el.shadowRoot!.querySelector("tobor-mode-toggle")!;
    (
      modeToggle.shadowRoot!.querySelector("button[data-mode='transcript']") as HTMLButtonElement
    ).click();
    await el.updateComplete;
    await waitUntil(() => (el as any)._mode === "transcript");
    const view = el.shadowRoot!.querySelector("tobor-transcript-view")!;
    await waitUntil(() => view.shadowRoot!.querySelector('[data-testid="transcript-empty"]') !== null);
    expect(el.shadowRoot!.querySelector('[data-testid="not-server-backed"]')).to.not.exist;
  });
});
