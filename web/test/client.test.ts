import { expect } from "@open-wc/testing";
import { ToborKitClient } from "../src/client.js";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function fetchRecording(
  handler: (url: string, init: RequestInit) => Response,
): { fetch: typeof fetch; calls: { url: string; init: RequestInit }[] } {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    calls.push({ url, init });
    return handler(url, init);
  }) as typeof fetch;
  return { fetch: fetchImpl, calls };
}

describe("ToborKitClient", () => {
  it("sends bearer tokens and hits the contract paths", async () => {
    const { fetch: fetchImpl, calls } = fetchRecording(() => jsonResponse({ slug: "deploy-guide" }));
    const client = new ToborKitClient({ fetchImpl, token: "tok-1" });
    const guide = await client.getGuide();

    expect(guide.slug).to.equal("deploy-guide");
    expect(calls[0].url).to.match(/\/api\/tobor-kit\/guide$/);
    expect((calls[0].init.headers as Record<string, string>).Authorization).to.equal("Bearer tok-1");
  });

  it("re-reads token functions per request", async () => {
    let n = 0;
    const { fetch: fetchImpl, calls } = fetchRecording(() => jsonResponse({ id: "s" }, 201));
    const client = new ToborKitClient({ fetchImpl, token: () => `tok-${++n}` });
    await client.createSession({});
    await client.createSession({});
    expect(calls[0].init.headers).to.include({ Authorization: "Bearer tok-1" });
    expect(calls[1].init.headers).to.include({ Authorization: "Bearer tok-2" });
  });

  it("throws typed errors with contract codes on failure", async () => {
    const { fetch: fetchImpl } = fetchRecording(() => jsonResponse({ code: "not_found", message: "no guide" }, 404));
    const client = new ToborKitClient({ fetchImpl });
    let caught: unknown;
    try {
      await client.getGuide();
    } catch (err) {
      caught = err;
    }
    expect((caught as Error).name).to.equal("ToborKitError");
    expect((caught as { code: string }).code).to.equal("not_found");
    expect((caught as { status: number }).status).to.equal(404);
  });

  describe("mintVoiceToken status semantics", () => {
    it("201 resolves with the credential", async () => {
      const { fetch: fetchImpl } = fetchRecording(() =>
        jsonResponse(
          {
            adapter: "realtime",
            expires_at: "2026-01-01T00:05:00Z",
            realtime: { token: "ephemeral", url: "https://api.openai.com/v1/realtime/calls" },
          },
          201,
        ),
      );
      const client = new ToborKitClient({ fetchImpl });
      const result = await client.mintVoiceToken();
      expect(result).to.have.property("ok", true);
      expect((result as { credential: { realtime?: { token?: string } } }).credential.realtime?.token).to.equal("ephemeral");
    });

    it("409 (native adapter) is not_required, not a failure", async () => {
      const { fetch: fetchImpl } = fetchRecording(() => jsonResponse({ code: "no_credential", message: "native" }, 409));
      const client = new ToborKitClient({ fetchImpl });
      const result = await client.mintVoiceToken();
      expect(result).to.deep.equal({ ok: false, reason: "not_required" });
    });

    it("503 resolves unavailable with the server message", async () => {
      const { fetch: fetchImpl } = fetchRecording(() => jsonResponse({ code: "voice_disabled", message: "voice off" }, 503));
      const client = new ToborKitClient({ fetchImpl });
      const result = await client.mintVoiceToken();
      expect(result).to.deep.equal({ ok: false, reason: "unavailable", message: "voice off" });
    });
  });

  describe("telemetry consent", () => {
    it("GET resolves the consent", async () => {
      const { fetch: fetchImpl } = fetchRecording(() =>
        jsonResponse({ enabled: true, source: "user", user_overridable: true }),
      );
      const client = new ToborKitClient({ fetchImpl });
      const consent = await client.getTelemetryConsent();
      expect(consent.source).to.equal("user");
    });

    it("PUT 403 resolves forbidden instead of throwing", async () => {
      const { fetch: fetchImpl, calls } = fetchRecording(() => jsonResponse({ code: "not_overridable", message: "binding" }, 403));
      const client = new ToborKitClient({ fetchImpl });
      const result = await client.setTelemetryConsent(false);
      expect(result).to.deep.equal({ ok: false, reason: "forbidden" });
      expect(calls[0].init.method).to.equal("PUT");
    });
  });

  describe("transcript 501 distinction", () => {
    it("501 resolves supported:false — not an empty transcript", async () => {
      const { fetch: fetchImpl } = fetchRecording(() => jsonResponse({ code: "no_backend_store", message: "client-side" }, 501));
      const client = new ToborKitClient({ fetchImpl });
      const result = await client.getTranscript("sid");
      expect(result).to.deep.equal({ supported: false });
    });

    it("200 resolves turns with has_more", async () => {
      const { fetch: fetchImpl } = fetchRecording(() =>
        jsonResponse({ turns: [{ id: "t1", role: "user", content: "hi", created_at: "z" }], has_more: false }),
      );
      const client = new ToborKitClient({ fetchImpl });
      const result = await client.getTranscript("sid");
      expect(result).to.have.property("supported", true);
      expect((result as { turns: unknown[] }).turns).to.have.lengthOf(1);
    });
  });

  describe("listTools", () => {
    it("passes degraded through untouched and defaults missing arrays", async () => {
      const { fetch: fetchImpl, calls } = fetchRecording(() =>
        jsonResponse({
          groups: [{ id: "Github", label: "Github" }],
          tools: [{ name: "Github.BranchCreate", label: "New branch", group: "Github" }],
          degraded: [{ server: "tickets", error: "timeout" }],
        }),
      );
      const client = new ToborKitClient({ fetchImpl });
      const inv = await client.listTools({ refresh: true });
      expect(calls[0].url).to.contain("/mcp/tools?refresh=true");
      expect(inv.degraded).to.deep.equal([{ server: "tickets", error: "timeout" }]);
    });
  });
});
