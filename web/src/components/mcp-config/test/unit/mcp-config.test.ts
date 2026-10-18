import {expect, fixture, html, oneEvent} from '@open-wc/testing';
import {
  extrasForEvent,
  type McpConfigChangeDetail,
  type ToborMcpConfig,
} from '../../tobor-mcp-config.js';
import '../../tobor-mcp-config.js';

function save(el: ToborMcpConfig): HTMLButtonElement {
  return el.shadowRoot!.querySelector<HTMLButtonElement>('[data-cy="mcp.save"]')!;
}

describe('tobor-mcp-config', () => {
  it('renders form hooks and reflects url/transport', async () => {
    const el = await fixture<ToborMcpConfig>(
      html`<tobor-mcp-config url="https://mcp.example.test/mcp" transport="sse"></tobor-mcp-config>`,
    );
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[data-cy="mcp.config"]')).to.exist;
    expect(save(el)).to.exist;
    expect(el.url).to.equal('https://mcp.example.test/mcp');
    expect(el.getAttribute('url')).to.equal('https://mcp.example.test/mcp');
    expect(el.transport).to.equal('sse');
    const select = el.shadowRoot!.querySelector<HTMLSelectElement>('[part="transport"]')!;
    expect(select.value).to.equal('sse');
  });

  it('save emits config-change {url, transport}', async () => {
    const el = await fixture<ToborMcpConfig>(
      html`<tobor-mcp-config url="https://mcp.example.test/mcp" transport="http"></tobor-mcp-config>`,
    );
    await el.updateComplete;
    const pending = oneEvent(el, 'config-change');
    save(el).click();
    const ev = (await pending) as CustomEvent<McpConfigChangeDetail>;
    expect(ev.detail).to.deep.equal({url: 'https://mcp.example.test/mcp', transport: 'http'});
    expect('extras' in ev.detail).to.equal(false);
  });

  it('includes extras when the host set a nonempty object', async () => {
    const el = await fixture<ToborMcpConfig>(
      html`<tobor-mcp-config url="/usr/local/bin/mcp" transport="stdio"></tobor-mcp-config>`,
    );
    el.extras = {timeoutMs: 5000};
    await el.updateComplete;
    const pending = oneEvent(el, 'config-change');
    save(el).click();
    const ev = (await pending) as CustomEvent<McpConfigChangeDetail>;
    expect(ev.detail.transport).to.equal('stdio');
    expect(ev.detail.extras).to.deep.equal({timeoutMs: 5000});
  });

  it('omits empty extras', () => {
    expect(extrasForEvent(null)).to.equal(undefined);
    expect(extrasForEvent({})).to.equal(undefined);
    expect(extrasForEvent({timeoutMs: 1})).to.deep.equal({timeoutMs: 1});
  });
});
