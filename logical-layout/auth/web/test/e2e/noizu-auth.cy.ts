/// <reference types="cypress" />
import {authAsserts as asserts} from '../asserts';
import {authSteps as steps} from '../steps';

describe('noizu-auth (live host)', () => {
  beforeEach(() => {
    // Given a host page that mounts the island
    steps.visit(Cypress.env('COMPONENT_PATH') || '/');
  });

  it('mounts and registers the custom element', () => {
    // When the page loads the island
    steps.waitDefined();
    // Then the tag is defined and catalog failure copy is absent
    asserts.mounted();
    asserts.noLoadError();
  });

  it('shows the auth card and email field', () => {
    // Given the custom element is defined
    steps.waitDefined();
    // Then registry hooks auth-card and email-input are present
    asserts.cardVisible();
    asserts.emailField();
  });

  it('accepts an email in the discovery field', () => {
    // Given the custom element is defined
    steps.waitDefined();
    // When the visitor types an email
    steps.fillEmail('person@example.com');
    // Then the discovery field keeps the value
    asserts.emailValue('person@example.com');
  });
});

describe('noizu-auth dropdown + seven pipes (live host)', () => {
  beforeEach(() => {
    // Given a host page that mounts the island with pipes configured for a dropdown login
    steps.visit(Cypress.env('COMPONENT_PATH') || '/');
    steps.waitDefined();
  });

  it('opens the dropdown from the trigger, closes on Escape', () => {
    // Given the dropdown starts closed
    asserts.dropdownClosed();
    // When the visitor opens it
    steps.openDropdown();
    // Then the panel is visible and the trigger reports expanded
    asserts.dropdownOpen();
    // When the visitor presses Escape
    steps.escape();
    // Then the dropdown closes again
    asserts.dropdownClosed();
  });

  it('closes the dropdown on outside click', () => {
    steps.openDropdown();
    asserts.dropdownOpen();
    steps.clickOutside();
    asserts.dropdownClosed();
  });

  it('shows the pipe selector once pipes are configured', () => {
    steps.setPipes(['email_password', 'mobile_otp', 'google']);
    steps.openDropdown();
    asserts.pipeList();
  });

  it('selects the github pipe and renders the GitHub provider link', () => {
    // Given pipes include github
    steps.setPipes(['email_password', 'github']);
    steps.openDropdown();
    // When the visitor selects it
    steps.selectPipe('github');
    // Then the github pipe is active and the SSO provider link is offered
    asserts.pipeSelected('github');
    asserts.ssoProviderLink('github');
  });
});

describe('noizu-auth invite-token-mode (live host)', () => {
  beforeEach(() => {
    // Given a host page that mounts the island, switched to the signup flow
    steps.visit(Cypress.env('COMPONENT_PATH') || '/');
    steps.waitDefined();
    steps.showSignup();
  });

  it('renders the optional invite field by default', () => {
    asserts.inviteFieldPresent(false);
  });

  it('marks the invite field required in required mode', () => {
    // When the host sets the required policy
    steps.setInviteTokenMode('required');
    // Then the field is present and carries the native required flag
    asserts.inviteFieldPresent(true);
  });

  it('removes the invite field entirely in hidden mode', () => {
    // When the host sets the hidden policy
    steps.setInviteTokenMode('hidden');
    // Then the field is gone (and the register param is omitted on submit)
    asserts.inviteFieldAbsent();
  });
});

describe('noizu-auth SMS region gating (live host)', () => {
  beforeEach(() => {
    // Given a host page that mounts the island with a mobile pipe configured
    steps.visit(Cypress.env('COMPONENT_PATH') || '/');
    steps.waitDefined();
    steps.setPipes(['mobile_password']);
  });

  it('shows no notice and a usable submit when smsRegions is unset (regression)', () => {
    // Given smsRegions is left unset
    steps.setSmsRegions(undefined);
    // Then the notice does not gate anything
    asserts.smsRegionNoticeHidden();
  });

  it('hides the notice for a supported region', () => {
    // Given the default region (US) is in the supported list
    steps.setSmsRegions({supported: ['US', 'CA']});
    // Then the inline notice stays hidden
    asserts.smsRegionNoticeHidden();
  });

  it('shows the inline notice and blocks submit for an unsupported region', () => {
    // Given the host only supports GB, and the visitor is on the default US region
    steps.setSmsRegions({supported: ['GB'], message: 'Try email instead.'});
    // Then the notice is visible with the override message
    asserts.smsRegionNoticeVisible('Try email instead.');
    // And the submit control is aria-disabled but still reachable by keyboard
    asserts.mobilePipeSubmitBlocked();
  });

  it('clears the block after switching to a supported country', () => {
    // Given an unsupported default region
    steps.setSmsRegions({supported: ['GB']});
    asserts.smsRegionNoticeVisible();
    // When the visitor picks a supported country
    steps.setMobileCountry('GB', '+44');
    // Then the notice hides again
    asserts.smsRegionNoticeHidden();
  });
});
