import {expect, fixture, html, oneEvent} from '@open-wc/testing';
import '../../noizu-sg-btn.js';
import '../../noizu-sg-card.js';
import '../../noizu-sg-card-grid.js';
import '../../noizu-sg-status.js';
import '../../noizu-sg-input.js';
import '../../noizu-sg-spec-table.js';
import '../../noizu-sg-steps.js';
import type {NoizuSgBtn, SgClickDetail} from '../../noizu-sg-btn.js';
import type {NoizuSgCard, SgCardSelectDetail} from '../../noizu-sg-card.js';
import type {NoizuSgCardGrid} from '../../noizu-sg-card-grid.js';
import type {NoizuSgStatus} from '../../noizu-sg-status.js';
import type {NoizuSgInput, SgInputDetail} from '../../noizu-sg-input.js';
import type {NoizuSgSpecTable} from '../../noizu-sg-spec-table.js';
import type {NoizuSgSteps} from '../../noizu-sg-steps.js';

function cy<T extends HTMLElement>(el: HTMLElement, name: string): T | null {
  return el.shadowRoot!.querySelector(`[data-cy="${name}"]`);
}

describe('noizu-sg-btn', () => {
  it('defaults variant primary, size md, type button', async () => {
    const el = await fixture<NoizuSgBtn>(html`<noizu-sg-btn>Go</noizu-sg-btn>`);
    const btn = cy<HTMLButtonElement>(el, 'sg.btn')!;
    expect(el.variant).to.equal('primary');
    expect(el.size).to.equal('md');
    expect(el.type).to.equal('button');
    expect(el.disabled).to.equal(false);
    expect(btn.getAttribute('data-variant')).to.equal('primary');
    expect(btn.getAttribute('data-size')).to.equal('md');
    expect(btn.getAttribute('type')).to.equal('button');
    const slot = el.shadowRoot!.querySelector('slot') as HTMLSlotElement;
    expect(slot.assignedNodes().some((n) => (n.textContent ?? '').includes('Go'))).to.equal(true);
  });

  it('unknown variant/size/type fall back for rendering', async () => {
    const el = await fixture<NoizuSgBtn>(html`<noizu-sg-btn variant="nope" size="xl" type="reset">X</noizu-sg-btn>`);
    const btn = cy<HTMLButtonElement>(el, 'sg.btn')!;
    expect(btn.getAttribute('data-variant')).to.equal('primary');
    expect(btn.getAttribute('data-size')).to.equal('md');
    expect(btn.getAttribute('type')).to.equal('button');
  });

  it('click emits sg-click {}', async () => {
    const el = await fixture<NoizuSgBtn>(html`<noizu-sg-btn>Go</noizu-sg-btn>`);
    const pending = oneEvent(el, 'sg-click');
    cy<HTMLButtonElement>(el, 'sg.btn')!.click();
    const event = (await pending) as CustomEvent<SgClickDetail>;
    expect(event.bubbles).to.equal(true);
    expect(event.composed).to.equal(true);
    expect(event.detail).to.deep.equal({});
  });

  it('disabled suppresses sg-click', async () => {
    const el = await fixture<NoizuSgBtn>(html`<noizu-sg-btn disabled>Go</noizu-sg-btn>`);
    let fired = 0;
    el.addEventListener('sg-click', () => {
      fired += 1;
    });
    cy<HTMLButtonElement>(el, 'sg.btn')!.click();
    await el.updateComplete;
    expect(fired).to.equal(0);
    expect(cy<HTMLButtonElement>(el, 'sg.btn')!.disabled).to.equal(true);
  });
});

describe('noizu-sg-card', () => {
  it('renders slots and an article when href is empty', async () => {
    const el = await fixture<NoizuSgCard>(html`
      <noizu-sg-card>
        <span slot="header">H</span>
        Body
        <span slot="footer">F</span>
      </noizu-sg-card>
    `);
    const surface = cy<HTMLElement>(el, 'sg.card')!;
    expect(surface.tagName).to.equal('ARTICLE');
    const header = el.shadowRoot!.querySelector('slot[name="header"]') as HTMLSlotElement;
    const footer = el.shadowRoot!.querySelector('slot[name="footer"]') as HTMLSlotElement;
    const body = el.shadowRoot!.querySelector('slot:not([name])') as HTMLSlotElement;
    expect(header.assignedElements()[0]?.textContent).to.equal('H');
    expect(footer.assignedElements()[0]?.textContent).to.equal('F');
    expect(body.assignedNodes().some((n) => (n.textContent ?? '').includes('Body'))).to.equal(true);
  });

  it('href makes the surface a link and emits sg-card-select {href}', async () => {
    const el = await fixture<NoizuSgCard>(html`<noizu-sg-card href="/plans">Pro</noizu-sg-card>`);
    const link = cy<HTMLAnchorElement>(el, 'sg.card')!;
    expect(link.tagName).to.equal('A');
    expect(link.getAttribute('href')).to.equal('/plans');
    el.addEventListener('sg-card-select', (event) => event.preventDefault());
    const pending = oneEvent(el, 'sg-card-select');
    link.click();
    const event = (await pending) as CustomEvent<SgCardSelectDetail>;
    expect(event.bubbles).to.equal(true);
    expect(event.composed).to.equal(true);
    expect(event.cancelable).to.equal(true);
    expect(event.detail).to.deep.equal({href: '/plans'});
  });

  it('preventDefault on sg-card-select cancels the inner link', async () => {
    const el = await fixture<NoizuSgCard>(html`<noizu-sg-card href="/plans">Pro</noizu-sg-card>`);
    el.addEventListener('sg-card-select', (event) => event.preventDefault());
    const link = cy<HTMLAnchorElement>(el, 'sg.card')!;
    const click = new MouseEvent('click', {bubbles: true, cancelable: true, composed: true});
    link.dispatchEvent(click);
    expect(click.defaultPrevented).to.equal(true);
  });
});

describe('noizu-sg-card-grid', () => {
  it('defaults columns to 3 and slots cards', async () => {
    const el = await fixture<NoizuSgCardGrid>(html`
      <noizu-sg-card-grid>
        <noizu-sg-card>A</noizu-sg-card>
        <noizu-sg-card>B</noizu-sg-card>
      </noizu-sg-card-grid>
    `);
    expect(el.columns).to.equal(3);
    const grid = cy<HTMLElement>(el, 'sg.grid')!;
    expect(grid.getAttribute('data-columns')).to.equal('3');
    expect(grid.style.getPropertyValue('--sg-columns').trim()).to.equal('3');
    const slot = el.shadowRoot!.querySelector('slot') as HTMLSlotElement;
    expect(slot.assignedElements().length).to.equal(2);
  });

  it('columns attribute sets the grid track count', async () => {
    const el = await fixture<NoizuSgCardGrid>(html`<noizu-sg-card-grid columns="2"></noizu-sg-card-grid>`);
    const grid = cy<HTMLElement>(el, 'sg.grid')!;
    expect(el.columns).to.equal(2);
    expect(grid.getAttribute('data-columns')).to.equal('2');
    expect(grid.style.getPropertyValue('--sg-columns').trim()).to.equal('2');
  });

  it('non-positive columns fall back to 3', async () => {
    const el = await fixture<NoizuSgCardGrid>(html`<noizu-sg-card-grid columns="0"></noizu-sg-card-grid>`);
    expect(cy<HTMLElement>(el, 'sg.grid')!.getAttribute('data-columns')).to.equal('3');
  });
});

describe('noizu-sg-status', () => {
  it('defaults status idle and stamps data-cy', async () => {
    const el = await fixture<NoizuSgStatus>(html`<noizu-sg-status label="Idle"></noizu-sg-status>`);
    const row = cy<HTMLElement>(el, 'sg.status')!;
    expect(el.status).to.equal('idle');
    expect(row.getAttribute('data-status')).to.equal('idle');
    expect(el.shadowRoot!.querySelector('[part="label"]')!.textContent).to.equal('Idle');
    expect(el.shadowRoot!.querySelector('[part="description"]')).to.equal(null);
  });

  it('unknown status falls back to idle for rendering', async () => {
    const el = await fixture<NoizuSgStatus>(html`<noizu-sg-status status="nope"></noizu-sg-status>`);
    expect(cy<HTMLElement>(el, 'sg.status')!.getAttribute('data-status')).to.equal('idle');
  });

  it('renders label and description as text (no HTML)', async () => {
    const el = await fixture<NoizuSgStatus>(html`<noizu-sg-status status="ok"></noizu-sg-status>`);
    el.label = '<b>Ready</b>';
    el.description = '<img src=x onerror=alert(1)>';
    await el.updateComplete;
    const label = el.shadowRoot!.querySelector('[part="label"]')!;
    const description = el.shadowRoot!.querySelector('[part="description"]')!;
    expect(cy<HTMLElement>(el, 'sg.status')!.getAttribute('data-status')).to.equal('ok');
    expect(label.textContent).to.equal('<b>Ready</b>');
    expect(label.querySelector('b')).to.equal(null);
    expect(description.textContent).to.equal('<img src=x onerror=alert(1)>');
    expect(description.querySelector('img')).to.equal(null);
  });
});

describe('noizu-sg-input', () => {
  it('defaults type text and stamps data-cy', async () => {
    const el = await fixture<NoizuSgInput>(html`<noizu-sg-input name="email"></noizu-sg-input>`);
    const field = cy<HTMLInputElement>(el, 'sg.input')!;
    expect(el.type).to.equal('text');
    expect(el.value).to.equal('');
    expect(el.disabled).to.equal(false);
    expect(el.error).to.equal(false);
    expect(field.tagName).to.equal('INPUT');
    expect(field.getAttribute('type')).to.equal('text');
    expect(field.getAttribute('name')).to.equal('email');
    expect(field.getAttribute('aria-invalid')).to.equal('false');
  });

  it('type=textarea renders a textarea', async () => {
    const el = await fixture<NoizuSgInput>(html`<noizu-sg-input type="textarea"></noizu-sg-input>`);
    const field = cy<HTMLTextAreaElement>(el, 'sg.input')!;
    expect(field.tagName).to.equal('TEXTAREA');
  });

  it('unknown type falls back to text', async () => {
    const el = await fixture<NoizuSgInput>(html`<noizu-sg-input type="file"></noizu-sg-input>`);
    expect(cy<HTMLInputElement>(el, 'sg.input')!.getAttribute('type')).to.equal('text');
  });

  it('input emits sg-input {value} and updates value', async () => {
    const el = await fixture<NoizuSgInput>(html`<noizu-sg-input></noizu-sg-input>`);
    const field = cy<HTMLInputElement>(el, 'sg.input')!;
    const pending = oneEvent(el, 'sg-input');
    field.value = 'hi';
    field.dispatchEvent(new Event('input', {bubbles: true, composed: true}));
    const event = (await pending) as CustomEvent<SgInputDetail>;
    expect(event.bubbles).to.equal(true);
    expect(event.composed).to.equal(true);
    expect(event.detail).to.deep.equal({value: 'hi'});
    expect(el.value).to.equal('hi');
  });

  it('disabled suppresses sg-input', async () => {
    const el = await fixture<NoizuSgInput>(html`<noizu-sg-input disabled></noizu-sg-input>`);
    let fired = 0;
    el.addEventListener('sg-input', () => {
      fired += 1;
    });
    const field = cy<HTMLInputElement>(el, 'sg.input')!;
    expect(field.disabled).to.equal(true);
    field.dispatchEvent(new Event('input', {bubbles: true, composed: true}));
    await el.updateComplete;
    expect(fired).to.equal(0);
  });

  it('error marks aria-invalid', async () => {
    const el = await fixture<NoizuSgInput>(html`<noizu-sg-input error></noizu-sg-input>`);
    const field = cy<HTMLInputElement>(el, 'sg.input')!;
    expect(field.getAttribute('aria-invalid')).to.equal('true');
    expect(field.getAttribute('data-error')).to.equal('true');
  });
});

describe('noizu-sg-spec-table', () => {
  it('renders key/value rows as text only', async () => {
    const el = await fixture<NoizuSgSpecTable>(html`<noizu-sg-spec-table></noizu-sg-spec-table>`);
    el.rows = [
      {key: '<b>Protocol</b>', value: '<img src=x onerror=alert(1)>'},
      {key: 'Region', value: 'us-east-1'},
    ];
    await el.updateComplete;
    const table = cy<HTMLTableElement>(el, 'sg.spec')!;
    expect(table.tagName).to.equal('TABLE');
    const cells = table.querySelectorAll('th, td');
    expect(cells).to.have.lengthOf(4);
    expect(cells[0].textContent).to.equal('<b>Protocol</b>');
    expect(cells[1].textContent).to.equal('<img src=x onerror=alert(1)>');
    expect(cells[0].querySelector('b')).to.equal(null);
    expect(cells[1].querySelector('img')).to.equal(null);
    expect(cells[2].textContent).to.equal('Region');
    expect(cells[3].textContent).to.equal('us-east-1');
  });

  it('non-array rows render an empty table', async () => {
    const el = await fixture<NoizuSgSpecTable>(html`<noizu-sg-spec-table></noizu-sg-spec-table>`);
    (el as unknown as {rows: unknown}).rows = {key: 'nope'};
    await el.updateComplete;
    expect(cy<HTMLElement>(el, 'sg.spec')!.querySelectorAll('tr')).to.have.lengthOf(0);
  });
});

describe('noizu-sg-steps', () => {
  it('defaults current 0 and renders labels as text', async () => {
    const el = await fixture<NoizuSgSteps>(html`<noizu-sg-steps></noizu-sg-steps>`);
    el.steps = ['Plan', '<b>Build</b>', 'Ship'];
    await el.updateComplete;
    const list = cy<HTMLElement>(el, 'sg.steps')!;
    expect(el.current).to.equal(0);
    expect(list.getAttribute('data-current')).to.equal('0');
    const items = list.querySelectorAll('[part="step"]');
    expect(items).to.have.lengthOf(3);
    expect(items[0].getAttribute('data-state')).to.equal('current');
    expect(items[1].getAttribute('data-state')).to.equal('todo');
    expect(items[1].querySelector('[part="label"]')!.textContent).to.equal('<b>Build</b>');
    expect(items[1].querySelector('b')).to.equal(null);
  });

  it('current marks done / current / todo', async () => {
    const el = await fixture<NoizuSgSteps>(html`<noizu-sg-steps current="1"></noizu-sg-steps>`);
    el.steps = ['Plan', 'Build', 'Ship'];
    await el.updateComplete;
    const items = cy<HTMLElement>(el, 'sg.steps')!.querySelectorAll('[part="step"]');
    expect(cy<HTMLElement>(el, 'sg.steps')!.getAttribute('data-current')).to.equal('1');
    expect(items[0].getAttribute('data-state')).to.equal('done');
    expect(items[1].getAttribute('data-state')).to.equal('current');
    expect(items[1].getAttribute('aria-current')).to.equal('step');
    expect(items[2].getAttribute('data-state')).to.equal('todo');
  });

  it('non-finite current falls back to 0', async () => {
    const el = await fixture<NoizuSgSteps>(html`<noizu-sg-steps current="nope"></noizu-sg-steps>`);
    el.steps = ['A'];
    await el.updateComplete;
    expect(cy<HTMLElement>(el, 'sg.steps')!.getAttribute('data-current')).to.equal('0');
  });
});
