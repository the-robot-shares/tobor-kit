// Host apps: import '@noizu/tobor-kit/configurator.js' for types + side effect.
import '../../tobor-configurator.js';
import type {
  ConfiguratorApplyDetail,
  ConfiguratorSchema,
  ToborConfigurator,
} from '../../tobor-configurator.js';

export const demoSchema: ConfiguratorSchema = {
  tag: 'demo-widget',
  group: 'display',
  importPath: 'demo-widget.js',
  demoHtml: '<demo-widget label="Hello" tone="info"></demo-widget>',
  backend: 'none',
  fields: [
    {attr: 'label', type: 'string', required: true, default: 'Hello'},
    {attr: 'note', type: 'text', placeholder: 'Longer copy'},
    {attr: 'count', type: 'number', default: 1},
    {attr: 'enabled', type: 'boolean', default: false},
    {attr: 'tone', type: 'select', options: ['info', 'warn', 'danger'], default: 'info'},
    {attr: 'flags', type: 'multiselect', options: ['alpha', 'beta'], default: ['alpha']},
    {attr: 'accent', type: 'color', default: '#6ee7c7'},
    {attr: 'docs', type: 'url', placeholder: 'https://example.com'},
    {attr: 'tags', type: 'tag-list', default: ['demo']},
    {attr: 'meta', type: 'json', propertyOnly: true, default: {k: 1}},
    {attr: 'id', type: 'string', uneditable: true, default: 'demo-1'},
  ],
  slots: ['default'],
};

export interface MountConfiguratorOptions {
  schema?: ConfiguratorSchema;
  schemaSrc?: string;
  onChange?: (detail: ConfiguratorApplyDetail) => void;
  onApply?: (detail: ConfiguratorApplyDetail) => void;
}

/**
 * Mount <tobor-configurator> and listen for configurator-change / configurator-apply.
 * Host-owned: insert detail on apply. No secrets.
 */
export function mountConfigurator(
  host: HTMLElement,
  options: MountConfiguratorOptions = {},
): ToborConfigurator {
  const el = document.createElement('tobor-configurator');
  el.schema = options.schema ?? demoSchema;
  if (options.schemaSrc) el.schemaSrc = options.schemaSrc;
  el.addEventListener('configurator-change', (event) => {
    options.onChange?.(event.detail);
  });
  el.addEventListener('configurator-apply', (event) => {
    host.dataset.tag = event.detail.tag;
    options.onApply?.(event.detail);
  });
  host.append(el);
  return el;
}
