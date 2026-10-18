/**
 * Vanilla mount for noizu-subscription-gate.
 * Host: import '@noizu/tobor-kit/subscription-gate';
 */
import '../../noizu-subscription-gate.js';

const paid = document.createElement('noizu-subscription-gate');
paid.entitled = true;
paid.redirectTo = '/pricing';
paid.innerHTML = '<p>Subscriber content</p>';

const blocked = document.createElement('noizu-subscription-gate');
blocked.redirectTo = '/pricing';
blocked.autoRedirect = false;
blocked.innerHTML = '<p>Hidden unless entitled</p>';
blocked.addEventListener('gate-blocked', (event) => {
  // Host-owned navigation. Event is cancelable; do not put secrets on the element.
  console.info('gate-blocked', event.detail.redirectTo);
});

document.body.append(paid, blocked);
