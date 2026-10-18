/// <reference types="cypress" />
// Isolation lane: tobor-review-panel. Reviews enter via the `reviews`
// property; the panel emits review-submit / review-resolve.
const el = () => cy.get('tobor-review-panel').shadow();
const events = () => cy.window().then((win: any) => win.__events);

const REVIEWS = [
  {id: 'r-1', author: 'Ada', body: 'Looks good', at: '2026-09-01T10:00:00Z', status: 'open'},
  {id: 'r-2', author: 'Grace', body: 'Rename this', at: '2026-09-02T11:30:00Z', status: 'resolved'},
];

function mount(attrs: Record<string, string> = {}, props: Record<string, unknown> = {}) {
  cy.visit('/e2e/isolation/harness.html');
  cy.window().then((win: any) => win.__events.length = 0);
  cy.window().then((win: any) => win.mount('tobor-review-panel', attrs, props));
}

describe('Given a host-loaded review thread on the isolation harness, when the composer and resolve actions are driven, then review-submit and review-resolve carry thread identity', () => {
  it('Given reviews and an artifact-id, when a comment is submitted via the button and via Enter, then each review-submit carries the artifactId', () => {
    mount({'artifact-id': 'art-9'}, {reviews: REVIEWS});
    el().find('[data-cy="review.panel"]').should('be.visible');
    el().find('[data-cy="review.item"]').should('have.length', 2);
    el().find('[data-cy="review.item"][data-id="r-2"]').should('have.attr', 'data-status', 'resolved');
    cy.screenshot('review-panel-mounted');

    el().find('[data-cy="review.composer"]').type('First note');
    el().find('[data-cy="review.submit"]').click();
    events().then((evts: any[]) => {
      expect(evts, 'one review-submit').to.have.length(1);
      expect(evts[0].type).to.eq('review-submit');
      expect(evts[0].detail).to.deep.eq({artifactId: 'art-9', body: 'First note'});
    });
    el().find('[data-cy="review.composer"]').should('have.value', '');
    cy.screenshot('review-panel-submitted');

    el().find('[data-cy="review.composer"]').type('Second note{enter}');
    events().then((evts: any[]) => {
      const submits = evts.filter((e) => e.type === 'review-submit');
      expect(submits, 'enter also submits').to.have.length(2);
      expect(submits[1].detail).to.deep.eq({artifactId: 'art-9', body: 'Second note'});
    });
    cy.screenshot('review-panel-enter-submitted');
  });

  it('Given an open review, when Resolve is clicked, then review-resolve emits the row id', () => {
    mount({'artifact-id': 'art-9'}, {reviews: REVIEWS});
    el().find('[data-cy="review.item"][data-id="r-1"]').find('button').contains('Resolve').click();
    events().then((evts: any[]) => {
      expect(evts, 'one review-resolve').to.have.length(1);
      expect(evts[0].type).to.eq('review-resolve');
      expect(evts[0].detail).to.deep.eq({id: 'r-1'});
    });
    cy.screenshot('review-panel-resolved');
  });

  it('Given show-composer=false, when rendered, then the composer is absent but the list still renders', () => {
    mount({'artifact-id': 'art-9', 'show-composer': 'false'}, {reviews: REVIEWS});
    el().find('[data-cy="review.item"]').should('have.length', 2);
    el().find('[data-cy="review.composer"]').should('not.exist');
    cy.screenshot('review-panel-no-composer');
  });
});
