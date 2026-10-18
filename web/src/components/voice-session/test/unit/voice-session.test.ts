import { fixture, expect, html, waitUntil } from "@open-wc/testing";
import "../../voice-session.js";
import type { ToborVoiceSession } from "../../voice-session.js";
import { ToborKitClient } from "../../../../client.js";
import { createVoiceAdapter, type VoiceAdapter } from "../../adapter.js";

describe("tobor-voice-session", () => {
  it("reports the none adapter as an error, not silence", async () => {
    const el = await fixture<ToborVoiceSession>(
      html`<tobor-voice-session
        .client=${new ToborKitClient({ fetchImpl: (async () => new Response("{}")) as typeof fetch })}
        .voice=${{ adapter: "none" }}
      ></tobor-voice-session>`,
    );
    await el.updateComplete;
    const errors: { code: string }[] = [];
    el.addEventListener("tobor-voice-error", (e) =>
      errors.push((e as CustomEvent).detail.error),
    );
    await el.start();
    expect(errors.map((e) => e.code)).to.include("voice_disabled");
    expect(el.shadowRoot!.querySelector('[data-testid="voice-status"]')!.getAttribute("data-state")).to.equal("idle");
  });

  it("drives state events from the adapter (states-up contract)", async () => {
    const states: string[] = [];
    let activeFlag = false;
    const factory = ((opts: Parameters<typeof createVoiceAdapter>[0]): VoiceAdapter => {
      const fake: VoiceAdapter = {
        name: "realtime",
        supportsPushToTalk: false,
        get active() {
          return activeFlag;
        },
        async start() {
          activeFlag = true;
          opts.hooks.onState?.("listening");
          opts.hooks.onTranscript?.({ speaker: "user", text: "hello", final: true });
        },
        async stop() {
          activeFlag = false;
          opts.hooks.onState?.("idle");
        },
        sendText() {
          /* unused */
        },
      };
      return fake;
    }) as typeof createVoiceAdapter;

    const el = await fixture<ToborVoiceSession>(
      html`<tobor-voice-session
        .client=${new ToborKitClient({ fetchImpl: (async () => new Response("{}")) as typeof fetch })}
        .voice=${{ adapter: "realtime" }}
        .adapterFactory=${factory}
      ></tobor-voice-session>`,
    );
    el.addEventListener("tobor-voice-state", (e) =>
      states.push((e as CustomEvent).detail.state),
    );
    let transcript: string | null = null;
    el.addEventListener("tobor-voice-transcript", (e) =>
      (transcript = (e as CustomEvent).detail.entry.text),
    );

    await el.start();
    expect(states).to.deep.equal(["listening"]);
    expect(transcript).to.equal("hello");
    expect(el.shadowRoot!.querySelector('[data-testid="voice-mic"]')!.getAttribute("aria-pressed")).to.equal("true");

    await el.stop();
    expect(states).to.deep.equal(["listening", "idle"]);
  });

  it("native adapter: 409 from /voice/token is the expected answer and start proceeds", async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ code: "no_credential", message: "native" }), {
        status: 409,
        headers: { "Content-Type": "application/json" },
      })) as typeof fetch;
    const client = new ToborKitClient({ fetchImpl });

    class FakeRecognition extends EventTarget {
      lang = "";
      continuous = false;
      interimResults = false;
      started = false;
      start() {
        this.started = true;
      }
      stop() {
        this.started = false;
      }
      onresult: ((e: unknown) => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      onend: (() => void) | null = null;
    }

    const el = await fixture<ToborVoiceSession>(
      html`<tobor-voice-session
        .client=${client}
        .voice=${{ adapter: "native", locale: "en-US" }}
        .adapterFactory=${((opts: Parameters<typeof createVoiceAdapter>[0]) =>
          createVoiceAdapter({
            ...opts,
            client: opts.client as ToborKitClient,
            recognitionCtor: FakeRecognition as never,
          })) as typeof createVoiceAdapter}
      ></tobor-voice-session>`,
    );
    await el.start();
    const status = el.shadowRoot!.querySelector('[data-testid="voice-status"]')!;
    await waitUntil(() => status.getAttribute("data-state") === "listening", "native start reports listening");
    expect(status.getAttribute("data-state")).to.equal("listening");
  });

  it("push-to-talk renders a hold button (no click toggle binding)", async () => {
    const el = await fixture<ToborVoiceSession>(
      html`<tobor-voice-session .voice=${{ adapter: "none" }} push-to-talk></tobor-voice-session>`,
    );
    await el.updateComplete;
    const mic = el.shadowRoot!.querySelector('[data-testid="voice-mic"]') as HTMLButtonElement & { onclick: unknown };
    expect(mic.onclick).to.equal(null);
  });
});

describe("voice adapter contract resolution: omitted adapter ⇒ realtime", () => {
  const client = new ToborKitClient({ fetchImpl: (async () => new Response("{}")) as typeof fetch });

  it("an omitted voice.adapter resolves to the realtime adapter (schema default)", () => {
    const adapter = createVoiceAdapter({ voice: undefined, client, hooks: {} });
    expect(adapter.name).to.equal("realtime");
  });

  it("an explicit none still disables voice", () => {
    const adapter = createVoiceAdapter({ voice: { adapter: "none" }, client, hooks: {} });
    expect(adapter.name).to.equal("none");
  });
});
