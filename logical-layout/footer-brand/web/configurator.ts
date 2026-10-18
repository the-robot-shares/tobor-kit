import type {ConfiguratorSchema} from '../../configurator-schema.js';

export const configurator: ConfiguratorSchema = {
  tag: 'noizu-footer-brand',
  group: 'island',
  importPath: 'components/footer-brand/noizu-footer-brand.js',
  demoHtml: '<noizu-footer-brand></noizu-footer-brand>',
  backend: 'none',
  fields: [
    {
      attr: 'href',
      type: 'url',
      default: 'https://derobot.is',
      description: 'Link target for the brand name',
    },
    {
      attr: 'target',
      type: 'string',
      default: '',
      description: 'Anchor target; the attribute is omitted when empty. _blank renders rel="noopener noreferrer"',
    },
    {
      attr: 'brand',
      type: 'string',
      default: 'The Robot Lives',
      description: 'Brand name rendered inside the link',
    },
    {
      attr: 'prefix',
      type: 'string',
      default: 'A',
      description: 'Leading text; empty string suppresses the piece and its spacing',
    },
    {
      attr: 'suffix',
      type: 'string',
      default: 'Joint',
      description: 'Trailing text; empty string suppresses the piece and its spacing',
    },
    {
      attr: 'theme',
      type: 'select',
      options: ['dark', 'light', 'auto'],
      default: 'dark',
      description: 'Color scheme preset; auto follows prefers-color-scheme',
    },
    {
      attr: 'palette',
      type: 'select',
      options: ['default', 'mono', 'accent'],
      default: 'default',
      description: 'Palette preset — token values only; mono distinguishes the brand by font/weight',
    },
    {
      attr: 'align',
      type: 'select',
      options: ['start', 'center', 'end'],
      default: 'center',
      description: 'Inline alignment of the line',
    },
  ],
  slots: [],
  events: [],
  cssVariables: [
    {
      name: '--noizu-footer-brand-font',
      default: 'var(--tobor-kit-font)',
      description: 'Body font of the line',
    },
    {
      name: '--noizu-footer-brand-brand-font',
      default: '"Space Grotesk", var(--tobor-kit-font)',
      description: 'Display font of the brand link',
    },
    {
      name: '--noizu-footer-brand-size',
      default: '0.875rem',
      description: 'Font size of the line',
    },
    {
      name: '--noizu-footer-brand-fg',
      default: 'preset (palette body color)',
      description: 'Body text color; explicit value beats theme/palette presets',
    },
    {
      name: '--noizu-footer-brand-brand-color',
      default: 'preset (palette brand color)',
      description: 'Brand link color; explicit value beats theme/palette presets',
    },
    {
      name: '--noizu-footer-brand-letter-spacing',
      default: 'normal',
      description: 'Letter spacing of the line',
    },
    {
      name: '--noizu-footer-brand-padding',
      default: '0',
      description: 'Padding around the line',
    },
  ],
  methods: [],
};

export const configurators: ConfiguratorSchema[] = [configurator];
