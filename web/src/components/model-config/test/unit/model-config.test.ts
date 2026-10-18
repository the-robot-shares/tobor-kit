import {fixture, expect, html, oneEvent, waitUntil} from '@open-wc/testing';
import '../../noizu-model-config.js';
import {
  INHERIT_OPTION,
  type CustomEndpointSaveDetail,
  type ModelChangeDetail,
  type NoizuModelConfig,
} from '../../noizu-model-config.js';

const CATALOG = [
  {provider: 'openai', model: 'gpt-4o', label: 'GPT-4o'},
  {provider: 'anthropic', model: 'claude-3-5', label: 'Claude 3.5'},
];

function picker(el: NoizuModelConfig): HTMLSelectElement {
  return el.shadowRoot!.querySelector<HTMLSelectElement>('[data-cy="model.picker"]')!;
}

describe('noizu-model-config', () => {
  const origFetch = window.fetch;

  afterEach(() => {
    window.fetch = origFetch;
  });

  it('sets catalog + value', async () => {
    const el = await fixture<NoizuModelConfig>(
      html`<noizu-model-config .catalog=${CATALOG} value="openai:gpt-4o"></noizu-model-config>`,
    );
    await el.updateComplete;
    const select = picker(el);
    expect(select).to.exist;
    expect(select.value).to.equal('openai:gpt-4o');
    expect([...select.options].map((o) => o.value)).to.include('anthropic:claude-3-5');
    expect([...select.options].map((o) => o.textContent?.trim())).to.include('GPT-4o');
    expect(el.value).to.equal('openai:gpt-4o');
    expect(el.getAttribute('value')).to.equal('openai:gpt-4o');
  });

  it('changing select emits model-change', async () => {
    const el = await fixture<NoizuModelConfig>(
      html`<noizu-model-config .catalog=${CATALOG} value="openai:gpt-4o"></noizu-model-config>`,
    );
    await el.updateComplete;
    const select = picker(el);
    const pending = oneEvent(el, 'model-change');
    select.value = 'anthropic:claude-3-5';
    select.dispatchEvent(new Event('change'));
    const ev = (await pending) as CustomEvent<ModelChangeDetail>;
    expect(ev.detail.value).to.equal('anthropic:claude-3-5');
    expect(el.value).to.equal('anthropic:claude-3-5');
  });

  it('inherit option present when inherit=true', async () => {
    const el = await fixture<NoizuModelConfig>(
      html`<noizu-model-config .catalog=${CATALOG} inherit></noizu-model-config>`,
    );
    await el.updateComplete;
    const select = picker(el);
    const inheritOpt = select.querySelector(`option[value="${INHERIT_OPTION}"]`);
    expect(inheritOpt).to.exist;
    expect(inheritOpt?.textContent?.trim()).to.equal('Inherit');
    expect(select.value).to.equal(INHERIT_OPTION);
  });

  it('inherit option absent when inherit is false', async () => {
    const el = await fixture<NoizuModelConfig>(
      html`<noizu-model-config .catalog=${CATALOG}></noizu-model-config>`,
    );
    await el.updateComplete;
    expect(picker(el).querySelector(`option[value="${INHERIT_OPTION}"]`)).to.not.exist;
  });

  it('selecting inherit emits model-change with empty value', async () => {
    const el = await fixture<NoizuModelConfig>(
      html`<noizu-model-config
        .catalog=${CATALOG}
        value="openai:gpt-4o"
        inherit
      ></noizu-model-config>`,
    );
    await el.updateComplete;
    const select = picker(el);
    const pending = oneEvent(el, 'model-change');
    select.value = INHERIT_OPTION;
    select.dispatchEvent(new Event('change'));
    const ev = (await pending) as CustomEvent<ModelChangeDetail>;
    expect(ev.detail.value).to.equal('');
    expect(el.value).to.equal('');
  });

  it('empty custom key on save means keep stored', async () => {
    const el = await fixture<NoizuModelConfig>(
      html`<noizu-model-config
        .catalog=${CATALOG}
        allow-custom
        .customEndpoint=${{baseUrl: 'https://api.example/v1', model: 'local-7b', apiKey: '••••1234'}}
        value="custom:local-7b"
      ></noizu-model-config>`,
    );
    await waitUntil(
      () => el.shadowRoot?.querySelector<HTMLInputElement>('input[name="apiKey"]')?.value === '••••1234',
      'masked key displayed',
    );
    const key = el.shadowRoot!.querySelector<HTMLInputElement>('input[name="apiKey"]')!;
    expect(key.value).to.equal('••••1234');
    const pending = oneEvent(el, 'custom-endpoint-save');
    el.shadowRoot!.querySelector<HTMLButtonElement>('[data-cy="model.save"]')!.click();
    const ev = (await pending) as CustomEvent<CustomEndpointSaveDetail>;
    expect(ev.detail.baseUrl).to.equal('https://api.example/v1');
    expect(ev.detail.model).to.equal('local-7b');
    expect(ev.detail.apiKey).to.equal('');
  });

  it('budget change emits budget-change', async () => {
    const el = await fixture<NoizuModelConfig>(
      html`<noizu-model-config allow-budget budget="10"></noizu-model-config>`,
    );
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector<HTMLInputElement>('[data-cy="model.budget"]')!;
    expect(input).to.exist;
    const pending = oneEvent(el, 'budget-change');
    input.value = '42';
    input.dispatchEvent(new Event('change'));
    const ev = (await pending) as CustomEvent<{amount: number}>;
    expect(ev.detail.amount).to.equal(42);
    expect(el.budget).to.equal(42);
  });

  it('loads catalog-url JSON', async () => {
    window.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      expect(url).to.include('/models.json');
      return new Response(
        JSON.stringify({
          models: [{provider: 'qwen', model: 'qwen3.8-max', label: 'Qwen'}],
        }),
        {status: 200, headers: {'Content-Type': 'application/json'}},
      );
    }) as typeof fetch;

    const el = await fixture<NoizuModelConfig>(
      html`<noizu-model-config catalog-url="https://example.test/models.json"></noizu-model-config>`,
    );
    await waitUntil(() => picker(el).querySelector('option[value="qwen:qwen3.8-max"]'), 'catalog loaded');
    expect(picker(el).querySelector('option[value="qwen:qwen3.8-max"]')?.textContent?.trim()).to.equal(
      'Qwen',
    );
  });
});
