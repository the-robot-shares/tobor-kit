/// <reference types="cypress" />
// Isolation lane: tobor-telemetry-toggle driven via the `consent` property API
// and a duck-typed mock client (no fetch — consent enters as a prop; the
// client is only used for reads/writes the host would normally provide).
const el = () => cy.get('tobor-telemetry-toggle').shadow();
const box = () => el().find('[data-testid="telemetry-toggle"]');
const events = () => cy.window().then((win: any) => win.__events);

const OVERRIDABLE = {enabled: false, source: 'default', user_overridable: true};

function mount(props: Record<string, unknown>) {
  cy.visit('/e2e/isolation/harness.html');
  cy.window().then((win: any) => {
    win.__events.length = 0;
    return win.mount('tobor-telemetry-toggle', {}, props);
  });
}

describe('Given a telemetry consent control on the isolation harness, when consent is rendered or toggled, then the element never shows a control that cannot change anything', () => {
  it('Given overridable consent, when the checkbox is toggled on, then the client write runs and tobor-telemetry-change carries the new consent', () => {
    let written: boolean | null = null;
    mount({
      consent: {...OVERRIDABLE},
      client: {
        setTelemetryConsent: async (enabled: boolean) => {
          written = enabled;
          return {ok: true, consent: {enabled, source: 'default', user_overridable: true}};
        },
      },
    });
    box().should('not.be.checked').and('not.be.disabled');
    cy.screenshot('telemetry-mounted-off');

    box().check();
    events().then((evts: any[]) => {
      expect(written, 'client write ran with the new value').to.eq(true);
      const changes = evts.filter((e) => e.type === 'tobor-telemetry-change');
      expect(changes, 'one change event').to.have.length(1);
      expect(changes[0].detail.consent.enabled).to.eq(true);
    });
    box().should('be.checked');
    cy.screenshot('telemetry-toggled-on');
  });

  it('Given a forced server default, when the element renders, then nothing renders at all — not even a disabled toggle', () => {
    mount({consent: {enabled: true, source: 'forced', user_overridable: true}});
    cy.get('tobor-telemetry-toggle').shadow().find('[data-testid="telemetry-toggle"]').should('not.exist');
    mount({consent: {enabled: true, source: 'default', user_overridable: false}});
    cy.get('tobor-telemetry-toggle').shadow().children().should('have.length', 0);
    cy.screenshot('telemetry-forced-inert');
  });

  it('Given the server rejects the write as forbidden, when the user toggles, then the control reverts to inert and the change event carries the forced consent', () => {
    mount({
      consent: {...OVERRIDABLE},
      client: {setTelemetryConsent: async () => ({ok: false})},
    });
    box().check();
    events().then((evts: any[]) => {
      const changes = evts.filter((e) => e.type === 'tobor-telemetry-change');
      expect(changes, 'the revert is announced').to.have.length(1);
      expect(changes[0].detail.consent).to.deep.include({source: 'forced', user_overridable: false});
    });
    // The lie is withdrawn: no dead control remains.
    cy.get('tobor-telemetry-toggle').shadow().find('[data-testid="telemetry-toggle"]').should('not.exist');
    cy.screenshot('telemetry-403-inert');
  });

  it('Given a client whose consent read fails, when the element connects, then the error notice renders', () => {
    mount({
      client: {getTelemetryConsent: async () => { throw new Error('consent upstream 500'); }},
    });
    el().find('[data-testid="telemetry-error"]').should('contain', 'Could not load telemetry consent').and('contain', 'consent upstream 500');
    cy.screenshot('telemetry-load-error');
  });
});
