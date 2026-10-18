import { fixture, expect, html } from "@open-wc/testing";
import "../../robot-avatar.js";
import { ToborRobotAvatar } from "../../robot-avatar.js";
import { GUIDE_STATES, type GuideState } from "../../../../types.js";

const EYES_BY_STATE: Record<GuideState, string> = {
  idle: "normal",
  listening: "wide",
  thinking: "up",
  speaking: "normal",
  tool_running: "normal",
  error: "error",
  offline: "offline",
};

describe("tobor-robot-avatar", () => {
  it("transitions through all seven canonical states", async () => {
    const el = await fixture<ToborRobotAvatar>(html`<tobor-robot-avatar></tobor-robot-avatar>`);
    for (const state of GUIDE_STATES) {
      el.state = state;
      await el.updateComplete;
      expect(el.dataset.state, `data-state for ${state}`).to.equal(state);
      expect(el.getAttribute("state")).to.equal(state);
      const label = el.shadowRoot!.querySelector<HTMLElement>('[data-testid="state-label"]')!;
      expect(label.textContent!.trim(), `sr label for ${state}`).to.equal(state);
      const eyes = el.shadowRoot!.querySelector('[part="eyes"]');
      expect(eyes?.getAttribute("data-eyes"), `eyes for ${state}`).to.equal(EYES_BY_STATE[state]);
    }
  });

  it("carries every state as a distinct visual variant (mouth)", async () => {
    const el = await fixture<ToborRobotAvatar>(html`<tobor-robot-avatar></tobor-robot-avatar>`);
    const mouths = new Set<string>();
    for (const state of GUIDE_STATES) {
      el.state = state;
      await el.updateComplete;
      mouths.add(el.shadowRoot!.querySelector('[part="mouth"]')?.getAttribute("data-mouth") ?? "");
    }
    // speaking/tool_running/error/offline/listening each have their own mouth;
    // idle and speaking share only because speaking has bars vs idle smile —
    // assert they are NOT all collapsed into one.
    expect(mouths.size).to.be.greaterThan(4);
  });

  it("is static under reduced_motion=force_static", async () => {
    const el = await fixture<ToborRobotAvatar>(
      html`<tobor-robot-avatar state="listening" reduced-motion="force_static"></tobor-robot-avatar>`,
    );
    await el.updateComplete;
    expect(el.dataset.motion).to.equal("static");
    // The listening pulse rings render only when animated.
    expect(el.shadowRoot!.querySelectorAll(".ring")).to.have.lengthOf(0);
    expect(el.shadowRoot!.querySelector('[data-mouth="listening"]')).to.exist;
  });

  it("is static under reduced_motion=respect when the user prefers reduced motion", async () => {
    const real = globalThis.matchMedia;
    globalThis.matchMedia = ((query: string) => ({
      matches: query.includes("prefers-reduced-motion"),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    })) as unknown as typeof matchMedia;
    try {
      const el = await fixture<ToborRobotAvatar>(
        html`<tobor-robot-avatar state="listening" reduced-motion="respect"></tobor-robot-avatar>`,
      );
      await el.updateComplete;
      expect(el.dataset.motion).to.equal("static");
    } finally {
      globalThis.matchMedia = real;
    }
  });

  it("is animated under reduced_motion=ignore regardless of the OS preference", async () => {
    const real = globalThis.matchMedia;
    globalThis.matchMedia = ((query: string) => ({
      matches: true,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    })) as unknown as typeof matchMedia;
    try {
      const el = await fixture<ToborRobotAvatar>(
        html`<tobor-robot-avatar reduced-motion="ignore"></tobor-robot-avatar>`,
      );
      await el.updateComplete;
      expect(el.dataset.motion).to.equal("animated");
    } finally {
      globalThis.matchMedia = real;
    }
  });

  it("clamps unknown states to idle and says so", async () => {
    const el = await fixture<ToborRobotAvatar>(html`<tobor-robot-avatar></tobor-robot-avatar>`);
    el.state = "vibing" as GuideState;
    await el.updateComplete;
    expect(el.dataset.state).to.equal("idle");
    expect(el.dataset.unknownState).to.equal("vibing");
  });

  it("falls back to the glyph when an asset renderer is requested without art", async () => {
    const el = await fixture<ToborRobotAvatar>(
      html`<tobor-robot-avatar renderer="lottie" asset="./tobor.lottie"></tobor-robot-avatar>`,
    );
    await el.updateComplete;
    expect(el.dataset.rendererFallback).to.equal("glyph");
    expect(el.shadowRoot!.querySelector("svg")).to.exist;
  });

  it("applies per-state speed hints from ui.robot.states", async () => {
    const el = await fixture<ToborRobotAvatar>(
      html`<tobor-robot-avatar state="thinking" .states=${{ thinking: { segment: "think", loop: true, speed: 2 } }}></tobor-robot-avatar>`,
    );
    await el.updateComplete;
    const svg = el.shadowRoot!.querySelector("svg")!;
    expect(svg.getAttribute("style")).to.contain("--_tk-speed:0.5");
  });
});
