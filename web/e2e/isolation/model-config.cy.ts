/// <reference types="cypress" />
// Isolation lane: noizu-model-config with the catalog fetch cy.intercept-mocked.
const CATALOG = [
  {provider: 'openai', model: 'gpt-x', label: 'GPT X'},
  {provider: 'anthropic', model: 'claude-y', label: 'Claude Y'},
];
const el = () => cy.get('noizu-model-config').shadow();
const picker = () => el().find('[data-cy="model.picker"]');
const events = () => cy.window().then((win: any) => win.__events);

function mount(catalogUrl: string, extraAttrs: Record<string, string> = {}, props: Record<string, unknown> = {}) {
  cy.intercept('GET', '/mock/catalog.json', {body: CATALOG}).as('catalog');
  cy.visit('/e2e/isolation/harness.html');
  cy.window().then((win: any) => win.__events.length = 0);
  cy.window().then((win: any) => win.mount('noizu-model-config', {'catalog-url': catalogUrl, ...extraAttrs}, props));
  return cy.wait('@catalog');
}

describe('Given an intercepted model catalog on the isolation harness, when a provider:model is picked, then model-change tracks every selection path', () => {
  it('Given the catalog loads, when a catalog entry is selected, then model-change emits the provider:model spec', () => {
    mount('/mock/catalog.json');
    picker().should('be.visible');
    cy.screenshot('model-config-mounted');

    picker().select('anthropic:claude-y');
    events().then((evts: any[]) => {
      const changes = evts.filter((e) => e.type === 'model-change');
      expect(changes, 'one model-change').to.have.length(1);
      expect(changes[0].detail).to.deep.eq({value: 'anthropic:claude-y'});
    });
    cy.get('noizu-model-config').should('have.attr', 'value', 'anthropic:claude-y');
    cy.screenshot('model-config-selected');
  });

  it('Given allow-custom, when Custom is chosen and the endpoint saved, then custom-endpoint-save treats a masked key as keep-stored and model-change emits the custom spec', () => {
    mount('/mock/catalog.json', {'allow-custom': ''}, {customEndpoint: {baseUrl: 'https://relay.example.test/v1', model: 'relay-1', apiKey: '••••1234'}});
    picker().select('__custom__');
    el().find('[data-cy="model.custom"]').should('be.visible');
    el().find('[data-cy="model.custom"] input[name="baseUrl"]').should('have.value', 'https://relay.example.test/v1');
    const keyInput = () => el().find('[data-cy="model.custom"] input[name="apiKey"]');

    // Masked echo renders as readable text (masked-secret display), not password dots.
    keyInput().should('have.value', '••••1234').and('have.attr', 'type', 'text');
    cy.screenshot('model-config-custom-masked-key');

    keyInput().clear().type('sk-brand-new-key');
    keyInput().should('have.attr', 'type', 'password'); // new secret is masked
    el().find('[data-cy="model.custom"] button[data-cy="model.save"]').click();

    events().then((evts: any[]) => {
      const save = evts.find((e) => e.type === 'custom-endpoint-save');
      expect(save, 'custom-endpoint-save emitted').to.exist;
      expect(save.detail.baseUrl).to.eq('https://relay.example.test/v1');
      expect(save.detail.model).to.eq('relay-1');
      expect(save.detail.apiKey).to.eq('sk-brand-new-key');
      const last = evts.at(-1);
      expect(last.type).to.eq('model-change');
      expect(last.detail).to.deep.eq({value: 'custom:relay-1'});
    });
    // Key field is wiped after save so a fresh secret never lingers in the DOM.
    keyInput().should('have.value', '');
    cy.screenshot('model-config-custom-saved');
  });

  it('Given a catalog URL that fails, when the fetch 500s, then the error notice renders with no entries', () => {
    cy.intercept('GET', '/mock/broken.json', {statusCode: 500}).as('broken');
    cy.visit('/e2e/isolation/harness.html');
    cy.window().then((win: any) => win.mount('noizu-model-config', {'catalog-url': '/mock/broken.json'}));
    cy.wait('@broken');
    el().find('.notice--error').should('contain', 'Could not load the model catalog.');
    picker().find('option').should('have.length', 1); // only the disabled placeholder
    cy.screenshot('model-config-catalog-error');
  });
});
