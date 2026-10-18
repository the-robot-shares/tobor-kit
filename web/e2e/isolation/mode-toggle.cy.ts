/// <reference types="cypress" />
// Isolation lane: tobor-mode-toggle on the blank harness page. No backend.
const events = () => cy.window().then((win: any) => win.__events);

function mount(props: Record<string, unknown>) {
  cy.visit('/e2e/isolation/harness.html');
  return cy.window().then(async (win: any) => {
    await win.mount('tobor-mode-toggle', {}, props);
    win.__events.length = 0;
  });
}

describe('Given the voice/text/transcript switcher, when modes are selected on the isolation harness, then aria state tracks and tobor-mode-change carries mode and previous', () => {
  it('Given all three modes with text active, when Voice is clicked, then the radio checks it and emits mode+previous', () => {
    mount({modes: ['voice', 'text', 'transcript'], mode: 'text'});
    cy.get('tobor-mode-toggle').shadow().find('[role="radiogroup"]').should('be.visible');
    cy.get('tobor-mode-toggle').shadow().find('[role="radio"][data-mode="text"]').should('have.attr', 'aria-checked', 'true');
    cy.screenshot('mode-toggle-text-active');

    cy.get('tobor-mode-toggle').shadow().find('[role="radio"][data-mode="voice"]').click();
    cy.get('tobor-mode-toggle').shadow().find('[role="radio"][data-mode="voice"]').should('have.attr', 'aria-checked', 'true');
    cy.get('tobor-mode-toggle').shadow().find('[role="radio"][data-mode="text"]').should('have.attr', 'aria-checked', 'false');
    cy.get('tobor-mode-toggle').shadow().find('[role="radio"][data-mode="voice"]').should('be.disabled');
    events().then((evts: any[]) => {
      const change = evts.find((e) => e.type === 'tobor-mode-change');
      expect(change, 'tobor-mode-change emitted').to.exist;
      expect(change.detail).to.deep.eq({mode: 'voice', previous: 'text'});
    });
    cy.screenshot('mode-toggle-voice-selected');
  });

  it('Given a disabled toggle, when any mode is clicked, then nothing is emitted and buttons are disabled', () => {
    mount({modes: ['voice', 'text', 'transcript'], mode: 'text', disabled: true});
    cy.get('tobor-mode-toggle').shadow().find('[role="radio"][data-mode="voice"]').should('be.disabled');
    cy.get('tobor-mode-toggle').shadow().find('[role="radio"][data-mode="transcript"]').click({force: true});
    events().then((evts: any[]) => {
      expect(evts.filter((e) => e.type === 'tobor-mode-change'), 'no mode-change when disabled').to.have.length(0);
    });
    cy.screenshot('mode-toggle-disabled');
  });

  it('Given an empty modes list, when rendered, then nothing shows; clicking the active mode re-emits nothing', () => {
    mount({modes: [], mode: 'text'});
    cy.get('tobor-mode-toggle').shadow().find('[role="radiogroup"]').should('not.exist');
    cy.screenshot('mode-toggle-empty');

    mount({modes: ['voice', 'text'], mode: 'text'});
    cy.get('tobor-mode-toggle').shadow().find('[role="radio"][data-mode="text"]').should('be.disabled');
    events().then((evts: any[]) => {
      expect(evts.filter((e) => e.type === 'tobor-mode-change')).to.have.length(0);
    });
  });
});
