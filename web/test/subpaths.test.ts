/**
 * Each subpath export must load and register its element standalone — a host
 * that imports only `@noizu/tobor-kit/robot-avatar.js` must not need the rest
 * of the kit. The Vite build emits one entry per subpath; this test imports
 * each source entry in isolation and asserts its public surface.
 */
import { expect } from "@open-wc/testing";

describe("subpath exports load standalone", () => {
  it("auth.js", async () => {const m = await import("../src/components/auth/noizu-auth.js");expect(customElements.get("noizu-auth")).to.equal(m.NoizuAuth);});
  it("guide-panel.js", async () => {
    const m = await import("../src/components/guide-panel/guide-panel.js");
    expect(m.ToborGuidePanel).to.exist;
    expect(customElements.get("tobor-guide-panel")).to.equal(m.ToborGuidePanel);
  });

  it("robot-avatar.js", async () => {
    const m = await import("../src/components/robot-avatar/robot-avatar.js");
    expect(m.ToborRobotAvatar).to.exist;
    expect(customElements.get("tobor-robot-avatar")).to.equal(m.ToborRobotAvatar);
  });

  it("footer-brand.js", async () => {
    const m = await import("../src/components/footer-brand/noizu-footer-brand.js");
    expect(m.NoizuFooterBrand).to.exist;
    expect(customElements.get("noizu-footer-brand")).to.equal(m.NoizuFooterBrand);
  });

  it("mode-toggle.js", async () => {
    const m = await import("../src/components/mode-toggle/mode-toggle.js");
    expect(m.ToborModeToggle).to.exist;
    expect(customElements.get("tobor-mode-toggle")).to.equal(m.ToborModeToggle);
  });

  it("voice-session.js", async () => {
    const m = await import("../src/components/voice-session/voice-session.js");
    expect(m.ToborVoiceSession).to.exist;
    expect(customElements.get("tobor-voice-session")).to.equal(m.ToborVoiceSession);
  });

  it("transcript-view.js", async () => {
    const m = await import("../src/components/transcript-view/transcript-view.js");
    expect(m.ToborTranscriptView).to.exist;
    expect(customElements.get("tobor-transcript-view")).to.equal(m.ToborTranscriptView);
  });

  it("task-menu.js", async () => {
    const m = await import("../src/components/task-menu/task-menu.js");
    expect(m.ToborTaskMenu).to.exist;
    expect(customElements.get("tobor-task-menu")).to.equal(m.ToborTaskMenu);
  });

  it("tool-list.js", async () => {
    const m = await import("../src/components/tool-list/tool-list.js");
    expect(m.ToborToolList).to.exist;
    expect(customElements.get("tobor-tool-list")).to.equal(m.ToborToolList);
  });

  it("login-flow.js", async () => {
    const m = await import("../src/components/login-flow/login-flow.js");
    expect(m.ToborLoginFlow).to.exist;
    expect(customElements.get("tobor-login-flow")).to.equal(m.ToborLoginFlow);
    expect(m.buildAuthorizeUrl).to.be.a("function");
    expect(m.completeLogin).to.be.a("function");
  });

  it("telemetry-toggle.js", async () => {
    const m = await import("../src/components/telemetry-toggle/telemetry-toggle.js");
    expect(m.ToborTelemetryToggle).to.exist;
    expect(customElements.get("tobor-telemetry-toggle")).to.equal(m.ToborTelemetryToggle);
  });

  it("client.js / voice.js / transcript-store.js", async () => {
    const client = await import("../src/client.js");
    expect(client.ToborKitClient).to.be.a("function");
    const voice = await import("../src/components/voice-session/index.js");
    expect(voice.createVoiceAdapter).to.be.a("function");
    expect(voice.connectOpenAIRealtime).to.be.a("function");
    const store = await import("../src/components/transcript-view/transcript-store.js");
    expect(store.createMemoryStore).to.be.a("function");
    expect(store.createLocalStore).to.be.a("function");
    expect(store.createBackendStore).to.be.a("function");
  });
});
