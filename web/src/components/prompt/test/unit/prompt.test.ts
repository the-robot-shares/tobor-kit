import {expect, fixture, html, oneEvent} from '@open-wc/testing';
import {ToborPromptLibrary} from '../../tobor-prompt-library.js';
import {ToborPromptHistory} from '../../tobor-prompt-history.js';
import {
  filterPrompts,
  formatPromptStamp,
  promptPlainText,
  type PromptHistoryEntry,
  type PromptRecord,
} from '../../types.js';

const PROMPTS: PromptRecord[] = [
  {
    id: 'sys',
    title: 'System',
    body: '<img src=x onerror=alert(1)><b>bold</b>\n::npl\nsection.foo',
    starred: true,
  },
  {id: 'brief', title: 'Brief', body: 'Be concise.'},
];

const ENTRIES: PromptHistoryEntry[] = [
  {id: 'sys-v1', title: 'System', at: '2026-01-01T12:00:00Z', version: 1},
  {id: 'sys-v2', title: 'System', at: 'not-a-date', version: 2, starred: true},
];

describe('filterPrompts', () => {
  it('returns rows with id when query is empty', () => {
    expect(filterPrompts([{id: '', title: 'X', body: 'Y'}, ...PROMPTS], '  ').map((row) => row.id)).to.deep.equal([
      'sys',
      'brief',
    ]);
  });

  it('matches id, title, and body case-insensitively', () => {
    expect(filterPrompts(PROMPTS, 'SYS').map((row) => row.id)).to.deep.equal(['sys']);
    expect(filterPrompts(PROMPTS, 'brief').map((row) => row.id)).to.deep.equal(['brief']);
    expect(filterPrompts(PROMPTS, 'concise').map((row) => row.id)).to.deep.equal(['brief']);
  });
});

describe('tobor-prompt-library', () => {
  it('renders items and emits prompt-select {id}', async () => {
    const el = await fixture<ToborPromptLibrary>(html`<tobor-prompt-library></tobor-prompt-library>`);
    el.prompts = PROMPTS;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[data-cy="prompt.library"]')).to.exist;
    const items = el.shadowRoot!.querySelectorAll('[data-cy="prompt.item"]');
    expect(items).to.have.lengthOf(2);
    expect(items[0]!.textContent).to.include('System');
    const pending = oneEvent(el, 'prompt-select');
    (items[0] as HTMLButtonElement).click();
    const ev = (await pending) as CustomEvent<{id: string}>;
    expect(ev.bubbles).to.equal(true);
    expect(ev.composed).to.equal(true);
    expect(ev.detail.id).to.equal('sys');
    expect(el.selectedId).to.equal('sys');
  });

  it('keeps untrusted body as text in pre (no unsafeHTML)', async () => {
    const el = await fixture<ToborPromptLibrary>(html`<tobor-prompt-library></tobor-prompt-library>`);
    el.prompts = PROMPTS;
    await el.updateComplete;
    const pre = el.shadowRoot!.querySelector('pre')!;
    expect(pre.textContent).to.include('<img src=x onerror=alert(1)>');
    expect(pre.textContent).to.include('<b>bold</b>');
    expect(pre.querySelector('b')).to.equal(null);
    expect(pre.querySelector('img')).to.equal(null);
  });

  it('filters from the query attribute and the search field', async () => {
    const el = await fixture<ToborPromptLibrary>(
      html`<tobor-prompt-library query="brief"></tobor-prompt-library>`,
    );
    el.prompts = PROMPTS;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[data-cy="prompt.item"]')).to.have.lengthOf(1);
    expect(el.shadowRoot!.querySelector('[data-cy="prompt.item"]')?.textContent).to.include('Brief');

    const search = el.shadowRoot!.querySelector('[part="search"]') as HTMLInputElement;
    search.value = 'sys';
    search.dispatchEvent(new Event('input', {bubbles: true, composed: true}));
    await el.updateComplete;
    expect(el.query).to.equal('sys');
    expect(el.getAttribute('query')).to.equal('sys');
    expect(el.shadowRoot!.querySelectorAll('[data-cy="prompt.item"]')).to.have.lengthOf(1);
    expect(el.shadowRoot!.querySelector('[data-cy="prompt.item"]')?.textContent).to.include('System');
  });

  it('emits prompt-star {id, starred} and flips aria-pressed', async () => {
    const el = await fixture<ToborPromptLibrary>(html`<tobor-prompt-library></tobor-prompt-library>`);
    el.prompts = PROMPTS;
    await el.updateComplete;
    const star = el.shadowRoot!.querySelector(
      '[data-cy="prompt.star"][data-prompt-id="sys"]',
    ) as HTMLButtonElement;
    expect(star.getAttribute('aria-pressed')).to.equal('true');
    const pending = oneEvent(el, 'prompt-star');
    star.click();
    const ev = (await pending) as CustomEvent<{id: string; starred: boolean}>;
    expect(ev.detail).to.deep.equal({id: 'sys', starred: false});
    await el.updateComplete;
    expect(
      el.shadowRoot!.querySelector('[data-cy="prompt.star"][data-prompt-id="sys"]')!.getAttribute(
        'aria-pressed',
      ),
    ).to.equal('false');
  });

  it('shows empty copy when prompts is empty', async () => {
    const el = await fixture<ToborPromptLibrary>(html`<tobor-prompt-library></tobor-prompt-library>`);
    await el.updateComplete;
    expect(el.shadowRoot!.textContent).to.include('No prompts.');
    expect(el.shadowRoot!.querySelector('[data-cy="prompt.item"]')).to.equal(null);
  });
});

describe('tobor-prompt-history', () => {
  it('renders entries and emits prompt-fork {id}', async () => {
    const el = await fixture<ToborPromptHistory>(html`<tobor-prompt-history></tobor-prompt-history>`);
    el.entries = ENTRIES;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[data-cy="prompt.history"]')).to.exist;
    const forks = el.shadowRoot!.querySelectorAll('[data-cy="prompt.fork"]');
    expect(forks).to.have.lengthOf(2);
    expect(el.shadowRoot!.textContent).to.include('System');
    expect(el.shadowRoot!.textContent).to.include('v1');
    const pending = oneEvent(el, 'prompt-fork');
    (forks[0] as HTMLButtonElement).click();
    const ev = (await pending) as CustomEvent<{id: string}>;
    expect(ev.bubbles).to.equal(true);
    expect(ev.composed).to.equal(true);
    expect(ev.detail.id).to.equal('sys-v1');
  });

  it('emits prompt-star {id, starred}', async () => {
    const el = await fixture<ToborPromptHistory>(html`<tobor-prompt-history></tobor-prompt-history>`);
    el.entries = ENTRIES;
    await el.updateComplete;
    const pending = oneEvent(el, 'prompt-star');
    (el.shadowRoot!.querySelector(
      '[data-cy="prompt.star"][data-prompt-id="sys-v1"]',
    ) as HTMLButtonElement).click();
    const ev = (await pending) as CustomEvent<{id: string; starred: boolean}>;
    expect(ev.detail).to.deep.equal({id: 'sys-v1', starred: true});
  });

  it('renders side-by-side diff as text (no unsafeHTML)', async () => {
    const el = await fixture<ToborPromptHistory>(html`<tobor-prompt-history></tobor-prompt-history>`);
    el.diff = {
      left: {label: 'v1', body: '<b>old</b>'},
      right: {label: 'v2', body: '<img src=x onerror=alert(1)>new'},
    };
    await el.updateComplete;
    const left = el.shadowRoot!.querySelector('[part="left"] pre')!;
    const right = el.shadowRoot!.querySelector('[part="right"] pre')!;
    expect(left.textContent).to.equal('<b>old</b>');
    expect(right.textContent).to.include('<img src=x onerror=alert(1)>');
    expect(left.querySelector('b')).to.equal(null);
    expect(right.querySelector('img')).to.equal(null);
  });

  it('hides built-in diff when the diff slot has content', async () => {
    const el = await fixture<ToborPromptHistory>(html`
      <tobor-prompt-history>
        <pre slot="diff">host diff</pre>
      </tobor-prompt-history>
    `);
    el.diff = {left: {body: 'kit left'}, right: {body: 'kit right'}};
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="diff"]')).to.equal(null);
    expect(el.querySelector('[slot="diff"]')?.textContent).to.equal('host diff');
  });

  it('shows empty copy when entries is empty', async () => {
    const el = await fixture<ToborPromptHistory>(html`<tobor-prompt-history></tobor-prompt-history>`);
    await el.updateComplete;
    expect(el.shadowRoot!.textContent).to.include('No history.');
    expect(el.shadowRoot!.querySelector('[data-cy="prompt.fork"]')).to.equal(null);
  });
});

describe('promptPlainText / formatPromptStamp', () => {
  it('keeps markup as characters', () => {
    expect(promptPlainText('<b>x</b>')).to.equal('<b>x</b>');
    expect(promptPlainText(null)).to.equal('');
  });

  it('formats parseable stamps and leaves others', () => {
    expect(formatPromptStamp('2026-01-01T12:00:00Z')).to.equal('2026-01-01 12:00 UTC');
    expect(formatPromptStamp('not-a-date')).to.equal('not-a-date');
    expect(formatPromptStamp(undefined)).to.equal('');
  });
});
