/**
 * `<tobor-user-card>` — party card with role/org badges and a Profile CTA.
 * Emits `user-profile` `{userId}`; the host owns the profile view.
 */

import {html, nothing, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {emit} from '../../events.js';
import {ToborPartyCard} from './party-card.js';
import {defineElement} from '../../define.js';

export type {PartyPresence} from './party-card.js';
export {PARTY_PRESENCES, PRESENCE_LABEL, isPartyPresence, ToborPartyCard} from './party-card.js';

export interface UserProfileDetail {
  userId: string;
}

@defineElement('tobor-user-card')
export class ToborUserCard extends ToborPartyCard {
  @property({type: String, attribute: 'user-id', reflect: true})
  userId = '';

  @property({type: String, reflect: true})
  override role = '';

  @property({type: String, reflect: true})
  org = '';

  protected override get cardCy(): string {
    return 'user.card';
  }

  protected override renderExtraBadges(): TemplateResult | typeof nothing {
    const role = this.role.trim();
    const org = this.org.trim();
    if (!role && !org) return nothing;
    return html`
      ${role ? html`<span class="badge" part="role">${role}</span>` : nothing}
      ${org ? html`<span class="badge" part="org">${org}</span>` : nothing}
    `;
  }

  protected override renderExtraActions(): TemplateResult {
    return html`
      <button
        type="button"
        part="profile"
        data-cy="user.profile"
        ?disabled=${!this.userId}
        @click=${this.onProfile}
      >
        Profile
      </button>
    `;
  }

  private readonly onProfile = (): void => {
    if (!this.userId) return;
    emit<UserProfileDetail>(this, 'user-profile', {userId: this.userId});
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'tobor-user-card': ToborUserCard;
  }
}
