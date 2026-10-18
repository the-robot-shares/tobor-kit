import { fixture, expect, html, waitUntil } from "@open-wc/testing";
import "../../llm-inference.js";
import { ToborLLMInference, type LLMTransport } from "../../llm-inference.js";
import {
  LLM_PROVIDER_CATALOG,
  catalogDeclaresModalities,
  catalogModalities,
  providerByID,
  providerModalities,
  providerSupportsModality,
  providersByModality,
  type LLMInferenceConfigData,
  type LLMProviderData,
} from "../../catalog.js";

/** A host catalog that declares the media axis. */
const MEDIA_CATALOG: LLMProviderData[] = [
  {
    id: "openai",
    label: "OpenAI",
    group: "cloud",
    apiShape: "openai",
    defaultBaseURL: "https://api.openai.com/v1",
    baseURLPlaceholder: null,
    envVarName: "OPENAI_API_KEY",
    requiresKey: true,
    defaultModel: "gpt-4o",
    modalities: ["text", "image"],
  },
  {
    id: "suno",
    label: "Suno",
    group: "cloud",
    apiShape: "openai",
    defaultBaseURL: "https://api.suno.ai/v1",
    baseURLPlaceholder: null,
    envVarName: "SUNO_API_KEY",
    requiresKey: true,
    defaultModel: "v6",
    modalities: ["audio"],
  },
  {
    id: "elevenlabs",
    label: "ElevenLabs",
    group: "cloud",
    apiShape: "openai",
    defaultBaseURL: "https://api.elevenlabs.io/v1",
    baseURLPlaceholder: null,
    envVarName: "ELEVENLABS_API_KEY",
    requiresKey: true,
    defaultModel: "eleven_v3",
    modalities: ["speech"],
  },
  {
    id: "runway",
    label: "Runway",
    group: "advanced",
    apiShape: "openai",
    defaultBaseURL: null,
    baseURLPlaceholder: "https://api.runwayml.com/v1",
    envVarName: null,
    requiresKey: true,
    defaultModel: "gen-4",
    modalities: ["video"],
  },
];

function optionRows(el: ToborLLMInference): string[] {
  return [...el.shadowRoot!.querySelectorAll<HTMLOptionElement>('[data-testid="provider"] option')].map((o) =>
    o.textContent!.trim(),
  );
}

const EMPTY: LLMInferenceConfigData = { providerID: "" };

function jsonTransport(body: unknown, status = 200): LLMTransport {
  return async () =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const completionBody = {
  model: "glm-5.3-flash",
  choices: [{ message: { role: "assistant", content: "Hello there." } }],
};

const modelsBody = { data: [{ id: "glm-5.3-flash" }, { id: "glm-4.5-air" }] };

describe("tobor-llm-inference", () => {
  it("renders the header with a Not configured badge when no provider is set", async () => {
    const el = await fixture<ToborLLMInference>(html`<tobor-llm-inference .config=${EMPTY}></tobor-llm-inference>`);
    await el.updateComplete;
    const badge = el.shadowRoot!.querySelector('[data-testid="status-badge"]')!;
    expect(badge.textContent!.trim()).to.equal("Not configured");
    // No provider → no key/model/test fields.
    expect(el.shadowRoot!.querySelector('[data-testid="api-key"]')).to.not.exist;
    expect(el.shadowRoot!.querySelector('[data-testid="test-connection"]')).to.not.exist;
  });

  it("shows the '<provider> connected' badge once a provider is selected", async () => {
    const el = await fixture<ToborLLMInference>(
      html`<tobor-llm-inference .config=${{ providerID: "zai", model: "glm-5.3-flash" }}></tobor-llm-inference>`,
    );
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[data-testid="status-badge"]')!.textContent!.trim()).to.equal(
      "zai connected",
    );
  });

  it("selecting Z.ai presets model + coding-plan base URL and keeps the key (reference switch machine)", async () => {
    const el = await fixture<ToborLLMInference>(
      html`<tobor-llm-inference .config=${{ providerID: "", apiKey: { env: "ZAI_API_KEY" } }}></tobor-llm-inference>`,
    );
    await el.updateComplete;
    const select = el.shadowRoot!.querySelector<HTMLSelectElement>('[data-testid="provider"]')!;
    select.value = "zai";
    select.dispatchEvent(new Event("change"));
    await el.updateComplete;
    expect(el.config.providerID).to.equal("zai");
    expect(el.config.model).to.equal("glm-5.3-flash");
    expect(el.config.baseURL).to.equal("https://api.z.ai/api/coding/paas/v4");
    expect(el.config.apiKey).to.deep.equal({ env: "ZAI_API_KEY" });
  });

  it("selecting None clears the whole config; switching providers drops model/base URL", async () => {
    const el = await fixture<ToborLLMInference>(
      html`<tobor-llm-inference .config=${{ providerID: "openai", model: "gpt-4o" }}></tobor-llm-inference>`,
    );
    await el.updateComplete;
    const select = el.shadowRoot!.querySelector<HTMLSelectElement>('[data-testid="provider"]')!;
    select.value = "anthropic";
    select.dispatchEvent(new Event("change"));
    await el.updateComplete;
    expect(el.config.providerID).to.equal("anthropic");
    expect(el.config.model).to.be.null;
    expect(el.config.baseURL).to.be.null;
    select.value = "";
    select.dispatchEvent(new Event("change"));
    await el.updateComplete;
    expect(el.config.providerID).to.equal("");
    expect(el.config.model).to.be.null;
  });

  it("shows the env-var hint for zai and the Base URL field only for ollama/litellm/custom/zai", async () => {
    const el = await fixture<ToborLLMInference>(
      html`<tobor-llm-inference .config=${{ providerID: "zai" }}></tobor-llm-inference>`,
    );
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[data-testid="api-key"]')).to.exist;
    expect(el.shadowRoot!.textContent!).to.include("Can also be set via ZAI_API_KEY environment variable.");
    expect(el.shadowRoot!.querySelector('[data-testid="base-url"]')).to.exist;

    el.config = { providerID: "openai" };
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[data-testid="base-url"]')).to.not.exist;

    el.config = { providerID: "ollama" };
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[data-testid="base-url"]')).to.exist;
    expect(el.shadowRoot!.querySelector('[data-testid="api-key"]')).to.not.exist;
  });

  it("shows API Type only for custom", async () => {
    const el = await fixture<ToborLLMInference>(
      html`<tobor-llm-inference .config=${{ providerID: "custom" }}></tobor-llm-inference>`,
    );
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[data-testid="api-type"]')).to.exist;
    el.config = { providerID: "groq" };
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[data-testid="api-type"]')).to.not.exist;
  });

  it("fetch models populates the picker + free text and the count caption", async () => {
    const el = await fixture<ToborLLMInference>(
      html`<tobor-llm-inference
        .config=${{ providerID: "zai", apiKey: { env: "ZAI_API_KEY" } }}
        .environment=${{ ZAI_API_KEY: "zk" }}
        .transport=${jsonTransport(modelsBody)}
      ></tobor-llm-inference>`,
    );
    await el.updateComplete;
    (el.shadowRoot!.querySelector('[data-testid="fetch-models"]') as HTMLButtonElement).click();
    // @ts-expect-error internal state, asserted for test diagnostics
    await waitUntil(() => !el.loadingModels, "models fetch settled");
    // @ts-expect-error internal state, asserted for test diagnostics
    expect(el.modelsError, el.modelsError ?? undefined).to.be.null;
    // @ts-expect-error internal state, asserted for test diagnostics
    expect(el.availableModels).to.deep.equal(["glm-5.3-flash", "glm-4.5-air"]);
    expect(el.shadowRoot!.querySelector('[data-testid="model-select"]')).to.exist;
    expect(el.shadowRoot!.textContent!).to.include("2 models available");
    expect(el.shadowRoot!.textContent!).to.include("Select from list or type a custom name.");
    expect(el.shadowRoot!.textContent!).to.include("Refresh models");
  });

  it("Test Connection sends the draft config and renders the response", async () => {
    const calls: string[] = [];
    const transport: LLMTransport = async (url) => {
      calls.push(url);
      return new Response(JSON.stringify(completionBody), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };
    const el = await fixture<ToborLLMInference>(
      html`<tobor-llm-inference
        .config=${{ providerID: "zai", apiKey: { literal: "zk" } }}
        .transport=${transport}
      ></tobor-llm-inference>`,
    );
    await el.updateComplete;
    const prompt = el.shadowRoot!.querySelector<HTMLInputElement>('[data-testid="test-prompt"]')!;
    prompt.value = "Hi";
    prompt.dispatchEvent(new Event("input"));
    (el.shadowRoot!.querySelector('[data-testid="test-button"]') as HTMLButtonElement).click();
    await waitUntil(() => el.shadowRoot!.querySelector('[data-testid="test-response"]'), "test response rendered");
    expect(calls[0]).to.equal("https://api.z.ai/api/coding/paas/v4/chat/completions");
    expect(el.shadowRoot!.querySelector('[data-testid="test-response"]')!.textContent).to.include("Hello there.");
  });

  it("modality defaults to text for every descriptor that declares none", () => {
    expect(catalogDeclaresModalities()).to.equal(false);
    for (const provider of LLM_PROVIDER_CATALOG) {
      expect(providerModalities(provider)).to.deep.equal(["text"]);
      expect(providerSupportsModality(provider, "text")).to.equal(true);
      expect(providerSupportsModality(provider, "image")).to.equal(false);
    }
    expect(catalogModalities()).to.deep.equal(["text"]);
    expect(providersByModality("text").length).to.equal(LLM_PROVIDER_CATALOG.length);
    expect(providersByModality("video")).to.deep.equal([]);
    // Explicit empty / null behave as absent.
    expect(providerModalities({ ...LLM_PROVIDER_CATALOG[0], modalities: [] })).to.deep.equal(["text"]);
    expect(providerModalities({ ...LLM_PROVIDER_CATALOG[0], modalities: null })).to.deep.equal(["text"]);
    expect(providerModalities(undefined)).to.deep.equal(["text"]);
  });

  it("a catalog without modalities renders the historic group sections unchanged", async () => {
    const el = await fixture<ToborLLMInference>(html`<tobor-llm-inference .config=${EMPTY}></tobor-llm-inference>`);
    await el.updateComplete;
    const rows = optionRows(el);
    expect(rows[0]).to.equal("None");
    expect(rows[1]).to.equal("── Cloud Providers ──");
    expect(rows).to.include("── Proxies & Local ──");
    expect(rows).to.include("── Advanced ──");
    expect(rows.length).to.equal(1 + 3 + LLM_PROVIDER_CATALOG.length);
  });

  it("a media catalog sections by modality when the host opts in", async () => {
    const el = await fixture<ToborLLMInference>(
      html`<tobor-llm-inference
        .config=${EMPTY}
        .catalog=${MEDIA_CATALOG}
        section-by="modality"
      ></tobor-llm-inference>`,
    );
    await el.updateComplete;
    expect(optionRows(el)).to.deep.equal([
      "None",
      "── Text ──",
      "OpenAI",
      "── Image ──",
      "OpenAI",
      "── Audio ──",
      "Suno",
      "── Speech ──",
      "ElevenLabs",
      "── Video ──",
      "Runway",
    ]);
  });

  it("the modality property filters the picker, group sectioning intact", async () => {
    const el = await fixture<ToborLLMInference>(
      html`<tobor-llm-inference .config=${EMPTY} .catalog=${MEDIA_CATALOG} modality="video"></tobor-llm-inference>`,
    );
    await el.updateComplete;
    expect(optionRows(el)).to.deep.equal([
      "None",
      "── Cloud Providers ──",
      "── Proxies & Local ──",
      "── Advanced ──",
      "Runway",
    ]);
  });

  it("round-trips a JSON catalog payload that predates the modalities field", () => {
    const payload = JSON.stringify(LLM_PROVIDER_CATALOG);
    expect(payload).to.not.contain("modalities");
    const restored = JSON.parse(payload) as LLMProviderData[];
    expect(restored.map((p) => p.id)).to.deep.equal(LLM_PROVIDER_CATALOG.map((p) => p.id));
    for (const provider of restored) {
      expect(provider.modalities).to.equal(undefined);
      expect(providerModalities(provider)).to.deep.equal(["text"]);
    }
    expect(providerByID("zai", restored)!.defaultModel).to.equal("glm-5.3-flash");
    // A payload that does carry the field survives the trip too.
    const media = JSON.parse(JSON.stringify(MEDIA_CATALOG)) as LLMProviderData[];
    expect(providerModalities(providerByID("suno", media))).to.deep.equal(["audio"]);
  });

  it("renders a failed test as an error box", async () => {
    const el = await fixture<ToborLLMInference>(
      html`<tobor-llm-inference
        .config=${{ providerID: "zai" }}
        .transport=${jsonTransport({}, 401)}
      ></tobor-llm-inference>`,
    );
    await el.updateComplete;
    (el.shadowRoot!.querySelector('[data-testid="test-button"]') as HTMLButtonElement).click();
    await waitUntil(() => el.shadowRoot!.querySelector('[data-testid="test-error"]'), "error box rendered");
  });
});
