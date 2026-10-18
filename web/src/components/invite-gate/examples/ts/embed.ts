/**
 * Typed mount for a REST/Bearer host (the therobotplans family).
 * Host: import {NoizuInviteGate} from '@noizu/tobor-kit/invite-gate';
 *       import {withInviteGate, userNeedsInvite} from '@noizu/tobor-kit/invite-required';
 */
import '../../noizu-invite-gate.js';
import type {InviteRedeemedDetail, NoizuInviteGate} from '../../noizu-invite-gate.js';
import {DEFAULT_INVITE_REQUIRED_URL, userNeedsInvite, withInviteGate} from '../../invite-required.js';

declare const session: {accessToken: string; user: {email: string; invite_required?: boolean}};
declare function refreshSession(): Promise<void>;
declare function signOut(): void;

// App-wide: route every gated API answer to the interstitial.
export const apiFetch = withInviteGate(fetch, {url: DEFAULT_INVITE_REQUIRED_URL});

// After login: held accounts go to the interstitial, everyone else into the app.
export const postAuthPath = () => (userNeedsInvite(session.user) ? DEFAULT_INVITE_REQUIRED_URL : '/app');

const gate = document.createElement('noizu-invite-gate') as NoizuInviteGate;
gate.brand = 'therobotplans';
gate.email = session.user.email;
gate.accessToken = session.accessToken; // property only — never an attribute
gate.addEventListener('noizu-invite-redeemed', ((event: CustomEvent<InviteRedeemedDetail>) => {
  // Refresh the session (status is now active) before continuing.
  event.preventDefault();
  void refreshSession().then(() => location.assign(event.detail.continueUrl));
}) as EventListener);
gate.addEventListener('noizu-invite-sign-out', (event) => {event.preventDefault(); signOut();});
document.body.append(gate);
