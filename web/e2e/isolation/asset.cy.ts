/// <reference types="cypress" />
// Isolation lane: tobor-asset-view + tobor-asset-editor. Data enters via the
// `asset` property; no fetches to mock.
const el = (tag: string) => cy.get(tag).shadow();
const events = () => cy.window().then((win: any) => win.__events);

const TEXT_ASSET = {id: 'a-1', name: 'notes.txt', mime: 'text/plain', body: 'hello world'};

function mount(tag: string, props: Record<string, unknown> = {}) {
  cy.visit('/e2e/isolation/harness.html');
  cy.window().then((win: any) => win.__events.length = 0);
  cy.window().then((win: any) => win.mount(tag, {}, props));
}

describe('Given a host-supplied asset snapshot on the isolation harness, when the reader and editor are driven, then asset-open and asset-save carry host-persistable payloads', () => {
  it('Given a text asset, when the view is clicked, then asset-open emits the asset id and the text preview renders the body', () => {
    mount('tobor-asset-view', {asset: TEXT_ASSET});
    el('tobor-asset-view').find('[data-cy="asset.view"]').should('be.visible').and('contain', 'notes.txt');
    el('tobor-asset-view').find('[data-cy="asset.preview"]').should('have.attr', 'data-kind', 'text').and('contain', 'hello world');
    cy.screenshot('asset-view-mounted');

    el('tobor-asset-view').find('[data-cy="asset.view"]').click();
    events().then((evts: any[]) => {
      expect(evts, 'one asset-open').to.have.length(1);
      expect(evts[0].type).to.eq('asset-open');
      expect(evts[0].detail).to.deep.eq({id: 'a-1'});
    });
    cy.screenshot('asset-view-opened');
  });

  it('Given an image asset with no src, when rendered, then the image fallback shows with no preview crash', () => {
    mount('tobor-asset-view', {asset: {id: 'a-2', name: 'pic.png', mime: 'image/png'}});
    el('tobor-asset-view').find('[data-cy="asset.preview"]').should('have.attr', 'data-kind', 'image');
    cy.screenshot('asset-view-image-fallback');
  });

  it('Given the editor seeded from a text asset, when name and body are edited and saved, then asset-save emits the trimmed draft', () => {
    mount('tobor-asset-editor', {asset: TEXT_ASSET});
    el('tobor-asset-editor').find('[data-cy="asset.editor"]').should('be.visible');
    el('tobor-asset-editor').find('input[name="name"]').should('have.value', 'notes.txt');
    el('tobor-asset-editor').find('textarea[name="body"]').should('have.value', 'hello world');
    cy.screenshot('asset-editor-mounted');

    el('tobor-asset-editor').find('input[name="name"]').clear().type('renamed.txt');
    el('tobor-asset-editor').find('textarea[name="body"]').clear().type('updated body');
    el('tobor-asset-editor').find('[data-cy="asset.save"]').click();

    events().then((evts: any[]) => {
      expect(evts, 'one asset-save').to.have.length(1);
      expect(evts[0].type).to.eq('asset-save');
      expect(evts[0].detail).to.deep.eq({id: 'a-1', name: 'renamed.txt', body: 'updated body'});
    });
    cy.screenshot('asset-editor-saved');
  });
});
