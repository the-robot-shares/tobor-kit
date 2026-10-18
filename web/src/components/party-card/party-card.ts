/**
 * `<tobor-party-card>` — shared identity chrome for agent and user cards.
 *
 * Hosts project display-name, handle, and presence. Slots: `avatar` (supports
 * `<tobor-robot-avatar>`), `badges`, `actions`. Not typically standalone, but
 * the tag is registered. Subclasses add CTAs as events; the island never
 * navigates.
 */

import {LitElement, css, html, nothing, type PropertyValues, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {toborKitControls, toborKitTokens} from '../mode-toggle/theme.js';
import {defineElement} from '../../define.js';

export const PARTY_PRESENCES = ['online', 'away', 'offline', 'hidden'] as const;
export type PartyPresence = (typeof PARTY_PRESENCES)[number];

export const PRESENCE_LABEL: Record<PartyPresence, string> = {
  online: 'Online',
  away: 'Away',
  offline: 'Offline',
  hidden: 'Hidden',
};

export function isPartyPresence(value: string): value is PartyPresence {
  return (PARTY_PRESENCES as readonly string[]).includes(value);
}

export const partyCardStyles = css`
  :host {
    display: block;
    --tobor-kit-robot-size: var(--tobor-kit-party-avatar-size, 48px);
  }

  .card {
    display: grid;
    grid-template-columns: auto 1fr auto;
    grid-template-areas:
      'avatar identity actions'
      'avatar badges actions'
      'below below below';
    column-gap: var(--_gap);
    row-gap: 6px;
    align-items: center;
    padding: var(--_gap);
    background: var(--_surface);
    border: 1px solid var(--_border);
    border-radius: var(--_radius);
  }

  .avatar {
    grid-area: avatar;
    display: grid;
    place-items: center;
    width: var(--tobor-kit-party-avatar-size, 48px);
    height: var(--tobor-kit-party-avatar-size, 48px);
    border-radius: calc(var(--_radius) / 2);
    background: var(--_bg);
  }

  .avatar ::slotted(img) {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: inherit;
  }

  .initials {
    width: 100%;
    height: 100%;
    display: grid;
    place-items: center;
    border: 1px solid var(--_border);
    border-radius: inherit;
    font-size: 0.85em;
    font-weight: 650;
    color: var(--_accent);
  }

  .identity {
    grid-area: identity;
    min-width: 0;
    display: grid;
    gap: 2px;
  }

  .name-row {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .name {
    font-weight: 650;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .handle {
    color: var(--_muted);
    font-size: 0.85em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .presence {
    width: 8px;
    height: 8px;
    flex-shrink: 0;
    border-radius: 50%;
    background: var(--_muted);
  }

  .presence[data-presence='online'] {
    background: var(--_accent);
  }

  .presence[data-presence='away'] {
    background: var(--_warn);
  }

  .presence[data-presence='offline'] {
    background: var(--_muted);
  }

  .badges,
  .caps,
  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
  }

  .badges {
    grid-area: badges;
  }

  .actions {
    grid-area: actions;
    justify-content: flex-end;
  }

  .below {
    grid-area: below;
  }

  .caps {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .badge {
    font-size: 0.75em;
    border: 1px solid var(--_border);
    border-radius: 999px;
    padding: 2px 8px;
    color: var(--_muted);
    white-space: nowrap;
  }

  .badge--model {
    background: var(--_accent);
    color: var(--_accent-fg);
    border-color: var(--_accent);
  }
`;

export const partyCardStyleSheet = [toborKitTokens, toborKitControls, partyCardStyles];

@defineElement('tobor-party-card')
export class ToborPartyCard extends LitElement {
  static override styles = partyCardStyleSheet;

  @property({type: String, attribute: 'display-name', reflect: true})
  displayName = '';

  @property({type: String, reflect: true})
  handle = '';

  @property({type: String, reflect: true})
  presence: PartyPresence | string = 'offline';

  get resolvedPresence(): PartyPresence {
    return isPartyPresence(this.presence) ? this.presence : 'offline';
  }

  protected get cardCy(): string {
    return 'party.card';
  }

  protected get initials(): string {
    const parts = this.displayName.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    return parts
      .slice(0, 2)
      .map((part) => part[0]!.toUpperCase())
      .join('');
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('presence') && !isPartyPresence(this.presence)) {
      this.presence = 'offline';
    }
  }

  override render(): TemplateResult {
    const presence = this.resolvedPresence;
    return html`
      <article class="card" part="card" data-cy=${this.cardCy} data-presence=${presence}>
        <div class="avatar" part="avatar">
          <slot name="avatar"><span class="initials">${this.initials}</span></slot>
        </div>
        <div class="identity" part="identity">
          <div class="name-row">
            <span class="name" part="name" data-cy="party.name">${this.displayName}</span>
            <span
              class="presence"
              part="presence"
              data-cy="party.presence"
              data-presence=${presence}
              title=${PRESENCE_LABEL[presence]}
              aria-label=${PRESENCE_LABEL[presence]}
              ?hidden=${presence === 'hidden'}
            ></span>
          </div>
          <span class="handle" part="handle" data-cy="party.handle">${this.handle}</span>
        </div>
        <div class="badges" part="badges">
          ${this.renderExtraBadges()}
          <slot name="badges"></slot>
        </div>
        <div class="actions" part="actions">
          <slot name="actions"></slot>
          ${this.renderExtraActions()}
        </div>
        <div class="below" part="below">${this.renderBelow()}</div>
      </article>
    `;
  }

  protected renderExtraBadges(): TemplateResult | typeof nothing {
    return nothing;
  }

  protected renderExtraActions(): TemplateResult | typeof nothing {
    return nothing;
  }

  protected renderBelow(): TemplateResult | typeof nothing {
    return nothing;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tobor-party-card': ToborPartyCard;
  }
}
