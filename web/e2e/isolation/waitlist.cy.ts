/// <reference types="cypress" />
// Isolation lane: noizu-waitlist with the manifest GET and signup POST
// cy.intercept-mocked against a relative mock API base (the element is light
// DOM — query it directly, no shadow pierce).
const MANIFEST = {
  list: {
    name: 'Beta waitlist',
    description: 'First wave of invites.',
    opt_in_mode: 'single',
    settings: {},
    attributes: [
      {slug: 'email', name: 'Email', type: 'email', required: true, is_identity: true, options: [], validation: {}, sort_order: 0},
      {slug: 'team', name: 'Team', type: 'select', required: false, is_identity: false, options: [{label: 'Core', value: 'core'}, {label: 'Infra', value: 'infra'}], validation: {}, sort_order: 1},
    ],
  },
};

const host = () => cy.get('noizu-waitlist');
const form = () => host().find('[data-cy="waitlist.form"]');
const status = () => host().find('[data-cy="waitlist.status"]');
const events = () => cy.window().then((win: any) => win.__events);

function mount() {
  cy.intercept('GET', '/mock-api/api/v1/public/lists/beta', {body: MANIFEST}).as('manifest');
  // Default signup stub; tests override as needed. Registered up front so the
  // validation test can assert zero calls.
  cy.intercept('POST', '/mock-api/api/v1/public/lists/beta/signups', {statusCode: 500}).as('signup');
  cy.visit('/e2e/isolation/harness.html');
  cy.window().then((win: any) => {
    win.__events.length = 0;
    return win.mount('noizu-waitlist', {api: '/mock-api', slug: 'beta'});
  });
  return cy.wait('@manifest');
}

describe('Given a mocked waitlist API on the isolation harness, when a visitor validates, signs up and hits API errors, then the form tracks each state and emits waitlist-success / waitlist-error', () => {
  it('Given the manifest loads, when an invalid email is submitted, then client-side validation blocks the POST and names the bad field', () => {
    mount();
    host().find('h2').should('contain', 'Beta waitlist');
    form().should('be.visible');
    form().find('[data-cy="waitlist.email"]').should('have.attr', 'type', 'email');
    cy.screenshot('waitlist-form-loaded');

    form().find('[data-cy="waitlist.email"]').type('not-an-email');
    form().find('[data-cy="waitlist.submit"]').click();

    host().contains('Enter a valid email address.').should('be.visible');
    form().find('[data-cy="waitlist.email"]').should('have.attr', 'aria-invalid', 'true').and('be.focused');
    cy.get('@signup.all').should('have.length', 0); // no POST attempted
    cy.screenshot('waitlist-invalid-email');
  });

  it('Given a valid submission, when the signup POST succeeds, then the success state renders and waitlist-success carries the coerced values and source', () => {
    mount();
    // Registered after mount() so this override beats the 500 fallback stub.
    cy.intercept('POST', '/mock-api/api/v1/public/lists/beta/signups', {statusCode: 201, body: {ok: true}}).as('signup');
    form().find('[data-cy="waitlist.email"]').type('keith@example.test');
    form().find('select[name="team"]').select('infra');
    form().find('[data-cy="waitlist.submit"]').click();

    cy.wait('@signup').its('request.body').should('deep.eq', {
      values: {email: 'keith@example.test', team: 'infra'},
      source: 'widget',
      company_website: '',
    });
    status().should('contain', "You're on the list!").and('have.class', 'success');
    form().should('not.exist'); // success replaces the form
    events().then((evts: any[]) => {
      const wins = evts.filter((e) => e.type === 'waitlist-success');
      expect(wins, 'one success event').to.have.length(1);
      expect(wins[0].detail).to.deep.eq({values: {email: 'keith@example.test', team: 'infra'}, status: 201, source: 'widget'});
    });
    cy.screenshot('waitlist-success');
  });

  it('Given the signup POST rate-limits, when the visitor retries, then the 429 copy shows, waitlist-error carries the status and the form stays editable', () => {
    mount();
    // Registered after mount() so this override beats the 500 fallback stub.
    cy.intercept('POST', '/mock-api/api/v1/public/lists/beta/signups', {statusCode: 429}).as('signup');
    form().find('[data-cy="waitlist.email"]').type('keith@example.test');
    form().find('[data-cy="waitlist.submit"]').click();
    cy.wait('@signup');
    status().should('contain', 'Too many attempts').and('have.class', 'danger');
    form().should('exist');
    events().then((evts: any[]) => {
      const fails = evts.filter((e) => e.type === 'waitlist-error');
      expect(fails, 'one error event').to.have.length(1);
      expect(fails[0].detail.status).to.eq(429);
      expect(fails[0].detail.values).to.deep.eq({email: 'keith@example.test'});
    });
    cy.screenshot('waitlist-rate-limited');

    // Retry path: the server accepts the second attempt.
    cy.intercept('POST', '/mock-api/api/v1/public/lists/beta/signups', {statusCode: 200, body: {ok: true}}).as('signup2');
    form().find('[data-cy="waitlist.submit"]').click();
    cy.wait('@signup2');
    status().should('contain', "You're on the list!");
    cy.screenshot('waitlist-retry-success');
  });

  it('Given a list slug that does not exist, when the manifest 404s, then the not-found copy renders and waitlist-error reports it', () => {
    cy.intercept('GET', '/mock-api/api/v1/public/lists/ghost', {statusCode: 404}).as('ghost');
    cy.visit('/e2e/isolation/harness.html');
    cy.window().then((win: any) => win.mount('noizu-waitlist', {api: '/mock-api', slug: 'ghost'}));
    cy.wait('@ghost');
    status().should('contain', "This sign-up form isn't available right now.").and('have.class', 'danger');
    events().then((evts: any[]) => {
      const fails = evts.filter((e) => e.type === 'waitlist-error');
      expect(fails, 'one error event').to.have.length(1);
      expect(fails[0].detail).to.deep.include({status: 404});
    });
    cy.screenshot('waitlist-manifest-404');
  });
});
