import { fixture, expect, html, waitUntil } from "@open-wc/testing";
import "../../telemetry-toggle.js";
import { ToborTelemetryToggle } from "../../telemetry-toggle.js";
import { ToborKitClient } from "../../../../client.js";
import type { TelemetryConsent } from "../../../../types.js";

const CONSENTS: Record<string, TelemetryConsent> = {
  userOn: { enabled: true, source: "user", user_overridable: true },
  userOff: { enabled: false, source: "user", user_overridable: true },
  forcedOn: { enabled: true, source: "forced", user_overridable: false },
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("tobor-telemetry-toggle", () => {
  it("renders NOTHING when consent is forced", async () => {
    const el = await fixture<ToborTelemetryToggle>(
      html`<tobor-telemetry-toggle .consent=${CONSENTS.forcedOn}></tobor-telemetry-toggle>`,
    );
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[data-testid="telemetry-toggle"]')).to.not.exist;
    expect(el.shadowRoot!.textContent!.trim()).to.equal("");
  });

  it("renders an actionable toggle for user-overridable consent", async () => {
    const el = await fixture<ToborTelemetryToggle>(
      html`<tobor-telemetry-toggle .consent=${CONSENTS.userOn}></tobor-telemetry-toggle>`,
    );
    await el.updateComplete;
    const box = el.shadowRoot!.querySelector<HTMLInputElement>('[data-testid="telemetry-toggle"]')!;
    expect(box).to.exist;
    expect(box.checked).to.be.true;
  });

  it("fetches consent from the client on connect", async () => {
    const fetchImpl = (async () => jsonResponse(CONSENTS.userOff)) as typeof fetch;
    const client = new ToborKitClient({ fetchImpl });
    const el = await fixture<ToborTelemetryToggle>(
      html`<tobor-telemetry-toggle .client=${client}></tobor-telemetry-toggle>`,
    );
    await waitUntil(() => el.consent, "consent loaded");
    const box = el.shadowRoot!.querySelector<HTMLInputElement>('[data-testid="telemetry-toggle"]')!;
    expect(box.checked).to.be.false;
  });

  it("PUTs the flipped preference and reports the new consent", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchImpl = (async (url: string, init: RequestInit = {}) => {
      calls.push({ url, init });
      return jsonResponse({ ...CONSENTS.userOff, enabled: true }, 200);
    }) as unknown as typeof fetch;
    const client = new ToborKitClient({ fetchImpl });
    const el = await fixture<ToborTelemetryToggle>(
      html`<tobor-telemetry-toggle .client=${client} .consent=${CONSENTS.userOff}></tobor-telemetry-toggle>`,
    );
    await el.updateComplete;

    let event: CustomEvent | null = null;
    el.addEventListener("tobor-telemetry-change", (e) => (event = e as CustomEvent));

    const box = el.shadowRoot!.querySelector<HTMLInputElement>('[data-testid="telemetry-toggle"]')!;
    box.click();
    await el.updateComplete;
    await waitUntil(() => event !== null);

    expect(calls).to.have.lengthOf(1);
    expect(calls[0].init.method).to.equal("PUT");
    expect(JSON.parse(String(calls[0].init.body))).to.deep.equal({ enabled: true });
    expect((event as unknown as CustomEvent).detail.consent.enabled).to.be.true;
  });

  it("goes inert (renders nothing) after a 403", async () => {
    const fetchImpl = (async () => jsonResponse({ code: "not_overridable", message: "binding" }, 403)) as typeof fetch;
    const client = new ToborKitClient({ fetchImpl });
    const el = await fixture<ToborTelemetryToggle>(
      html`<tobor-telemetry-toggle .client=${client} .consent=${CONSENTS.userOn}></tobor-telemetry-toggle>`,
    );
    await el.updateComplete;
    const box = el.shadowRoot!.querySelector<HTMLInputElement>('[data-testid="telemetry-toggle"]')!;
    box.click();
    await el.updateComplete;
    await waitUntil(() => !el.overridable);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[data-testid="telemetry-toggle"]')).to.not.exist;
    expect(el.consent?.source).to.equal("forced");
  });
});
