import { fixture, expect, html, waitUntil } from "@open-wc/testing";
import {
  buildAuthorizeUrl,
  codeChallenge,
  normalizeIssuer,
  parseCallback,
  randomVerifier,
  beginLogin,
  completeLogin,
} from "../../login-flow.js";
import "../../login-flow.js";
import { ToborLoginFlow } from "../../login-flow.js";
import type { GuideAuth } from "../../../../types.js";

const AUTH: GuideAuth = {
  required: true,
  provider: "authentik",
  issuer: "https://auth.derobot.is/application/o/tobor-kit/",
  client_id: "tobor-kit",
  scopes: ["openid", "email", "profile"],
  redirect_path: "/auth/oidc/callback",
};

class MemoryStorage implements Storage {
  #map = new Map<string, string>();
  get length() {
    return this.#map.size;
  }
  clear() {
    this.#map.clear();
  }
  getItem(k: string) {
    return this.#map.get(k) ?? null;
  }
  key(i: number) {
    return [...this.#map.keys()][i] ?? null;
  }
  removeItem(k: string) {
    this.#map.delete(k);
  }
  setItem(k: string, v: string) {
    this.#map.set(k, v);
  }
}

describe("OIDC PKCE helpers", () => {
  it("strips the trailing slash from issuers (Authentik per-provider quirk)", () => {
    expect(normalizeIssuer("https://auth.example.com/o/kit/")).to.equal("https://auth.example.com/o/kit");
    expect(normalizeIssuer("https://auth.example.com/o/kit")).to.equal("https://auth.example.com/o/kit");
  });

  it("generates url-safe verifiers of usable length", () => {
    const v = randomVerifier(64);
    expect(v).to.have.lengthOf(64);
    expect(v).to.match(/^[A-Za-z0-9_-]+$/);
    expect(randomVerifier(64)).to.not.equal(v);
  });

  it("derives an S256 challenge from the verifier", async () => {
    const challenge = await codeChallenge("test-verifier-value");
    expect(challenge).to.match(/^[A-Za-z0-9_-]+$/);
    // Deterministic for the same verifier.
    expect(await codeChallenge("test-verifier-value")).to.equal(challenge);
  });

  it("builds a spec-shaped authorize URL", () => {
    const url = new URL(
      buildAuthorizeUrl({
        issuer: AUTH.issuer!,
        clientId: AUTH.client_id!,
        redirectUri: "https://host.example/auth/oidc/callback",
        scopes: AUTH.scopes!,
        state: "s1",
        codeChallenge: "c1",
      }),
    );
    expect(url.origin).to.equal("https://auth.derobot.is");
    expect(url.pathname).to.equal("/application/o/tobor-kit/authorize");
    expect(url.searchParams.get("response_type")).to.equal("code");
    expect(url.searchParams.get("code_challenge_method")).to.equal("S256");
    expect(url.searchParams.get("scope")).to.equal("openid email profile");
  });

  it("parses callback query strings", () => {
    expect(parseCallback("?code=c&state=s")).to.deep.equal({ code: "c", state: "s" });
    expect(parseCallback("https://x/cb?code=c")).to.equal(null);
  });

  it("beginLogin stashes verifier + state for completeLogin", async () => {
    const storage = new MemoryStorage();
    const redirect = await beginLogin(AUTH, {
      redirectUri: "https://host.example/auth/oidc/callback",
      storage,
    });
    expect(redirect).to.not.equal(null);
    expect(storage.getItem("tobor-kit:pkce:state")).to.equal(redirect!.state);
    expect(storage.getItem("tobor-kit:pkce:verifier")).to.have.lengthOf(64);
    expect(redirect!.url).to.include("/authorize");
  });

  it("completeLogin exchanges the code with the stashed verifier", async () => {
    const storage = new MemoryStorage();
    const redirect = await beginLogin(AUTH, {
      redirectUri: "https://host.example/auth/oidc/callback",
      storage,
    });

    let body: URLSearchParams | null = null;
    const fetchImpl = (async (url: string, init: RequestInit = {}) => {
      expect(String(url)).to.equal("https://auth.derobot.is/application/o/tobor-kit/token");
      body = new URLSearchParams(String(init.body));
      return new Response(JSON.stringify({ access_token: "at", token_type: "Bearer" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as unknown as typeof fetch;

    const tokens = await completeLogin(AUTH, `?code=the-code&state=${redirect!.state}`, {
      redirectUri: "https://host.example/auth/oidc/callback",
      storage,
      fetchImpl: fetchImpl,
    });
    expect(tokens.access_token).to.equal("at");
    expect(body!.get("grant_type")).to.equal("authorization_code");
    expect(body!.get("code")).to.equal("the-code");
    // The stashed verifier was used (storage is one-shot and now cleared).
    expect(body!.get("code_verifier")).to.have.lengthOf(64);
    // One-shot: storage is cleared after success.
    expect(storage.getItem("tobor-kit:pkce:verifier")).to.equal(null);
  });

  it("completeLogin rejects a state mismatch", async () => {
    const storage = new MemoryStorage();
    await beginLogin(AUTH, { redirectUri: "https://host.example/cb", storage });
    let caught: unknown;
    try {
      await completeLogin(AUTH, "?code=c&state=wrong", {
        redirectUri: "https://host.example/cb",
        storage,
      });
    } catch (err) {
      caught = err;
    }
    expect((caught as Error).message).to.include("state mismatch");
  });
});

describe("tobor-login-flow element", () => {
  it("renders a sign-in button for OIDC guides", async () => {
    const el = await fixture<ToborLoginFlow>(html`<tobor-login-flow .auth=${AUTH}></tobor-login-flow>`);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[data-testid="login-button"]')).to.exist;
  });

  it("renders nothing when auth is not required / provider none", async () => {
    const el = await fixture<ToborLoginFlow>(
      html`<tobor-login-flow .auth=${{ required: false, provider: "none" }}></tobor-login-flow>`,
    );
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[data-testid="login-button"]')).to.not.exist;
  });

  it("emits tobor-auth-redirect with the authorize URL on click", async () => {
    const el = await fixture<ToborLoginFlow>(
      html`<tobor-login-flow .auth=${AUTH} .autoRedirect=${false}></tobor-login-flow>`,
    );
    let url: string | null = null;
    el.addEventListener("tobor-auth-redirect", (e) => (url = (e as CustomEvent).detail.url));
    (el.shadowRoot!.querySelector('[data-testid="login-button"]') as HTMLButtonElement).click();
    await waitUntil(() => url !== null, "redirect event fired");
    expect(url).to.include("/authorize");
    expect(url).to.include("code_challenge_method=S256");
  });
});
