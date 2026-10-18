/**
 * Declarative playground schema consumed by `tobor-configurator` (planned)
 * and by host catalogs. Each family exports `configurator` (and optionally
 * `configurators`) from `web/src/components/<slug>/configurator.ts`.
 *
 * Shape is frozen here — do not fork it in family files. See docs/CONVENTIONS.md.
 */

export type ConfiguratorFieldType =
  | 'string'
  | 'text'
  | 'number'
  | 'boolean'
  | 'select'
  | 'multiselect'
  | 'color'
  | 'url'
  | 'tag-list'
  | 'json';

export type ConfiguratorGroup = 'agent' | 'island' | 'input' | 'display' | 'auth';

export type ConfiguratorBackend = 'none' | 'elixir' | 'go' | 'voice' | 'external' | 'auth';

export interface ConfiguratorField {
  attr: string;
  type: ConfiguratorFieldType;
  required?: boolean;
  uneditable?: boolean;
  default?: unknown;
  options?: string[];
  placeholder?: string;
  group?: string;
  /** True when the value is a JS property, not a reflected HTML attribute. */
  propertyOnly?: boolean;
  description?: string;
}

export interface ConfiguratorEvent {
  name: string;
  detail?: string;
  description?: string;
}

export interface ConfiguratorCssVariable {
  name: string;
  default?: string;
  description?: string;
}

export interface ConfiguratorMethod {
  name: string;
  args?: string;
  description?: string;
}

export interface ConfiguratorSchema {
  tag: string;
  group: ConfiguratorGroup;
  importPath: string;
  demoHtml: string;
  backend: ConfiguratorBackend;
  fields: ConfiguratorField[];
  slots?: string[];
  events?: ConfiguratorEvent[];
  cssVariables?: ConfiguratorCssVariable[];
  methods?: ConfiguratorMethod[];
}
