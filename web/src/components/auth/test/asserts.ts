/// <reference types="cypress" />
import {
  assertDemoFrameVisible,
  assertMounted,
  assertNoLoadError,
  inShadow,
} from '../../../lit-test/cypress.js';

export const authAsserts = {
  mounted(tag = 'noizu-auth'): void {
    assertMounted(tag);
    assertDemoFrameVisible(tag);
  },
  noLoadError(): void {
    assertNoLoadError();
  },
  cardVisible(): void {
    inShadow('noizu-auth', '[data-cy="auth-card"]').should('exist');
  },
  emailField(): void {
    inShadow('noizu-auth', '[data-cy="email-input"]').should('be.visible');
  },
  emailValue(value: string): void {
    inShadow('noizu-auth', '[data-cy="email-input"]').should('have.value', value);
  },
  providerList(): void {
    inShadow('noizu-auth', '[data-cy="sso-provider-list"]').should('exist');
    inShadow('noizu-auth', '[data-cy="sso-provider-link"]').should('exist');
  },
  dropdownClosed(): void {
    inShadow('noizu-auth', '[data-cy="auth-dropdown-panel"]').should('not.exist');
    inShadow('noizu-auth', '[data-cy="auth-dropdown-trigger"]').should(
      'have.attr',
      'aria-expanded',
      'false',
    );
  },
  dropdownOpen(): void {
    inShadow('noizu-auth', '[data-cy="auth-dropdown-panel"]').should('exist');
    inShadow('noizu-auth', '[data-cy="auth-dropdown-trigger"]').should(
      'have.attr',
      'aria-expanded',
      'true',
    );
  },
  pipeList(): void {
    inShadow('noizu-auth', '[data-cy="pipe-list"]').should('exist');
  },
  pipeSelected(id: string): void {
    inShadow('noizu-auth', `[data-cy="pipe-${id.replace(/_/g, '-')}"]`).should(
      'have.attr',
      'aria-pressed',
      'true',
    );
  },
  ssoProviderLink(provider: string): void {
    inShadow('noizu-auth', `[data-cy="sso-provider-link"][data-provider="${provider}"]`).should('exist');
  },
  mergeRequired(): void {
    inShadow('noizu-auth', '[data-cy="merge-required"]').should('exist');
    inShadow('noizu-auth', '[data-cy="merge-pipe-option"]').should('exist');
  },
  smsRegionNoticeHidden(): void {
    inShadow('noizu-auth', '[data-cy="sms-region-notice"]').should('be.hidden');
  },
  smsRegionNoticeVisible(message?: string): void {
    const notice = inShadow('noizu-auth', '[data-cy="sms-region-notice"]').should('be.visible');
    if (message) notice.should('contain.text', message);
  },
  mobilePipeSubmitBlocked(): void {
    inShadow('noizu-auth', '[data-cy="pipe-submit"]').should('have.attr', 'aria-disabled', 'true');
    // aria-disabled keeps the control in the tab order (never native `disabled`) so keyboard
    // users can still reach and be told why it's unavailable.
    inShadow('noizu-auth', '[data-cy="pipe-submit"]').should('not.have.attr', 'disabled');
  },
  inviteFieldPresent(required: boolean): void {
    const field = inShadow('noizu-auth', '[data-cy="invite_token-input"]').should('exist');
    if (required) field.should('have.attr', 'required');
    else field.should('not.have.attr', 'required');
  },
  inviteFieldAbsent(): void {
    inShadow('noizu-auth', '[data-cy="invite_token-input"]').should('not.exist');
  },
};
