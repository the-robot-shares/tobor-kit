/**
 * Vanilla mount for noizu-model-config.
 * Host: import '@noizu/tobor-kit/model-config';
 */
import '../../noizu-model-config.js';

/**
 * Mount <noizu-model-config>. Host-owned: persist events via the settings API.
 * Empty apiKey on custom-endpoint-save means keep stored. Never log the key.
 */
export function mountModelConfig(host, options = {}) {
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
    options.onModelChange?.(event.detail);
  });
  el.addEventListener('budget-change', (event) => {
    options.onBudgetChange?.(event.detail);
  });
  el.addEventListener('custom-endpoint-save', (event) => {
    options.onCustomEndpointSave?.(event.detail);
  });
  host.append(el);
  return el;
}
