import type {ConfiguratorSchema} from '../../configurator-schema.js';

const cssVariables: ConfiguratorSchema['cssVariables'] = [
  {name: '--tobor-kit-fg', default: '#e8e9f0'},
  {name: '--tobor-kit-muted', default: '#9aa0b4'},
  {name: '--tobor-kit-accent', default: '#6ee7c7'},
  {name: '--tobor-kit-accent-fg', default: '#08130f'},
  {name: '--tobor-kit-surface', default: '#1b1d27'},
  {name: '--tobor-kit-border', default: '#2c2f3d'},
  {name: '--tobor-kit-danger', default: '#ff6b6b'},
  {name: '--tobor-kit-warn', default: '#f5c451'},
  {name: '--tobor-kit-radius', default: '12px'},
  {name: '--tobor-kit-gap', default: '12px'},
  {name: '--tobor-kit-shadow', default: '0 12px 32px rgb(0 0 0 / 35%)'},
  {name: '--tobor-kit-font-family', default: 'system-ui, -apple-system, "Segoe UI", sans-serif'},
];

export const btn: ConfiguratorSchema = {
  tag: 'noizu-sg-btn',
  group: 'display',
  importPath: 'components/styleguide/noizu-sg-btn.js',
  demoHtml: '<noizu-sg-btn variant="primary" size="md">Continue</noizu-sg-btn>',
  backend: 'none',
  fields: [
    {
      attr: 'variant',
      type: 'select',
      options: ['primary', 'secondary', 'ghost', 'danger'],
      default: 'primary',
      description: 'Visual treatment. Unknown values render as primary.',
    },
    {
      attr: 'size',
      type: 'select',
      options: ['sm', 'md', 'lg'],
      default: 'md',
      description: 'Control size. Unknown values render as md.',
    },
    {
      attr: 'disabled',
      type: 'boolean',
      default: false,
      description: 'Disables the inner button and suppresses sg-click.',
    },
    {
      attr: 'type',
      type: 'select',
      options: ['button', 'submit'],
      default: 'button',
      description: 'Native inner button type. Unknown values render as button.',
    },
  ],
  slots: ['default'],
  events: [
    {
      name: 'sg-click',
      detail: '{}',
      description: 'Inner button clicked (bubbles, composed). Not fired when disabled.',
    },
  ],
  cssVariables,
  methods: [],
};

export const card: ConfiguratorSchema = {
  tag: 'noizu-sg-card',
  group: 'display',
  importPath: 'components/styleguide/noizu-sg-card.js',
  demoHtml: `<noizu-sg-card href="/plans">
  <span slot="header">Pro</span>
  Compare features
  <span slot="footer">From $9/mo</span>
</noizu-sg-card>`,
  backend: 'none',
  fields: [
    {
      attr: 'href',
      type: 'url',
      default: '',
      description:
        'When nonempty the surface is an <a>. Click still emits sg-card-select {href}; preventDefault to own navigation.',
    },
  ],
  slots: ['header', 'default', 'footer'],
  events: [
    {
      name: 'sg-card-select',
      detail: '{href: string}',
      description:
        'Card activated. Cancelable. Host owns navigation when they preventDefault. href is the trimmed attribute (empty when unset).',
    },
  ],
  cssVariables,
  methods: [],
};

export const cardGrid: ConfiguratorSchema = {
  tag: 'noizu-sg-card-grid',
  group: 'display',
  importPath: 'components/styleguide/noizu-sg-card-grid.js',
  demoHtml: `<noizu-sg-card-grid columns="3">
  <noizu-sg-card><span slot="header">A</span>One</noizu-sg-card>
  <noizu-sg-card><span slot="header">B</span>Two</noizu-sg-card>
  <noizu-sg-card><span slot="header">C</span>Three</noizu-sg-card>
</noizu-sg-card-grid>`,
  backend: 'none',
  fields: [
    {
      attr: 'columns',
      type: 'number',
      default: 3,
      description: 'Grid column count. Non-positive or NaN falls back to 3.',
    },
  ],
  slots: ['default'],
  events: [],
  cssVariables,
  methods: [],
};

export const status: ConfiguratorSchema = {
  tag: 'noizu-sg-status',
  group: 'display',
  importPath: 'components/styleguide/noizu-sg-status.js',
  demoHtml:
    '<noizu-sg-status status="ok" label="Ready" description="All checks passed"></noizu-sg-status>',
  backend: 'none',
  fields: [
    {
      attr: 'status',
      type: 'select',
      options: ['ok', 'warn', 'error', 'idle'],
      default: 'idle',
      description: 'Tone. Unknown values render as idle.',
    },
    {
      attr: 'label',
      type: 'string',
      default: '',
      description: 'Primary status copy. Rendered as text.',
    },
    {
      attr: 'description',
      type: 'string',
      default: '',
      description: 'Optional secondary copy. Hidden when empty. Rendered as text.',
    },
  ],
  slots: [],
  events: [],
  cssVariables,
  methods: [],
};

export const input: ConfiguratorSchema = {
  tag: 'noizu-sg-input',
  group: 'input',
  importPath: 'components/styleguide/noizu-sg-input.js',
  demoHtml: '<noizu-sg-input name="email" type="email" value=""></noizu-sg-input>',
  backend: 'none',
  fields: [
    {
      attr: 'name',
      type: 'string',
      default: '',
      description: 'Forwarded to the inner control. Omitted when empty.',
    },
    {
      attr: 'type',
      type: 'select',
      options: ['text', 'password', 'email', 'number', 'url', 'tel', 'search', 'textarea'],
      default: 'text',
      description: 'textarea renders <textarea>. Other unknown values render as text.',
    },
    {
      attr: 'disabled',
      type: 'boolean',
      default: false,
      description: 'Disables the inner control and suppresses sg-input.',
    },
    {
      attr: 'error',
      type: 'boolean',
      default: false,
      description: 'Invalid treatment (border + aria-invalid). Lit Boolean: presence is true.',
    },
    {
      attr: 'value',
      type: 'string',
      default: '',
      description: 'Field value. Typing updates this property and emits sg-input {value}.',
    },
  ],
  slots: [],
  events: [
    {
      name: 'sg-input',
      detail: '{value: string}',
      description: 'Inner input/textarea input event (bubbles, composed). Not fired when disabled.',
    },
  ],
  cssVariables,
  methods: [],
};

export const specTable: ConfiguratorSchema = {
  tag: 'noizu-sg-spec-table',
  group: 'display',
  importPath: 'components/styleguide/noizu-sg-spec-table.js',
  demoHtml: '<noizu-sg-spec-table></noizu-sg-spec-table>',
  backend: 'none',
  fields: [
    {
      attr: 'rows',
      type: 'json',
      propertyOnly: true,
      default: [
        {key: 'Protocol', value: 'HTTPS'},
        {key: 'Region', value: 'us-east-1'},
      ],
      description:
        '{key, value}[]. Not an HTML attribute. Cells render as text only (no HTML / no unsafeHTML).',
    },
  ],
  slots: [],
  events: [],
  cssVariables,
  methods: [],
};

export const steps: ConfiguratorSchema = {
  tag: 'noizu-sg-steps',
  group: 'display',
  importPath: 'components/styleguide/noizu-sg-steps.js',
  demoHtml: '<noizu-sg-steps current="1"></noizu-sg-steps>',
  backend: 'none',
  fields: [
    {
      attr: 'steps',
      type: 'json',
      propertyOnly: true,
      default: ['Plan', 'Build', 'Ship'],
      description: 'string[] labels. Not an HTML attribute. Rendered as text.',
    },
    {
      attr: 'current',
      type: 'number',
      default: 0,
      description: '0-based index of the current step. Non-finite falls back to 0.',
    },
  ],
  slots: [],
  events: [],
  cssVariables,
  methods: [],
};

export const grid = cardGrid;

export const configurators: ConfiguratorSchema[] = [
  btn,
  card,
  cardGrid,
  status,
  input,
  specTable,
  steps,
];
export const configurator = btn;
