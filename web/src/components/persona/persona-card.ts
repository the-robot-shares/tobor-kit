/**
 * `<tobor-persona-card>` — party-card identity chrome for a selectable persona.
 * Extends `<tobor-party-card>` (avatar / badges / actions slots). Emits
 * `persona-select` `{personaId}`; the host owns the switch. Never navigates.
 */

import {html, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';

import {emit} from '../../events.js';
import {ToborPartyCard} from '../party-card/party-card.js';
import type {PersonaSelectDetail} from './types.js';
import {defineElement} from '../../define.js';

@defineElement('tobor-persona-card')
export class ToborPersonaCard extends ToborPartyCard {
  @property({type: String, attribute: 'persona-id', reflect: true})
  personaId = '';

  protected override get cardCy(): string {
    return 'persona.card';
  }

  protected override renderExtraActions(): TemplateResult {
    return html`
      <button
        type="button"
        part="select"
        ?disabled=${!this.personaId}
        @click=${this.onSelect}
      >
        Select
      </button>
    `;
  }

  private readonly onSelect = (): void => {
    if (!this.personaId) return;
    emit<PersonaSelectDetail>(this, 'persona-select', {personaId: this.personaId});
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'tobor-persona-card': ToborPersonaCard;
  }
}
