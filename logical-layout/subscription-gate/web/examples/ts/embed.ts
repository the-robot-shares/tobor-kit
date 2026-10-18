/**
 * Typed mount for noizu-subscription-gate.
 * Host: import {type GateBlockedDetail, type NoizuSubscriptionGate} from '@noizu/tobor-kit/subscription-gate';
 */
import '../../noizu-subscription-gate.js';
import type {GateBlockedDetail, NoizuSubscriptionGate} from '../../noizu-subscription-gate.js';

const paid = document.createElement('noizu-subscription-gate') as NoizuSubscriptionGate;
paid.entitled = true;
paid.redirectTo = '/pricing';
paid.innerHTML = '<p>Subscriber content</p>';

const blocked = document.createElement('noizu-subscription-gate') as NoizuSubscriptionGate;
blocked.redirectTo = '/pricing';
blocked.autoRedirect = false;
blocked.innerHTML = '<p>Hidden unless entitled</p>';
blocked.addEventListener('gate-blocked', ((event: CustomEvent<GateBlockedDetail>) => {
  // Host-owned navigation. Event is cancelable; do not put secrets on the element.
  console.info('gate-blocked', event.detail.redirectTo);
}) as EventListener);

document.body.append(paid, blocked);
