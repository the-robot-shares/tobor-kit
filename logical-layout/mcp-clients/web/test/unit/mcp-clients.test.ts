import {expect, fixture, html, oneEvent} from '@open-wc/testing';
import {
  SAMPLE_CLIENTS,
  type ClientAuthorizeDetail,
  type ClientRevokeDetail,
  type ToborMcpClients,
} from '../../tobor-mcp-clients.js';
import '../../tobor-mcp-clients.js';

describe('tobor-mcp-clients', () => {
  it('renders the roster and data-cy hooks', async () => {
    const el = await fixture<ToborMcpClients>(html`<tobor-mcp-clients></tobor-mcp-clients>`);
    el.clients = SAMPLE_CLIENTS;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[data-cy="mcp.clients"]')).to.exist;
    expect(el.shadowRoot!.querySelectorAll('[part="client"]')).to.have.lengthOf(2);
    expect(el.shadowRoot!.querySelectorAll('[data-cy="mcp.authorize"]')).to.have.lengthOf(2);
    expect(el.shadowRoot!.querySelectorAll('[data-cy="mcp.revoke"]')).to.have.lengthOf(2);
    expect(el.shadowRoot!.textContent).to.include('GitHub');
    expect(el.shadowRoot!.textContent).to.include('OAuth');
    expect(el.shadowRoot!.textContent).to.include('API key');
  });

  it('authorize emits client-authorize {id} and does not redirect', async () => {
    const el = await fixture<ToborMcpClients>(html`<tobor-mcp-clients></tobor-mcp-clients>`);
    el.clients = SAMPLE_CLIENTS;
    await el.updateComplete;
    const href = window.location.href;
    const pending = oneEvent(el, 'client-authorize');
    el.shadowRoot!.querySelector<HTMLButtonElement>(
      '[data-cy="mcp.authorize"][data-client-id="github"]',
    )!.click();
    const ev = (await pending) as CustomEvent<ClientAuthorizeDetail>;
    expect(ev.detail).to.deep.equal({id: 'github'});
    expect(window.location.href).to.equal(href);
  });

  it('revoke emits client-revoke {id}', async () => {
    const el = await fixture<ToborMcpClients>(html`<tobor-mcp-clients></tobor-mcp-clients>`);
    el.clients = SAMPLE_CLIENTS;
    await el.updateComplete;
    const pending = oneEvent(el, 'client-revoke');
    el.shadowRoot!.querySelector<HTMLButtonElement>(
      '[data-cy="mcp.revoke"][data-client-id="search"]',
    )!.click();
    const ev = (await pending) as CustomEvent<ClientRevokeDetail>;
    expect(ev.detail).to.deep.equal({id: 'search'});
  });

  it('shows empty copy when clients is empty', async () => {
    const el = await fixture<ToborMcpClients>(html`<tobor-mcp-clients></tobor-mcp-clients>`);
    await el.updateComplete;
    expect(el.shadowRoot!.textContent).to.include('No clients.');
    expect(el.shadowRoot!.querySelector('[data-cy="mcp.authorize"]')).to.equal(null);
  });
});
