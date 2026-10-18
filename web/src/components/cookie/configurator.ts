import type {ConfiguratorSchema} from '../../configurator-schema.js';

export const consent: ConfiguratorSchema = {
  tag: 'noizu-cookie-consent',
  group: 'island',
  importPath: 'components/cookie/noizu-cookie-consent.js',
  demoHtml:
    '<noizu-cookie-settings>Cookie Settings</noizu-cookie-settings><noizu-cookie-consent storage-key="start-app.cookie-consent.v1" mode="categories"></noizu-cookie-consent>',
  backend: 'none',
  fields: [
    {
      attr: 'storage-key',
      type: 'string',
      default: 'start-app.cookie-consent.v1',
      description: 'localStorage key for the consent JSON',
    },
    {
      attr: 'mode',
      type: 'select',
      options: ['categories', 'essential-all'],
      default: 'categories',
      description: 'categories shows per-category checkboxes; essential-all is accept-all vs necessary-only',
    },
  ],
  slots: [],
  events: [
    {
      name: 'cookie-consent-change',
      detail: 'ConsentState | null',
      description:
        'Consent saved or mirrored from another tab. Window alias start-app:cookie-consent-change carries the same detail.',
    },
  ],
  cssVariables: [],
  methods: [],
};

export const settings: ConfiguratorSchema = {
  tag: 'noizu-cookie-settings',
  group: 'island',
  importPath: 'components/cookie/noizu-cookie-settings.js',
  demoHtml: '<noizu-cookie-settings>Cookie Settings</noizu-cookie-settings>',
  backend: 'none',
  fields: [],
  slots: ['default'],
  events: [
    {
      name: 'cookie-settings-open',
      description: 'Settings button clicked (bubbles, composed). Consent listens on window.',
    },
  ],
  cssVariables: [],
  methods: [],
};

export const configurators: ConfiguratorSchema[] = [consent, settings];
export const configurator = consent;
