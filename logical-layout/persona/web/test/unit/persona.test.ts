import {expect, fixture, html, oneEvent} from '@open-wc/testing';
import '../../persona-card.js';
import '../../persona-picker.js';
import {ToborPersonaCard} from '../../persona-card.js';
import {ToborPartyCard} from '../../../party-card/party-card.js';
import {filterPersonas, ToborPersonaPicker} from '../../persona-picker.js';
import type {PersonaEntry, PersonaSelectDetail} from '../../types.js';

function byCy(el: HTMLElement, name: string): HTMLElement | null {
  return el.shadowRoot!.querySelector(`[data-cy="${name}"]`);
}

function selectBtn(el: ToborPersonaCard): HTMLButtonElement | null {
  return el.shadowRoot!.querySelector('[part="select"]');
}

const SAMPLE: PersonaEntry[] = [
  {id: 'nova', name: 'Nova', handle: '@nova'},
  {id: 'orbit', name: 'Orbit', handle: '@orbit'},
  {id: 'pip', name: 'Pip'},
];

describe('filterPersonas', () => {
  it('returns rows with id and name when query is empty', () => {
    expect(filterPersonas([{id: '', name: 'X'}, ...SAMPLE], '  ')).to.deep.equal(SAMPLE);
  });

  it('matches id, name, and handle case-insensitively', () => {
    expect(filterPersonas(SAMPLE, 'NOV').map((row) => row.id)).to.deep.equal(['nova']);
    expect(filterPersonas(SAMPLE, '@orbit').map((row) => row.id)).to.deep.equal(['orbit']);
    expect(filterPersonas(SAMPLE, 'pip').map((row) => row.id)).to.deep.equal(['pip']);
  });
});

describe('tobor-persona-card', () => {
  it('registers, extends party-card, and stamps persona.card', async () => {
    expect(customElements.get('tobor-persona-card')).to.equal(ToborPersonaCard);
    const el = await fixture<ToborPersonaCard>(
      html`<tobor-persona-card persona-id="nova" display-name="Nova" handle="@nova"></tobor-persona-card>`,
    );
    expect(el).to.be.instanceOf(ToborPartyCard);
    expect(byCy(el, 'persona.card')).to.exist;
    expect(byCy(el, 'party.card')).to.equal(null);
    expect(byCy(el, 'party.name')?.textContent).to.equal('Nova');
    expect(byCy(el, 'party.handle')?.textContent).to.equal('@nova');
    expect(selectBtn(el)?.disabled).to.equal(false);
  });

  it('Select emits persona-select {personaId}', async () => {
    const el = await fixture<ToborPersonaCard>(
      html`<tobor-persona-card persona-id="nova" display-name="Nova"></tobor-persona-card>`,
    );
    const pending = oneEvent(el, 'persona-select');
    selectBtn(el)!.click();
    const event = (await pending) as CustomEvent<PersonaSelectDetail>;
    expect(event.bubbles).to.equal(true);
    expect(event.composed).to.equal(true);
    expect(event.detail).to.deep.equal({personaId: 'nova'});
  });

  it('disables Select without persona-id', async () => {
    const el = await fixture<ToborPersonaCard>(html`<tobor-persona-card></tobor-persona-card>`);
    const btn = selectBtn(el)!;
    expect(btn.disabled).to.equal(true);
    let fired = 0;
    el.addEventListener('persona-select', () => {
      fired += 1;
    });
    btn.click();
    expect(fired).to.equal(0);
  });

  it('projects badges and actions slots', async () => {
    const el = await fixture<ToborPersonaCard>(html`
      <tobor-persona-card persona-id="nova" display-name="Nova">
        <span slot="badges" id="extra-badge">VIP</span>
        <button slot="actions" id="extra-action" type="button">Ping</button>
      </tobor-persona-card>
    `);
    expect(el.querySelector('#extra-badge')?.textContent).to.equal('VIP');
    expect(el.querySelector('#extra-action')?.textContent?.trim()).to.equal('Ping');
  });
});

describe('tobor-persona-picker', () => {
  it('registers and stamps picker / search / item hooks', async () => {
    expect(customElements.get('tobor-persona-picker')).to.equal(ToborPersonaPicker);
    const el = await fixture<ToborPersonaPicker>(html`<tobor-persona-picker></tobor-persona-picker>`);
    el.personas = SAMPLE;
    await el.updateComplete;
    expect(byCy(el, 'persona.picker')).to.exist;
    expect(byCy(el, 'persona.search')).to.exist;
    const items = el.shadowRoot!.querySelectorAll('[data-cy="persona.item"]');
    expect(items).to.have.lengthOf(3);
    expect(items[0]!.getAttribute('data-persona-id')).to.equal('nova');
  });

  it('filters the grid from the query property and the search field', async () => {
    const el = await fixture<ToborPersonaPicker>(html`<tobor-persona-picker></tobor-persona-picker>`);
    el.personas = SAMPLE;
    el.query = 'orb';
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[data-cy="persona.item"]')).to.have.lengthOf(1);
    expect(el.shadowRoot!.querySelector('[data-cy="persona.item"]')?.textContent).to.include('Orbit');

    const search = byCy(el, 'persona.search') as HTMLInputElement;
    search.value = 'pip';
    search.dispatchEvent(new Event('input'));
    await el.updateComplete;
    expect(el.query).to.equal('pip');
    expect(el.getAttribute('query')).to.equal('pip');
    expect(el.shadowRoot!.querySelectorAll('[data-cy="persona.item"]')).to.have.lengthOf(1);
    expect(el.shadowRoot!.querySelector('[data-cy="persona.item"]')?.textContent).to.include('Pip');
  });

  it('item click emits persona-select {personaId}', async () => {
    const el = await fixture<ToborPersonaPicker>(html`<tobor-persona-picker></tobor-persona-picker>`);
    el.personas = SAMPLE;
    await el.updateComplete;
    const pending = oneEvent(el, 'persona-select');
    (el.shadowRoot!.querySelector('[data-persona-id="orbit"]') as HTMLButtonElement).click();
    const event = (await pending) as CustomEvent<PersonaSelectDetail>;
    expect(event.bubbles).to.equal(true);
    expect(event.composed).to.equal(true);
    expect(event.detail).to.deep.equal({personaId: 'orbit'});
  });

  it('shows empty copy when the host supplies no roster', async () => {
    const el = await fixture<ToborPersonaPicker>(html`<tobor-persona-picker></tobor-persona-picker>`);
    expect(el.shadowRoot!.querySelector('[part="empty"]')?.textContent).to.equal('No personas');
    expect(el.shadowRoot!.querySelector('[data-cy="persona.item"]')).to.equal(null);
  });
});
