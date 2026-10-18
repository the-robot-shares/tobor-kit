/**
 * `<tobor-llm-inference>` — the Lit twin of the Swift `LLMInferenceSettingsView`:
 * a 1:1 port of llm-toolkit's Settings page LLM section
 * (`packages/web/src/pages/Settings.tsx`, "LLM Inference"). Structure,
 * field order, and the provider-switch state machine follow the reference —
 *
 * 1. Header row: "LLM Inference" + status badge (green "<provider>
 *    connected" once a provider is selected, yellow "Not configured"
 *    otherwise — availability state, never a test round-trip result).
 * 2. Provider picker: None / ── Cloud Providers ── / ── Proxies & Local ──
 *    / ── Advanced ──. Switching clears the model list; None clears the
 *    config; Z.ai presets model `glm-5.3-flash` + coding-plan base URL;
 *    every other provider keeps only the API key.
 * 3. API Type picker (custom only). 4. Masked API Key + env-var hint.
 * 5. Base URL, inline, for ollama/litellm/custom/zai only. 6. Model:
 *    Fetch/Refresh models link, picker + free-text custom entry after the
 *    first fetch. 7. Test Connection box (prompt + Test + error/response
 *    boxes).
 *
 * Props down, events up (mirrors the Swift API): `config` in, `config`
 * detail on `config-change`; `transport` (a `fetch`-shaped function)
 * mirrors `HTTPTransporting`; `test-complete` reports the round trip. The
 * key lives only in the config object — never logged, never echoed.
 */

import { LitElement, css, html, nothing, type TemplateResult } from "lit";
import {property, state} from "lit/decorators.js";

import { toborKitControls, toborKitTokens } from "../mode-toggle/theme.js";
import { emit } from "../../events.js";
import {
  LLM_MODALITY_LABELS,
  LLM_PROVIDER_CATALOG,
  catalogModalities,
  effectiveAPIShape,
  effectiveBaseURL,
  envHint,
  providerByID,
  providerSupportsModality,
  providersByModality,
  resolveKey,
  showsBaseURL,
  type LLMInferenceConfigData,
  type LLMModality,
  type LLMProviderData,
} from "./catalog.js";
import {defineElement} from '../../define.js';

/** fetch-shaped transport seam — the TS mirror of `HTTPTransporting`. */
export type LLMTransport = (url: string, init: RequestInit) => Promise<Response>;

/** A completed Test Connection round trip. */
export interface LLMTestResult {
  ok: boolean;
  content?: string;
  error?: string;
}

export class LLMInferenceClient {
  constructor(
    private config: LLMInferenceConfigData,
    private catalog: LLMProviderData[] = LLM_PROVIDER_CATALOG,
    private transport: LLMTransport = (...args) => fetch(...args),
    private environment: Record<string, string> = {},
  ) {}

  private async send(url: URL, init: RequestInit): Promise<Record<string, unknown>> {
    const shape = effectiveAPIShape(this.config, this.catalog);
    const provider = providerByID(this.config.providerID, this.catalog);
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");
    if (provider?.requiresKey) {
      const key = resolveKey(this.config.apiKey, this.environment);
      if (!key) throw new Error(provider.envVarName ? `No API key — set it in settings or via ${provider.envVarName}.` : "No API key — add one in settings.");
      if (shape === "anthropic") {
        headers.set("x-api-key", key);
        headers.set("anthropic-version", "2023-06-01");
      } else {
        headers.set("Authorization", `Bearer ${key}`);
      }
    }
    const response = await this.transport(url.toString(), { ...init, headers });
    const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      throw new Error(`Request failed (${response.status}). Is the endpoint reachable and configured?`);
    }
    return body;
  }

  /** One user message, non-streaming — the Test Connection round trip. */
  async complete(prompt: string, maxTokens = 256): Promise<{ content: string; model: string }> {
    const base = effectiveBaseURL(this.config, this.catalog);
    if (!base) throw new Error("No base URL — set one in the advanced section.");
    const shape = effectiveAPIShape(this.config, this.catalog);
    const model = this.config.model || providerByID(this.config.providerID, this.catalog)?.defaultModel;
    if (!model || model === "model-name") throw new Error('No model — type one or click "Fetch models".');

    const url = new URL(shape === "anthropic" ? "messages" : "chat/completions", base.endsWith("/") ? base : `${base}/`);
    const body = await this.send(url, {
      method: "POST",
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const content =
      shape === "anthropic"
        ? ((body.content as Array<{ text?: string }> | undefined) ?? []).map((b) => b.text ?? "").join("")
        : ((body.choices as Array<{ message?: { content?: string } }> | undefined) ?? [])[0]?.message?.content ?? "";
    return { content, model: (body.model as string) ?? model };
  }

  /** `GET {base}/models`; returns model ids in endpoint order. */
  async models(): Promise<string[]> {
    const base = effectiveBaseURL(this.config, this.catalog);
    if (!base) throw new Error("No base URL — set one in the advanced section.");
    const url = new URL("models", base.endsWith("/") ? base : `${base}/`);
    const body = await this.send(url, { method: "GET" });
    return (((body.data as Array<{ id?: string }> | undefined) ?? []).map((m) => m.id).filter(Boolean)) as string[];
  }
}

@defineElement("tobor-llm-inference")
export class ToborLLMInference extends LitElement {
  static override styles = [
    toborKitTokens,
    toborKitControls,
    css`
      :host {
        display: block;
        font-size: 0.875em;
      }

      .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 12px;
      }
      .header h2 {
        margin: 0;
        font-size: 1em;
        font-weight: 500;
      }
      .badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        border-radius: 9999px;
        padding: 2px 10px;
        font-size: 0.8em;
        font-weight: 500;
      }
      .badge .dot {
        width: 6px;
        height: 6px;
        border-radius: 9999px;
      }
      .badge.ok {
        background: rgba(20, 120, 60, 0.25);
        color: #34d269;
      }
      .badge.warn {
        background: rgba(180, 140, 20, 0.25);
        color: #e8c545;
      }
      .badge.ok .dot { background: #34d269; }
      .badge.warn .dot { background: #e8c545; }

      label {
        display: block;
        font-size: 0.8em;
        margin-bottom: 4px;
        color: var(--_muted, #8a8f98);
      }
      select,
      input[type="text"],
      input[type="password"] {
        width: 100%;
        box-sizing: border-box;
        border-radius: 4px;
        padding: 6px 10px;
        font-size: 1em;
        border: 1px solid var(--_border, #2a2e35);
        background: var(--_canvas, #16181d);
        color: inherit;
      }
      select:focus,
      input:focus {
        outline: none;
        border-color: var(--_accent, #22d3ee);
      }

      .field {
        margin-bottom: 14px;
      }
      .hint {
        margin: 4px 0 0;
        font-size: 0.8em;
        color: var(--_dim, #6b7280);
      }
      .label-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 4px;
      }
      .link {
        background: none;
        border: none;
        padding: 0;
        font-size: 0.8em;
        color: var(--_accent, #22d3ee);
        cursor: pointer;
        text-decoration: underline;
      }
      .link:disabled {
        opacity: 0.5;
        cursor: default;
      }

      .test-box {
        border: 1px solid var(--_border, #2a2e35);
        border-radius: 6px;
        padding: 12px;
      }
      .test-row {
        display: flex;
        gap: 8px;
      }
      .test-row input {
        flex: 1;
      }
      .test-button {
        border: none;
        border-radius: 4px;
        padding: 6px 16px;
        font-size: 0.9em;
        font-weight: 500;
        cursor: pointer;
        background: var(--_accent, #22d3ee);
        color: #101216;
        white-space: nowrap;
      }
      .test-button:disabled {
        opacity: 0.5;
        cursor: default;
      }
      .error-box {
        border-radius: 4px;
        border: 1px solid rgba(200, 50, 50, 0.5);
        background: rgba(120, 20, 20, 0.25);
        padding: 8px 12px;
        margin-top: 10px;
        font-size: 0.85em;
        color: #f87171;
      }
      .response-box {
        border-radius: 4px;
        border: 1px solid var(--_border, #2a2e35);
        padding: 8px 12px;
        margin-top: 10px;
        white-space: pre-wrap;
      }
      .response-box .response-label {
        font-size: 0.8em;
        font-weight: 500;
        color: var(--_muted, #8a8f98);
        margin-bottom: 4px;
      }
    `,
  ];

  /** The persisted config; the host owns storage. Changes come back as
   * `config-change` events — the element never invents state. */
  @property({ attribute: false })
  config!: LLMInferenceConfigData;

  @property({ attribute: false })
  catalog: LLMProviderData[] = LLM_PROVIDER_CATALOG;

  /** Optional modality filter — only providers producing it are offered.
   * Unset (the default) offers the whole catalog, exactly as before. */
  @property({ type: String })
  modality?: LLMModality | null;

  /** Picker sectioning axis: deployment `group` (default, the historic
   * ── Cloud Providers ── / ── Proxies & Local ── / ── Advanced ──
   * headings) or `modality` (Text / Image / Audio / Speech / Video). */
  @property({ attribute: "section-by", type: String })
  sectionBy: "group" | "modality" = "group";

  /** fetch-shaped transport (tests stub it; the Swift mirror's
   * `HTTPTransporting` counterpart). */
  @property({ attribute: false })
  transport?: LLMTransport;

  /** Environment for env-var key resolution (call-time, never stored). */
  @property({ attribute: false })
  environment: Record<string, string> = {};

  @state() private availableModels: string[] = [];
  @state() private loadingModels = false;
  @state() private modelsError: string | null = null;
  @state() private testPrompt = "";
  @state() private testReply: string | null = null;
  @state() private testError: string | null = null;
  @state() private testing = false;
  @state() private draftKey = "";

  private get provider(): LLMProviderData | undefined {
    return providerByID(this.config.providerID, this.catalog);
  }

  private client(): LLMInferenceClient {
    return new LLMInferenceClient(this.config, this.catalog, this.transport, this.environment);
  }

  override render(): TemplateResult {
    const provider = this.provider;
    return html`
      <div class="header" data-testid="llm-header">
        <h2>LLM Inference</h2>
        ${this.config.providerID
          ? html`<span class="badge ok" data-testid="status-badge"><span class="dot"></span>${this.config.providerID} connected</span>`
          : html`<span class="badge warn" data-testid="status-badge"><span class="dot"></span>Not configured</span>`}
      </div>

      <div class="field">
        <label>Provider</label>
        <select data-testid="provider" @change=${this.onProviderChange}>
          <option value="" ?selected=${!this.config.providerID}>None</option>
          ${this.renderProviderOptions()}
        </select>
      </div>

      ${provider
        ? html`
            ${provider.id === "custom"
              ? html`<div class="field">
                  <label>API Type</label>
                  <select
                    data-testid="api-type"
                    @change=${(e: Event) =>
                      this.updateConfig({ apiShape: (e.target as HTMLSelectElement).value as "openai" | "anthropic" })}
                  >
                    <option value="openai" ?selected=${effectiveAPIShape(this.config, this.catalog) === "openai"}>
                      OpenAI-compatible
                    </option>
                    <option value="anthropic" ?selected=${effectiveAPIShape(this.config, this.catalog) === "anthropic"}>
                      Anthropic-compatible
                    </option>
                  </select>
                </div>`
              : nothing}

            ${provider.requiresKey
              ? html`<div class="field">
                  <label>API Key</label>
                  <input
                    type="password"
                    data-testid="api-key"
                    placeholder="Enter API key (or set via environment variable)"
                    .value=${this.draftKey}
                    @input=${this.onKeyInput}
                  />
                  ${envHint(provider)
                    ? html`<p class="hint">${envHint(provider)}</p>`
                    : provider.id === "custom"
                      ? html`<p class="hint">
                          The key is sent as the endpoint's auth header (Bearer, or x-api-key for Anthropic-shaped
                          endpoints).
                        </p>`
                      : nothing}
                </div>`
              : nothing}

            ${showsBaseURL(provider)
              ? html`<div class="field">
                  <label>Base URL</label>
                  <input
                    type="text"
                    data-testid="base-url"
                    placeholder=${provider.baseURLPlaceholder ?? "https://api.example.com/v1"}
                    .value=${this.config.baseURL ?? ""}
                    @input=${(e: Event) => this.updateConfig({ baseURL: (e.target as HTMLInputElement).value || null })}
                  />
                </div>`
              : nothing}

            <div class="field">
              <div class="label-row">
                <label>Model</label>
                <button
                  class="link"
                  data-testid="fetch-models"
                  ?disabled=${this.loadingModels}
                  @click=${this.fetchModels}
                >
                  ${this.loadingModels
                    ? "Loading..."
                    : this.availableModels.length > 0
                      ? "Refresh models"
                      : "Fetch models"}
                </button>
              </div>
              ${this.availableModels.length > 0
                ? html`
                    <select
                      data-testid="model-select"
                      @change=${(e: Event) =>
                        this.updateConfig({ model: (e.target as HTMLSelectElement).value || null })}
                    >
                      <option value="" ?selected=${!this.config.model}>
                        Default (${provider.defaultModel ?? "auto"})
                      </option>
                      ${this.availableModels.map(
                        (m) => html`<option value=${m} ?selected=${this.config.model === m}>${m}</option>`,
                      )}
                    </select>
                    <input
                      type="text"
                      data-testid="model-text"
                      placeholder="Or type a model name manually"
                      .value=${this.config.model ?? ""}
                      @input=${(e: Event) =>
                        this.updateConfig({ model: (e.target as HTMLInputElement).value || null })}
                    />
                    <p class="hint">
                      ${this.availableModels.length} model${this.availableModels.length === 1 ? "" : "s"} available.
                      Select from list or type a custom name.
                    </p>
                  `
                : html`
                    <input
                      type="text"
                      data-testid="model-text"
                      placeholder=${provider.defaultModel ?? "model-name"}
                      .value=${this.config.model ?? ""}
                      @input=${(e: Event) =>
                        this.updateConfig({ model: (e.target as HTMLInputElement).value || null })}
                    />
                    <p class="hint">
                      ${this.loadingModels
                        ? "Fetching available models..."
                        : 'Save settings and click "Fetch models" to populate the dropdown, or type a model name.'}
                    </p>
                  `}
              ${this.modelsError ? html`<p class="hint" data-testid="models-error">${this.modelsError}</p>` : nothing}
            </div>

            <div class="test-box" data-testid="test-connection">
              <div class="label-row">
                <label>Test Connection</label>
              </div>
              <div class="test-row">
                <input
                  type="text"
                  data-testid="test-prompt"
                  placeholder="Say hello in one sentence"
                  .value=${this.testPrompt}
                  @input=${(e: Event) => (this.testPrompt = (e.target as HTMLInputElement).value)}
                  @keydown=${(e: KeyboardEvent) => {
                    if (e.key === "Enter" && !this.testing) this.runTest();
                  }}
                />
                <button class="test-button" data-testid="test-button" ?disabled=${this.testing} @click=${this.runTest}>
                  ${this.testing ? "Sending..." : "Test"}
                </button>
              </div>
              ${this.testError ? html`<div class="error-box" data-testid="test-error">${this.testError}</div>` : nothing}
              ${this.testReply
                ? html`<div class="response-box" data-testid="test-response">
                    <div class="response-label">Response:</div>
                    ${this.testReply}
                  </div>`
                : nothing}
              <p class="hint">Save settings first, then send a test message to verify the provider is reachable.</p>
            </div>
          `
        : nothing}
    `;
  }

  /** Catalog after the optional modality filter (identity when unset). */
  private get visibleCatalog(): LLMProviderData[] {
    return this.modality ? providersByModality(this.modality, this.catalog) : this.catalog;
  }

  private providerOption(p: LLMProviderData): TemplateResult {
    return html`<option value=${p.id} ?selected=${this.config.providerID === p.id}>${p.label}</option>`;
  }

  /** Picker body: deployment-group sections (reference default) or modality
   * sections when the host opts in via `section-by="modality"`. */
  private renderProviderOptions(): TemplateResult[] {
    const catalog = this.visibleCatalog;
    if (this.sectionBy === "modality") {
      return catalogModalities(catalog).map(
        (m) => html`
          <option disabled>── ${LLM_MODALITY_LABELS[m]} ──</option>
          ${catalog.filter((p) => providerSupportsModality(p, m)).map((p) => this.providerOption(p))}
        `,
      );
    }
    return [
      html`
        <option disabled>── Cloud Providers ──</option>
        ${catalog.filter((p) => p.group === "cloud").map((p) => this.providerOption(p))}
        <option disabled>── Proxies & Local ──</option>
        ${catalog.filter((p) => p.group === "proxyLocal").map((p) => this.providerOption(p))}
        <option disabled>── Advanced ──</option>
        ${catalog.filter((p) => p.group === "advanced").map((p) => this.providerOption(p))}
      `,
    ];
  }

  /** The reference provider-switch state machine. */
  private onProviderChange(e: Event): void {
    const value = (e.target as HTMLSelectElement).value;
    this.availableModels = [];
    this.modelsError = null;
    if (!value) {
      this.updateConfig({
        providerID: "",
        baseURL: null,
        apiKey: null,
        model: null,
        apiShape: null,
      });
      return;
    }
    // Re-target env key specs; literal keys survive the switch.
    const apiKey =
      this.config.apiKey && !("literal" in this.config.apiKey)
        ? providerByID(value, this.catalog)?.envVarName
          ? { env: providerByID(value, this.catalog)!.envVarName! }
          : null
        : this.config.apiKey ?? null;
    if (value === "zai") {
      this.updateConfig({
        providerID: value,
        apiKey,
        model: "glm-5.3-flash",
        baseURL: "https://api.z.ai/api/coding/paas/v4",
        apiShape: null,
      });
    } else {
      this.updateConfig({ providerID: value, apiKey, model: null, baseURL: null, apiShape: null });
    }
  }

  private onKeyInput(e: Event): void {
    this.draftKey = (e.target as HTMLInputElement).value;
    const trimmed = this.draftKey.trim();
    const env = this.provider?.envVarName;
    this.updateConfig({ apiKey: trimmed ? { literal: trimmed } : env ? { env } : null });
  }

  private updateConfig(updates: Partial<LLMInferenceConfigData>): void {
    this.config = { ...this.config, ...updates };
    emit(this, "config-change", { config: this.config });
  }

  private async fetchModels(): Promise<void> {
    if (!this.config.providerID) return;
    this.loadingModels = true;
    this.modelsError = null;
    try {
      this.availableModels = await this.client().models();
    } catch (err) {
      this.availableModels = [];
      this.modelsError = err instanceof Error ? err.message : "Request failed";
    } finally {
      this.loadingModels = false;
    }
  }

  private async runTest(): Promise<void> {
    this.testing = true;
    this.testError = null;
    this.testReply = null;
    const prompt = this.testPrompt.trim() || "Say hello in one sentence";
    try {
      const reply = await this.client().complete(prompt);
      this.testReply = reply.content;
      emit(this, "test-complete", { ok: true, content: reply.content } satisfies LLMTestResult);
    } catch (err) {
      this.testError = err instanceof Error ? err.message : "Request failed — is the API running and LLM configured?";
      emit(this, "test-complete", { ok: false, error: this.testError } satisfies LLMTestResult);
    } finally {
      this.testing = false;
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tobor-llm-inference": ToborLLMInference;
  }
}
