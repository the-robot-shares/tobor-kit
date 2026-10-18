import type {ConfiguratorSchema} from '../../configurator-schema.js';

/** The controller tag hosts render; the two layer tags are auto-managed. */
const pageComments: ConfiguratorSchema = {
  tag: 'noizu-page-comments',
  group: 'island',
  importPath: 'components/page-comments/page-comments.js',
  demoHtml:
    '<noizu-page-comments site="demo-site" enabled></noizu-page-comments>',
  backend: 'external',
  fields: [
    {attr: 'site', type: 'string', required: true, placeholder: 'my-site', description: 'Site slug threads belong to (HTTP mode).'},
    {
      attr: 'api-base',
      type: 'url',
      default: 'https://annotate-srv.therobotlives.com',
      description: 'Annotate service origin; ignored when a data source is injected.',
    },
    {attr: 'enabled', type: 'boolean', default: false, description: 'Island on/off (launcher button, Alt+C).'},
    {
      attr: 'rail-mode',
      type: 'select',
      options: ['overlay', 'push'],
      default: 'overlay',
      description: 'overlay floats over the page; push shifts <html> left with a margin.',
    },
    {
      attr: 'page-key-strategy',
      type: 'select',
      options: ['strip-query-hash', 'full'],
      default: 'strip-query-hash',
      description: 'How URLs map to thread lists.',
    },
    {
      attr: 'dataSource',
      type: 'json',
      propertyOnly: true,
      description: 'DataSource implementation override (MemoryDataSource for demos/tests). JS-only.',
    },
  ],
  slots: [],
  events: [
    {name: 'page-comments-toggle', detail: '{enabled: boolean}', description: 'The island toggled on or off (launcher, Alt+C, open()/close()).'},
    {name: 'page-comments-page-change', detail: '{pageKey: string}', description: 'SPA navigation produced a new pageKey; threads reloaded.'},
    {name: 'page-comments-thread-create', detail: '{id: string}', description: 'A thread was created through the composer.'},
    {name: 'page-comments-thread-orphan', detail: '{id: string}', description: 'A previously anchored thread lost its target and moved to Orphaned.'},
    {name: 'page-comments-auth-change', detail: '{signedIn: boolean, error: string | null}', description: 'Popup sign-in state changed.'},
  ],
  cssVariables: [
    {name: '--pc-rail-width', default: '360px', description: 'Rail width (also the push-mode margin).'},
    {name: '--pc-rail-z', default: '2147481000', description: 'Rail stacking level.'},
    {name: '--pc-overlay-z', default: '2147480000', description: 'Overlay (rings/picker) stacking level.'},
    {name: '--pc-ring-color', default: 'var(--tobor-kit-accent, #6ee7c7)', description: 'Focused-anchor ring color.'},
    {name: '--pc-picker-color', default: 'var(--tobor-kit-warn, #f5c451)', description: 'Picker hover outline color.'},
  ],
  methods: [
    {name: 'open', description: 'Enable the island.'},
    {name: 'close', description: 'Disable the island.'},
    {name: 'toggle', description: 'Flip enabled.'},
    {name: 'refresh', description: 'Reload threads for the current pageKey.'},
    {name: 'focusThread', args: 'id: string', description: 'Focus a card, scroll its anchor into view, draw the ring.'},
  ],
};

/** Internal layers, registered for the no-DOM-safe define gate. Not for direct use. */
const railLayer: ConfiguratorSchema = {
  ...pageComments,
  tag: 'noizu-page-comments-rail',
  importPath: 'components/page-comments/page-comments.js',
  demoHtml: '<noizu-page-comments-rail></noizu-page-comments-rail>',
  fields: [],
  events: [],
  methods: [],
};

const overlayLayer: ConfiguratorSchema = {
  ...pageComments,
  tag: 'noizu-page-comments-overlay',
  importPath: 'components/page-comments/page-comments.js',
  demoHtml: '<noizu-page-comments-overlay></noizu-page-comments-overlay>',
  fields: [],
  events: [],
  methods: [],
};

export const configurators: ConfiguratorSchema[] = [pageComments, railLayer, overlayLayer];
export const configurator = pageComments;
