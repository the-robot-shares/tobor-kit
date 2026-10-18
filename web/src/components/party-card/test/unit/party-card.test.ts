import {expect, fixture, html, oneEvent} from '@open-wc/testing';
import '../../../robot-avatar/robot-avatar.js';
import '../../party-card.js';
import '../../agent-card.js';
import '../../user-card.js';
import {ToborPartyCard} from '../../party-card.js';
import {ToborAgentCard, type AgentChatDetail} from '../../agent-card.js';
import {ToborUserCard, type UserProfileDetail} from '../../user-card.js';

function cy(el: HTMLElement, name: string): HTMLElement | null {
  return el.shadowRoot!.querySelector(`[data-cy="${name}"]`);
}

describe('tobor-party-card', () => {
  it('registers the custom element', () => {
    expect(customElements.get('tobor-party-card')).to.equal(ToborPartyCard);
  });

  it('renders name, handle, presence, and data-cy hooks', async () => {
    const el = await fixture<ToborPartyCard>(
      html`<tobor-party-card display-name="Nova" handle="@nova" presence="online"></tobor-party-card>`,
    );
    expect(cy(el, 'party.card')).to.exist;
    expect(cy(el, 'party.name')?.textContent).to.equal('Nova');
    expect(cy(el, 'party.handle')?.textContent).to.equal('@nova');
    expect(cy(el, 'party.presence')?.getAttribute('data-presence')).to.equal('online');
    expect(cy(el, 'party.presence')?.hasAttribute('hidden')).to.equal(false);
    expect(el.shadowRoot!.querySelector('.initials')?.textContent?.trim()).to.equal('N');
  });

  it('clamps unknown presence to offline', async () => {
    const el = await fixture<ToborPartyCard>(
      html`<tobor-party-card presence="ghost"></tobor-party-card>`,
    );
    await el.updateComplete;
    expect(el.presence).to.equal('offline');
    expect(el.getAttribute('presence')).to.equal('offline');
    expect(cy(el, 'party.presence')?.getAttribute('data-presence')).to.equal('offline');
  });

  it('hides the presence dot when hidden', async () => {
    const el = await fixture<ToborPartyCard>(
      html`<tobor-party-card display-name="Nova" presence="hidden"></tobor-party-card>`,
    );
    expect(cy(el, 'party.presence')).to.exist;
    expect(cy(el, 'party.presence')?.hasAttribute('hidden')).to.equal(true);
  });

  it('slots tobor-robot-avatar and hides initials', async () => {
    const el = await fixture<ToborPartyCard>(html`
      <tobor-party-card display-name="Nova">
        <tobor-robot-avatar slot="avatar" state="idle" label="Nova"></tobor-robot-avatar>
      </tobor-party-card>
    `);
    await el.updateComplete;
    const slotted = el.querySelector('tobor-robot-avatar');
    expect(slotted).to.exist;
    expect(slotted!.slot).to.equal('avatar');
    const slot = el.shadowRoot!.querySelector('slot[name="avatar"]') as HTMLSlotElement;
    expect(slot.assignedElements()[0]?.tagName.toLowerCase()).to.equal('tobor-robot-avatar');
  });

  it('projects badges and actions slots', async () => {
    const el = await fixture<ToborPartyCard>(html`
      <tobor-party-card display-name="Nova">
        <span slot="badges" id="extra-badge">VIP</span>
        <button slot="actions" id="extra-action" type="button">Ping</button>
      </tobor-party-card>
    `);
    expect(el.querySelector('#extra-badge')?.textContent).to.equal('VIP');
    expect(el.querySelector('#extra-action')?.textContent?.trim()).to.equal('Ping');
  });
});

describe('tobor-agent-card', () => {
  it('registers, extends party-card, and stamps agent.card', async () => {
    expect(customElements.get('tobor-agent-card')).to.equal(ToborAgentCard);
    const el = await fixture<ToborAgentCard>(
      html`<tobor-agent-card display-name="Nova" handle="@nova" presence="online" agent-id="nova" model-badge="gpt-4o"></tobor-agent-card>`,
    );
    expect(el).to.be.instanceOf(ToborPartyCard);
    expect(cy(el, 'agent.card')).to.exist;
    expect(cy(el, 'party.card')).to.equal(null);
    expect(cy(el, 'party.name')?.textContent).to.equal('Nova');
    expect(el.shadowRoot!.querySelector('[part="model"]')?.textContent).to.equal('gpt-4o');
    expect(el.showCapabilities).to.equal(true);
  });

  it('renders capability chips from the capabilities property', async () => {
    const el = await fixture<ToborAgentCard>(html`<tobor-agent-card agent-id="nova"></tobor-agent-card>`);
    el.capabilities = ['voice', 'tools'];
    await el.updateComplete;
    const caps = cy(el, 'agent.caps');
    expect(caps).to.exist;
    expect([...caps!.querySelectorAll('li')].map((li) => li.textContent)).to.deep.equal([
      'voice',
      'tools',
    ]);
  });

  it('hides chips when show-capabilities is false', async () => {
    const el = await fixture<ToborAgentCard>(
      html`<tobor-agent-card agent-id="nova" show-capabilities="false"></tobor-agent-card>`,
    );
    el.capabilities = ['voice'];
    await el.updateComplete;
    expect(el.showCapabilities).to.equal(false);
    expect(cy(el, 'agent.caps')).to.equal(null);
  });

  it('Chat emits agent-chat {agentId}', async () => {
    const el = await fixture<ToborAgentCard>(
      html`<tobor-agent-card agent-id="nova"></tobor-agent-card>`,
    );
    const pending = oneEvent(el, 'agent-chat');
    cy(el, 'agent.chat')!.click();
    const event = (await pending) as CustomEvent<AgentChatDetail>;
    expect(event.bubbles).to.equal(true);
    expect(event.composed).to.equal(true);
    expect(event.detail).to.deep.equal({agentId: 'nova'});
  });

  it('disables Chat without agent-id', async () => {
    const el = await fixture<ToborAgentCard>(html`<tobor-agent-card></tobor-agent-card>`);
    const btn = cy(el, 'agent.chat') as HTMLButtonElement;
    expect(btn.disabled).to.equal(true);
    let fired = 0;
    el.addEventListener('agent-chat', () => {
      fired += 1;
    });
    btn.click();
    expect(fired).to.equal(0);
  });
});

describe('tobor-user-card', () => {
  it('registers, extends party-card, and stamps role/org', async () => {
    expect(customElements.get('tobor-user-card')).to.equal(ToborUserCard);
    const el = await fixture<ToborUserCard>(
      html`<tobor-user-card display-name="Keith" handle="@keith" user-id="keith" role="Owner" org="Noizu"></tobor-user-card>`,
    );
    expect(el).to.be.instanceOf(ToborPartyCard);
    expect(cy(el, 'user.card')).to.exist;
    expect(cy(el, 'party.name')?.textContent).to.equal('Keith');
    expect(el.shadowRoot!.querySelector('[part="role"]')?.textContent).to.equal('Owner');
    expect(el.shadowRoot!.querySelector('[part="org"]')?.textContent).to.equal('Noizu');
  });

  it('Profile emits user-profile {userId}', async () => {
    const el = await fixture<ToborUserCard>(html`<tobor-user-card user-id="keith"></tobor-user-card>`);
    const pending = oneEvent(el, 'user-profile');
    cy(el, 'user.profile')!.click();
    const event = (await pending) as CustomEvent<UserProfileDetail>;
    expect(event.bubbles).to.equal(true);
    expect(event.composed).to.equal(true);
    expect(event.detail).to.deep.equal({userId: 'keith'});
  });

  it('disables Profile without user-id', async () => {
    const el = await fixture<ToborUserCard>(html`<tobor-user-card></tobor-user-card>`);
    const btn = cy(el, 'user.profile') as HTMLButtonElement;
    expect(btn.disabled).to.equal(true);
    let fired = 0;
    el.addEventListener('user-profile', () => {
      fired += 1;
    });
    btn.click();
    expect(fired).to.equal(0);
  });
});
