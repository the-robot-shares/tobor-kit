/**
 * `<tobor-agent-card>` — party card with model badge, capability chips, and a
 * Chat CTA. Emits `agent-chat` `{agentId}`; the host owns the conversation.
 */

import {html, nothing, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {emit} from '../../events.js';
import {ToborPartyCard} from './party-card.js';
import {defineElement} from '../../define.js';

export type {PartyPresence} from './party-card.js';
export {PARTY_PRESENCES, PRESENCE_LABEL, isPartyPresence, ToborPartyCard} from './party-card.js';

export interface AgentChatDetail {
  agentId: string;
}

/** Attribute is true unless the literal value is `"false"`. Missing keeps the class default. */
const booleanDefaultTrue = {
  fromAttribute: (value: string | null) => value !== 'false',
  toAttribute: (value: boolean) => (value ? '' : 'false'),
};

@defineElement('tobor-agent-card')
export class ToborAgentCard extends ToborPartyCard {
  @property({type: String, attribute: 'agent-id', reflect: true})
  agentId = '';

  @property({type: String, attribute: 'model-badge', reflect: true})
  modelBadge = '';

  @property({attribute: 'show-capabilities', converter: booleanDefaultTrue})
  showCapabilities = true;

  /** Capability chips. JS property — not an HTML attribute. */
  @property({attribute: false})
  capabilities: string[] = [];

  protected override get cardCy(): string {
    return 'agent.card';
  }

  protected override renderExtraBadges(): TemplateResult | typeof nothing {
    const badge = this.modelBadge.trim();
    if (!badge) return nothing;
    return html`<span class="badge badge--model" part="model">${badge}</span>`;
  }

  protected override renderExtraActions(): TemplateResult {
    return html`
      <button
        type="button"
        part="chat"
        data-cy="agent.chat"
        ?disabled=${!this.agentId}
        @click=${this.onChat}
      >
        Chat
      </button>
    `;
  }

  protected override renderBelow(): TemplateResult | typeof nothing {
    if (!this.showCapabilities) return nothing;
    const caps = this.capabilities.map((cap) => cap.trim()).filter(Boolean);
    return html`
      <ul class="caps" part="caps" data-cy="agent.caps">
        ${caps.map((cap) => html`<li class="badge">${cap}</li>`)}
      </ul>
    `;
  }

  private readonly onChat = (): void => {
    if (!this.agentId) return;
    emit<AgentChatDetail>(this, 'agent-chat', {agentId: this.agentId});
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'tobor-agent-card': ToborAgentCard;
  }
}
