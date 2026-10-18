/// <reference types="cypress" />
// Isolation lane: tobor-robot-avatar on the blank harness page.
// Render-only state machine: no backend, no events — assert the SVG tells.
const avatar = () => cy.get('tobor-robot-avatar').shadow();

function mount(attrs: Record<string, unknown> = {}) {
  cy.visit('/e2e/isolation/harness.html');
  return cy.window().then(async (win: any) => {
    await win.mount('tobor-robot-avatar', attrs);
    win.__events.length = 0;
  });
}

describe('Given the robot avatar glyph renderer, when the state attribute changes on the isolation harness, then eyes, mouth and motion flags render the told state exactly', () => {
  it('Given no state, when the avatar renders, then idle face (normal eyes, smile) and the sr-only label show idle', () => {
    mount();
    cy.get('tobor-robot-avatar').shadow().find('svg').should('exist');
    avatar().find('[part="eyes"]').should('have.attr', 'data-eyes', 'normal');
    avatar().find('[part="mouth"]').should('have.attr', 'data-mouth', 'smile');
    avatar().find('[data-testid="state-label"]').should('have.text', 'idle');
    cy.screenshot('avatar-idle');
  });

  it('Given listening, thinking, speaking and tool_running states, when each is set, then the matching per-state face renders', () => {
    mount({state: 'listening'});
    avatar().find('[part="eyes"]').should('have.attr', 'data-eyes', 'wide');
    avatar().find('[part="mouth"]').should('have.attr', 'data-mouth', 'listening');
    cy.screenshot('avatar-listening');

    mount({state: 'thinking'});
    avatar().find('[part="eyes"]').should('have.attr', 'data-eyes', 'up');
    avatar().find('[part="thinking-dots"]').should('exist');
    cy.screenshot('avatar-thinking');

    mount({state: 'speaking'});
    avatar().find('[part="mouth"]').should('have.attr', 'data-mouth', 'bars');
    cy.screenshot('avatar-speaking');

    mount({state: 'tool_running'});
    avatar().find('[part="mouth"]').should('have.attr', 'data-mouth', 'gear');
    avatar().find('[part="badge"]').should('exist');
    cy.screenshot('avatar-tool-running');
  });

  it('Given error/offline and an unknown state, when rendered, then error/offline faces show and unknown clamps to idle; reduced-motion forces static', () => {
    mount({state: 'error'});
    avatar().find('[part="eyes"]').should('have.attr', 'data-eyes', 'error');
    avatar().find('[part="mouth"]').should('have.attr', 'data-mouth', 'frown');
    cy.screenshot('avatar-error');

    mount({state: 'offline'});
    avatar().find('[part="mouth"]').should('have.attr', 'data-mouth', 'flat');
    avatar().find('[data-testid="state-label"]').should('have.text', 'offline');
    cy.screenshot('avatar-offline');

    mount({state: 'dancing'});
    avatar().find('[data-testid="state-label"]').should('have.text', 'idle');
    avatar().find('[part="mouth"]').should('have.attr', 'data-mouth', 'smile');
    cy.screenshot('avatar-unknown-clamps-idle');

    mount({state: 'listening', 'reduced-motion': 'force_static'});
    cy.get('tobor-robot-avatar').should('have.attr', 'data-motion', 'static');
    avatar().find('[part="mouth"]').should('have.attr', 'data-mouth', 'listening');
    cy.screenshot('avatar-force-static');
  });
});
