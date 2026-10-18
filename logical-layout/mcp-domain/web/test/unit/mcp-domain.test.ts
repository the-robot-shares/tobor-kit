import {expect, fixture, html, oneEvent} from '@open-wc/testing';
import {ToborMcpDomain} from '../../tobor-mcp-domain.js';
import {
  SAMPLE_INVENTORY,
  SAMPLE_TOOLS,
  visibleInventory,
  type ToolVisibilityChangeDetail,
} from '../../types.js';

describe('tobor-mcp-domain', () => {
  it('renders tool rows and data-cy hooks', async () => {
    const el = await fixture<ToborMcpDomain>(html`<tobor-mcp-domain></tobor-mcp-domain>`);
    el.tools = SAMPLE_TOOLS;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[data-cy="mcp.domain"]')).to.exist;
    const rows = el.shadowRoot!.querySelectorAll('[data-cy="mcp.tool"]');
    expect(rows).to.have.lengthOf(3);
    expect(rows[0].getAttribute('data-tool')).to.equal('Github.PullCreate');
    expect(rows[0].getAttribute('data-visibility')).to.equal('visible');
    expect(el.shadowRoot!.querySelector('tobor-tool-list')).to.exist;
  });

  it('changing visibility emits tool-visibility-change and updates tools', async () => {
    const el = await fixture<ToborMcpDomain>(html`<tobor-mcp-domain></tobor-mcp-domain>`);
    el.tools = SAMPLE_TOOLS.map((row) => ({...row}));
    await el.updateComplete;
    const select = el.shadowRoot!.querySelector<HTMLSelectElement>(
      '[data-cy="mcp.tool"][data-tool="Github.PullCreate"] select',
    )!;
    const pending = oneEvent(el, 'tool-visibility-change');
    select.value = 'disabled';
    select.dispatchEvent(new Event('change'));
    const ev = (await pending) as CustomEvent<ToolVisibilityChangeDetail>;
    expect(ev.detail).to.deep.equal({name: 'Github.PullCreate', visibility: 'disabled'});
    expect(el.tools.find((row) => row.name === 'Github.PullCreate')?.visibility).to.equal(
      'disabled',
    );
  });

  it('composes tobor-tool-list with only visible tools', async () => {
    const el = await fixture<ToborMcpDomain>(html`<tobor-mcp-domain></tobor-mcp-domain>`);
    el.tools = SAMPLE_TOOLS;
    el.inventory = SAMPLE_INVENTORY;
    await el.updateComplete;
    const preview = el.shadowRoot!.querySelector('tobor-tool-list') as HTMLElement & {
      inventory?: {tools: {name: string}[]};
    };
    expect(preview.inventory?.tools.map((tool) => tool.name)).to.deep.equal(['Github.PullCreate']);
    const inner = preview.shadowRoot!;
    expect(inner.querySelector('[data-tool="Github.PullCreate"]')).to.exist;
    expect(inner.querySelector('[data-tool="Filesystem.Write"]')).to.equal(null);
  });

  it('shows empty copy when tools is empty', async () => {
    const el = await fixture<ToborMcpDomain>(html`<tobor-mcp-domain></tobor-mcp-domain>`);
    await el.updateComplete;
    expect(el.shadowRoot!.textContent).to.include('No tools.');
    expect(el.shadowRoot!.querySelector('[data-cy="mcp.tool"]')).to.equal(null);
  });
});

describe('visibleInventory', () => {
  it('filters dressed inventory to visible names', () => {
    const out = visibleInventory(SAMPLE_TOOLS, SAMPLE_INVENTORY);
    expect(out.tools.map((tool) => tool.name)).to.deep.equal(['Github.PullCreate']);
    expect(out.groups.map((group) => group.id)).to.deep.equal(['Github']);
  });
});
