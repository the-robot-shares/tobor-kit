// npm + vanilla JS: the interstitial page plus the app-wide 403 handler.
import '@noizu/tobor-kit/invite-gate';
import {withInviteGate} from '@noizu/tobor-kit/invite-required';

// 1. Every API call in the app goes through this: a 403 {"error":"invite_required"}
//    redirects to /auth/invite-required and rejects with InviteRequiredError.
export const apiFetch = withInviteGate(fetch);

// 2. The interstitial page (/auth/invite-required).
export function mountInviteGate(root, {email, onSignOut}) {
  const gate = document.createElement('noizu-invite-gate');
  gate.email = email;
  gate.brand = 'therobotplans';
  gate.addEventListener('noizu-invite-sign-out', (event) => {
    event.preventDefault(); // the host owns sign-out
    onSignOut();
  });
  root.append(gate);
  return gate;
}
