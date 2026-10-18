/// <reference types="cypress" />
import {inviteGateAsserts as asserts} from '../asserts';
import {inviteGateSteps as steps} from '../steps';

// Live-host stub: point COMPONENT_PATH at a page that mounts <noizu-invite-gate>
// (usually the app's /auth/invite-required, reached as a pending account).
// The redeem endpoint is intercepted, so no real invite is consumed.
describe('noizu-invite-gate (live host)', () => {
  beforeEach(() => {
    // Given a host page that mounts the interstitial
    steps.visit(Cypress.env('COMPONENT_PATH') || '/auth/invite-required');
    steps.waitDefined();
  });

  it('mounts an accessible interstitial card', () => {
    // Then the tag is defined, the card renders, and the input/alert are wired
    asserts.mounted();
    asserts.noLoadError();
    asserts.card();
    asserts.accessible();
  });

  it('shows the used state when the invite was already redeemed', () => {
    // Given the redeem endpoint answers 409
    steps.stubRedeem(409, {error: 'This invite has already been used'});
    // When the user redeems a code
    steps.redeem('USED-INVITE');
    // Then the used error is announced and the user stays on the page
    asserts.redeemRequest('USED-INVITE');
    asserts.error('used', 'already been used');
  });

  it('continues after a successful redeem', () => {
    // Given the redeem endpoint answers 200 and the host keeps us on the page
    steps.stubRedeem(200, {organization_id: 'org-1', role: 'member', invite_required: false});
    steps.cancelNavigation();
    // When the user redeems a code
    steps.redeem('GOOD-INVITE');
    // Then the request carries the code and success is announced
    asserts.redeemRequest('GOOD-INVITE');
    asserts.redeemed();
  });
});
