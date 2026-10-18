import {expect, fixture, html, oneEvent, waitUntil} from '@open-wc/testing';
import '../../tobor-configurator.js';
import type {ConfiguratorSchema, ToborConfigurator} from '../../tobor-configurator.js';

const SCHEMA: ConfiguratorSchema = {
  tag: 'demo-widget',
  group: 'display',
  importPath: 'demo-widget.js',
  demoHtml: '<demo-widget label="Hello"></demo-widget>',
  backend: 'none',
  fields: [
    {attr: 'label', type: 'string', required: true, default: 'Hello'},
    {attr: 'count', type: 'number', default: 1},
    {attr: 'enabled', type: 'boolean', default: false},
    {attr: 'tone', type: 'select', options: ['info', 'warn'], default: 'info'},
    {attr: 'id', type: 'string', uneditable: true, default: 'locked'},
  ],
};

function field(el: ToborConfigurator, name: string): HTMLElement {
  return el.shadowRoot!.querySelector(`[data-cy="configurator.field"][data-field="${name}"]`) as HTMLElement;
}

describe('tobor-configurator', () => {
  const origFetch = window.fetch;

  afterEach(() => {
    window.fetch = origFetch;
  });

  it('renders fields from a schema property', async () => {
    const el = await fixture<ToborConfigurator>(html`<tobor-configurator></tobor-configurator>`);
    el.schema = SCHEMA;
    await el.updateComplete;

    expect(el.shadowRoot!.querySelector('[data-cy="configurator.form"]')).to.exist;
    expect(el.shadowRoot!.querySelector('[data-cy="configurator.preview"]')).to.exist;
    expect(el.shadowRoot!.querySelector('[data-cy="configurator.snippet"]')).to.exist;
    expect(el.shadowRoot!.querySelector('[data-cy="configurator.apply"]')).to.exist;

    expect(field(el, 'label')).to.exist;
    expect(field(el, 'count')).to.exist;
    expect(field(el, 'enabled')).to.exist;
    expect(field(el, 'tone')).to.exist;
    expect(field(el, 'id')).to.exist;

    const label = field(el, 'label').querySelector('input')!;
    expect(label.value).to.equal('Hello');
    expect(label.required).to.equal(true);

    const locked = field(el, 'id').querySelector('input')!;
    expect(locked.disabled).to.equal(true);
    expect(locked.value).to.equal('locked');

    const preview = el.shadowRoot!.querySelector('[data-cy="configurator.preview"] demo-widget');
    expect(preview).to.exist;
    expect(preview!.getAttribute('label')).to.equal('Hello');

    const snippet = el.shadowRoot!.querySelector('[data-cy="configurator.snippet"]')!;
    expect(snippet.textContent).to.contain('<demo-widget');
    expect(snippet.textContent).to.contain('label="Hello"');
  });

  it('apply() fires configurator-apply', async () => {
    const el = await fixture<ToborConfigurator>(html`<tobor-configurator></tobor-configurator>`);
    el.schema = SCHEMA;
    await el.updateComplete;

    const fired = oneEvent(el, 'configurator-apply');
    el.apply();
    const event = await fired;
    expect(event.bubbles).to.equal(true);
    expect(event.composed).to.equal(true);
    expect(event.detail.tag).to.equal('demo-widget');
    expect(event.detail.attributes.label).to.equal('Hello');
    expect(event.detail.attributes.enabled).to.equal(false);
    expect(event.detail.attributes.id).to.equal('locked');
  });

  it('Apply button fires configurator-apply', async () => {
    const el = await fixture<ToborConfigurator>(html`<tobor-configurator></tobor-configurator>`);
    el.schema = SCHEMA;
    await el.updateComplete;

    const fired = oneEvent(el, 'configurator-apply');
    (el.shadowRoot!.querySelector('[data-cy="configurator.apply"]') as HTMLButtonElement).click();
    const event = await fired;
    expect(event.detail.tag).to.equal('demo-widget');
  });

  it('emits configurator-change when a field is edited', async () => {
    const el = await fixture<ToborConfigurator>(html`<tobor-configurator></tobor-configurator>`);
    el.schema = SCHEMA;
    await el.updateComplete;

    const input = field(el, 'label').querySelector('input')!;
    const fired = oneEvent(el, 'configurator-change');
    input.value = 'World';
    input.dispatchEvent(new Event('input', {bubbles: true}));
    const event = await fired;
    expect(event.detail.attributes.label).to.equal('World');
  });

  it('reads a child JSON script', async () => {
    const el = await fixture<ToborConfigurator>(html`<tobor-configurator></tobor-configurator>`);
    const script = document.createElement('script');
    script.type = 'application/json';
    script.textContent = JSON.stringify(SCHEMA);
    el.append(script);
    await waitUntil(
      () => !!el.shadowRoot?.querySelector('[data-cy="configurator.form"]'),
      'form from script',
    );
    expect(field(el, 'label')).to.exist;
  });

  it('fetches schema-src JSON', async () => {
    window.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      expect(url).to.contain('demo-schema.json');
      return new Response(JSON.stringify(SCHEMA), {
        status: 200,
        headers: {'Content-Type': 'application/json'},
      });
    }) as typeof fetch;

    const el = await fixture<ToborConfigurator>(
      html`<tobor-configurator schema-src="/demo-schema.json"></tobor-configurator>`,
    );
    await waitUntil(
      () => !!el.shadowRoot?.querySelector('[data-cy="configurator.form"]'),
      'form from schema-src',
    );
    expect(field(el, 'label')).to.exist;
  });
});
