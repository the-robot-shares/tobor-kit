/**
 * Typed mount for noizu-model-config.
 * Host: import '@noizu/tobor-kit/model-config';
 */
import '../../noizu-model-config.js';
import type {
  BudgetChangeDetail,
  CustomEndpoint,
  CustomEndpointSaveDetail,
  ModelCatalogEntry,
  ModelChangeDetail,
} from '../../noizu-model-config.js';

export interface MountModelConfigOptions {
  catalog?: ModelCatalogEntry[];
  catalogUrl?: string;
  value?: string;
  inherit?: boolean;
  allowCustom?: boolean;
  allowBudget?: boolean;
  budget?: number;
  customEndpoint?: CustomEndpoint;
  onModelChange?: (detail: ModelChangeDetail) => void;
  onBudgetChange?: (detail: BudgetChangeDetail) => void;
  /** Host persists. Empty detail.apiKey = keep stored. Never log apiKey. */
  onCustomEndpointSave?: (detail: CustomEndpointSaveDetail) => void;
}

/**
 * Mount <noizu-model-config>. Host-owned: persist via settings API (TRK
 * GET/PATCH /api/v1/ai/settings is an example, not a kit dependency).
 */
export function mountModelConfig(
  host: HTMLElement,
  options: MountModelConfigOptions = {},
): HTMLElementTagNameMap['noizu-model-config'] {
  const el = document.createElement('noizu-model-config');
  el.catalog = options.catalog ?? [
    {provider: 'openai', model: 'gpt-4o', label: 'GPT-4o'},
    {provider: 'anthropic', model: 'claude-3-5', label: 'Claude 3.5'},
  ];
  if (options.catalogUrl) el.catalogUrl = options.catalogUrl;
  el.value = options.value ?? 'openai:gpt-4o';
  el.inherit = options.inherit ?? true;
  el.allowCustom = options.allowCustom ?? true;
  el.allowBudget = options.allowBudget ?? true;
  if (options.budget != null) el.budget = options.budget;
  if (options.customEndpoint) el.customEndpoint = options.customEndpoint;
  el.addEventListener('model-change', (event) => {
    options.onModelChange?.((event as CustomEvent<ModelChangeDetail>).detail);
  });
  el.addEventListener('budget-change', (event) => {
    options.onBudgetChange?.((event as CustomEvent<BudgetChangeDetail>).detail);
  });
  el.addEventListener('custom-endpoint-save', (event) => {
    options.onCustomEndpointSave?.((event as CustomEvent<CustomEndpointSaveDetail>).detail);
  });
  host.append(el);
  return el;
}
