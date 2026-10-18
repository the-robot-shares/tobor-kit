/// <reference types="cypress" />
// Isolation lane: tobor-configurator mounted on the blank harness page, no backend.
// Schema is fed via the inline JSON script channel (same shape as
// components/configurator/configurator.ts demoHtml — the agent-card-style
// declarative playground schema).
const SCHEMA = {
  tag: 'demo-widget',
  group: 'display',
  importPath: 'demo-widget.js',
  demoHtml: '<demo-widget label="Hello"></demo-widget>',
  backend: 'none',
  fields: [
    {attr: 'label', type: 'string', required: true, default: 'Hello'},
    {attr: 'enabled', type: 'boolean', default: false},
  ],
};

const field = (attr: string) => cy.get('tobor-configurator').shadow().find(`[data-cy="configurator.field"][data-field="${attr}"]`);
const events = () => cy.window().then((win: any) => win.__events);

function mount() {
  cy.visit('/e2e/isolation/harness.html');
  // Schema adoption fires a configurator-change on mount — clear after mount
  // so assertions below only see user-driven events.
  return cy.window().then(async (win: any) => {
    await win.mount('tobor-configurator', {}, {}, `<script type="application/json">${JSON.stringify(SCHEMA)}</script>`);
    // Schema adoption fires a configurator-change on mount — clear after mount
    // so assertions below only see user-driven events.
    win.__events.length = 0;
  });
}

describe('Given a declarative ConfiguratorSchema, when editing fields on the isolation harness, then preview, events and snippet track the form', () => {
  it('Given the schema loads, when fields are edited, then configurator-change carries live values and the preview updates', () => {
    mount();
    cy.get('tobor-configurator').shadow().find('[data-cy="configurator.form"]').should('be.visible');
    field('label').find('input').should('have.value', 'Hello');
    field('enabled').find('input[type="checkbox"]').should('not.be.checked');
    cy.screenshot('configurator-mounted');

    field('label').find('input').clear().type('World');
    field('enabled').find('input[type="checkbox"]').check();

    events().then((evts: any[]) => {
      const changes = evts.filter((e) => e.type === 'configurator-change');
      expect(changes.length, 'change events after both edits').to.be.at.least(2);
      expect(changes.at(-1).detail).to.deep.include({tag: 'demo-widget'});
      expect(changes.at(-1).detail.attributes).to.deep.eq({label: 'World', enabled: true});
    });
    cy.get('tobor-configurator').shadow().find('[data-cy="configurator.preview"]').find('demo-widget').invoke('attr', 'label').should('eq', 'World');
    cy.screenshot('configurator-edited');
  });

  it('Given edited fields, when Apply is clicked, then configurator-apply emits the snapshot and the copyable snippet matches', () => {
    mount();
    field('label').find('input').clear().type('World');
    field('enabled').find('input[type="checkbox"]').check();
    cy.get('tobor-configurator').shadow().find('[data-cy="configurator.apply"]').click();

    events().then((evts: any[]) => {
      const apply = evts.find((e) => e.type === 'configurator-apply');
      expect(apply, 'configurator-apply emitted').to.exist;
      expect(apply.detail.tag).to.eq('demo-widget');
      expect(apply.detail.attributes).to.deep.eq({label: 'World', enabled: true});
    });
    cy.get('tobor-configurator').shadow().find('[data-cy="configurator.snippet"]').should('contain', 'label="World"');
    cy.screenshot('configurator-applied-snippet');
  });

  it('Given unmount, when the harness resets, then no elements leak between mounts', () => {
    mount();
    cy.window().then((win: any) => {
      win.unmount();
      expect(win.document.querySelector('tobor-configurator')).to.be.null;
      expect(win.__events.length).to.eq(0);
    });
  });
});
