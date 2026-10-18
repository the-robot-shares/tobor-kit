import type {ConfiguratorSchema} from '../../configurator-schema.js';

export const configurator: ConfiguratorSchema = {
  tag: 'noizu-faq',
  group: 'island',
  importPath: 'components/faq/noizu-faq.js',
  demoHtml: `<noizu-faq mode="many">
  <details>
    <summary>What is this?</summary>
    <p>A Light DOM island that decorates slotted native details/summary.</p>
  </details>
  <details>
    <summary>Does the host need a backend?</summary>
    <p>No. The island is host-only markup.</p>
  </details>
</noizu-faq>`,
  backend: 'none',
  fields: [
    {
      attr: 'mode',
      type: 'select',
      options: ['many', 'one'],
      default: 'many',
      description: 'many = independent details; one = accordion (single open)',
    },
  ],
  slots: ['default'],
  events: [
    {
      name: 'faq-toggle',
      detail: '{open: boolean, index: number}',
      description: 'A slotted details entry toggles (bubbles, composed)',
    },
  ],
};
