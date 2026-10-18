/**
 * LLM Inference provider catalog — the TypeScript twin of
 * `swift/LLMProvider.swift`, both ported 1:1 from llm-toolkit's Settings
 * page (`packages/web/src/pages/Settings.tsx`, "LLM Inference" section):
 * `ENV_KEY_NAMES` → `envVarName`, `MODEL_PLACEHOLDERS` → `defaultModel`,
 * `BASE_URL_PLACEHOLDERS` → `baseURLPlaceholder`, `llmNeedsKey` →
 * `requiresKey`, `llmNeedsBaseUrl` → `showsBaseURL`.
 */

export type LLMApiShape = "openai" | "anthropic";

/**
 * What a provider *produces* — a second, orthogonal axis to `group` (which
 * says where a provider runs: cloud / proxyLocal / advanced). Optional on
 * the descriptor: an entry that declares nothing is `text`, so every
 * pre-modality catalog keeps its exact behaviour.
 */
export type LLMModality = "text" | "image" | "audio" | "speech" | "video";

/** Canonical order — picker sections render in this order. */
export const LLM_MODALITIES: LLMModality[] = ["text", "image", "audio", "speech", "video"];

/** Section headings for modality-sectioned pickers (mirrors the group rules). */
export const LLM_MODALITY_LABELS: Record<LLMModality, string> = {
  text: "Text",
  image: "Image",
  audio: "Audio",
  speech: "Speech",
  video: "Video",
};

/** The default every descriptor without `modalities` carries. */
export const LLM_DEFAULT_MODALITIES: LLMModality[] = ["text"];

export type LLMKeySpec = { env: string } | { literal: string };

/** Persisted settings — same fields (JSON spelling) as `LLMInferenceConfig`. */
export interface LLMInferenceConfigData {
  providerID: string;
  baseURL?: string | null;
  apiKey?: LLMKeySpec | null;
  model?: string | null;
  /** Only meaningful for `custom` (whose shape nothing pins). */
  apiShape?: LLMApiShape | null;
}

export interface LLMProviderData {
  id: string;
  label: string;
  group: "cloud" | "proxyLocal" | "advanced";
  /** Pinned wire shape; null only for `custom` (user-picked). */
  apiShape: LLMApiShape | null;
  defaultBaseURL: string | null;
  /** Hint shown in the empty Base URL field; presence = field renders. */
  baseURLPlaceholder: string | null;
  envVarName: string | null;
  requiresKey: boolean;
  defaultModel: string | null;
  /**
   * What this provider generates. Optional and additive: absent, null, or
   * empty means `["text"]` — the pre-modality behaviour. Orthogonal to
   * `group`; a provider may declare several.
   */
  modalities?: LLMModality[] | null;
}

export const LLM_PROVIDER_CATALOG: LLMProviderData[] = [
  // ── Cloud Providers ──
  {
    id: "anthropic",
    label: "Anthropic (Claude)",
    group: "cloud",
    apiShape: "anthropic",
    defaultBaseURL: "https://api.anthropic.com/v1",
    baseURLPlaceholder: null,
    envVarName: "ANTHROPIC_API_KEY",
    requiresKey: true,
    defaultModel: "claude-sonnet-4-20250514",
  },
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
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    group: "cloud",
    apiShape: "openai",
    defaultBaseURL: "https://api.deepseek.com/v1",
    baseURLPlaceholder: null,
    envVarName: "DEEPSEEK_API_KEY",
    requiresKey: true,
    defaultModel: "deepseek-chat",
  },
  {
    id: "groq",
    label: "Groq",
    group: "cloud",
    apiShape: "openai",
    defaultBaseURL: "https://api.groq.com/openai/v1",
    baseURLPlaceholder: null,
    envVarName: "GROQ_API_KEY",
    requiresKey: true,
    defaultModel: "llama-3.3-70b",
  },
  {
    id: "cerebras",
    label: "Cerebras",
    group: "cloud",
    apiShape: "openai",
    defaultBaseURL: "https://api.cerebras.ai/v1",
    baseURLPlaceholder: null,
    envVarName: "CEREBRAS_API_KEY",
    requiresKey: true,
    defaultModel: "llama-3.3-70b",
  },
  {
    id: "zai",
    label: "Z.ai (Zhipu/GLM)",
    group: "cloud",
    apiShape: "openai",
    defaultBaseURL: "https://api.z.ai/api/coding/paas/v4",
    baseURLPlaceholder: "https://api.z.ai/api/coding/paas/v4",
    envVarName: "ZAI_API_KEY",
    requiresKey: true,
    defaultModel: "glm-5.3-flash",
  },
  // ── Proxies & Local ──
  {
    id: "litellm",
    label: "LiteLLM Proxy",
    group: "proxyLocal",
    apiShape: "openai",
    defaultBaseURL: "https://inference.noizu.com/v1",
    baseURLPlaceholder: "https://inference.noizu.com/v1",
    envVarName: "LITELLM_API_KEY",
    requiresKey: true,
    defaultModel: "claude-sonnet-4-6",
  },
  {
    id: "ollama",
    label: "Ollama (Local)",
    group: "proxyLocal",
    apiShape: "openai",
    defaultBaseURL: "http://localhost:11434",
    baseURLPlaceholder: "http://localhost:11434",
    envVarName: null,
    requiresKey: false,
    defaultModel: "llama3",
  },
  // ── Advanced ──
  {
    id: "custom",
    label: "Custom Endpoint",
    group: "advanced",
    apiShape: null,
    defaultBaseURL: null,
    baseURLPlaceholder: "https://api.example.com/v1",
    envVarName: null,
    requiresKey: true,
    defaultModel: "model-name",
  },
];

export function providerByID(
  id: string,
  catalog: LLMProviderData[] = LLM_PROVIDER_CATALOG,
): LLMProviderData | undefined {
  return catalog.find((p) => p.id === id);
}

/** A provider's modalities, defaulted: absent / null / empty ⇒ `["text"]`. */
export function providerModalities(provider: LLMProviderData | undefined): LLMModality[] {
  const declared = provider?.modalities;
  return declared && declared.length > 0 ? declared : LLM_DEFAULT_MODALITIES;
}

/** Whether a provider produces the given modality (text by default). */
export function providerSupportsModality(provider: LLMProviderData | undefined, modality: LLMModality): boolean {
  return providerModalities(provider).includes(modality);
}

/** Catalog slice for one modality, in catalog order. */
export function providersByModality(
  modality: LLMModality,
  catalog: LLMProviderData[] = LLM_PROVIDER_CATALOG,
): LLMProviderData[] {
  return catalog.filter((p) => providerSupportsModality(p, modality));
}

/** Whether any entry declares modalities — i.e. sectioning by them is meaningful. */
export function catalogDeclaresModalities(catalog: LLMProviderData[] = LLM_PROVIDER_CATALOG): boolean {
  return catalog.some((p) => (p.modalities?.length ?? 0) > 0);
}

/** Modalities present in a catalog, in `LLM_MODALITIES` order. */
export function catalogModalities(catalog: LLMProviderData[] = LLM_PROVIDER_CATALOG): LLMModality[] {
  return LLM_MODALITIES.filter((m) => catalog.some((p) => providerSupportsModality(p, m)));
}

/** Provider's pinned shape wins; the config pick applies to `custom` only. */
export function effectiveAPIShape(
  config: LLMInferenceConfigData,
  catalog: LLMProviderData[] = LLM_PROVIDER_CATALOG,
): LLMApiShape {
  return providerByID(config.providerID, catalog)?.apiShape ?? config.apiShape ?? "openai";
}

/** Endpoint the config resolves to: override, else the catalog default. */
export function effectiveBaseURL(
  config: LLMInferenceConfigData,
  catalog: LLMProviderData[] = LLM_PROVIDER_CATALOG,
): string | null {
  return config.baseURL || providerByID(config.providerID, catalog)?.defaultBaseURL || null;
}

/** Reference `llmNeedsBaseUrl`: field renders for these providers only. */
export function showsBaseURL(provider: LLMProviderData): boolean {
  return provider.baseURLPlaceholder != null;
}

/** Key the requests authenticate with, or null when unset. */
export function resolveKey(
  spec: LLMKeySpec | null | undefined,
  environment: Record<string, string> = {},
): string | null {
  if (!spec) return null;
  if ("env" in spec) return environment[spec.env] || null;
  return spec.literal || null;
}

/** The reference's env-var hint under the API Key field. */
export function envHint(provider: LLMProviderData | undefined): string | null {
  return provider?.envVarName ? `Can also be set via ${provider.envVarName} environment variable.` : null;
}
