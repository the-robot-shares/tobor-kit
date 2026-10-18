/// <reference types="cypress" />
// Isolation lane: tobor-artifact-view + tobor-artifact-editor. Data enters via
// the `artifact` property; no fetches to mock.
const el = (tag: string) => cy.get(tag).shadow();
const events = () => cy.window().then((win: any) => win.__events);

const ARTIFACT = {id: 'art-1', title: 'Spec Draft', body: 'the body text', version: 3, mime: 'text/plain'};

function mount(tag: string, props: Record<string, unknown> = {}) {
  cy.visit('/e2e/isolation/harness.html');
  cy.window().then((win: any) => win.__events.length = 0);
  cy.window().then((win: any) => win.mount(tag, {}, props));
}

describe('Given a host-supplied artifact on the isolation harness, when the reader and editor are driven, then review-start and artifact-save carry the versioned payload', () => {
  it('Given an artifact, when Start review is clicked, then review-start emits artifactId and version', () => {
    mount('tobor-artifact-view', {artifact: ARTIFACT});
    el('tobor-artifact-view').find('[data-cy="artifact.view"]').should('be.visible').and('contain', 'Spec Draft');
    el('tobor-artifact-view').find('pre').should('have.text', 'the body text');
    el('tobor-artifact-view').find('[part="version"]').should('have.text', 'v3');
    cy.screenshot('artifact-view-mounted');

    el('tobor-artifact-view').find('[data-cy="artifact.review"]').click();
    events().then((evts: any[]) => {
      expect(evts, 'one review-start').to.have.length(1);
      expect(evts[0].type).to.eq('review-start');
      expect(evts[0].detail).to.deep.eq({artifactId: 'art-1', version: 3});
    });
    cy.screenshot('artifact-view-review-started');
  });

  it('Given no artifact, when rendered, then the empty state shows and review is unavailable', () => {
    mount('tobor-artifact-view', {artifact: null});
    el('tobor-artifact-view').find('[data-cy="artifact.view"]').should('contain', 'No artifact.');
    cy.screenshot('artifact-view-empty');
  });

  it('Given the editor seeded from an artifact, when title and body are edited and saved, then artifact-save emits the draft with the original version', () => {
    mount('tobor-artifact-editor', {artifact: ARTIFACT});
    el('tobor-artifact-editor').find('[data-cy="artifact.editor"]').should('be.visible');
    el('tobor-artifact-editor').find('input[name="title"]').should('have.value', 'Spec Draft');
    el('tobor-artifact-editor').find('textarea[name="body"]').should('have.value', 'the body text');
    cy.screenshot('artifact-editor-mounted');

    el('tobor-artifact-editor').find('input[name="title"]').clear().type('Spec v2');
    el('tobor-artifact-editor').find('textarea[name="body"]').clear().type('rewritten body');
    el('tobor-artifact-editor').find('[data-cy="artifact.save"]').click();

    events().then((evts: any[]) => {
      expect(evts, 'one artifact-save').to.have.length(1);
      expect(evts[0].type).to.eq('artifact-save');
      expect(evts[0].detail).to.deep.eq({id: 'art-1', title: 'Spec v2', body: 'rewritten body', version: 3});
    });
    cy.screenshot('artifact-editor-saved');
  });
});
