import {expect, fixture, html, oneEvent} from '@open-wc/testing';
import {ToborWikiSpace} from '../../tobor-wiki-space.js';
import {ToborWikiEntry} from '../../tobor-wiki-entry.js';
import {ToborWikiEntryEditor} from '../../tobor-wiki-entry-editor.js';
import {wikiPlainText, type WikiEntry, type WikiSpace} from '../../types.js';

const SPACES: WikiSpace[] = [
  {id: 'eng', title: 'Engineering', slug: 'eng'},
  {id: 'ops', title: 'Ops'},
];

const ENTRY: WikiEntry = {
  id: 'eng-readme',
  title: 'README',
  body: '<img src=x onerror=alert(1)><b>bold</b>\n::npl\nsection.foo',
  spaceId: 'eng',
};

describe('tobor-wiki-space', () => {
  it('renders space items and emits wiki-space-select', async () => {
    const el = await fixture<ToborWikiSpace>(html`<tobor-wiki-space></tobor-wiki-space>`);
    el.spaces = SPACES;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[data-cy="wiki.space"]')).to.exist;
    const items = el.shadowRoot!.querySelectorAll('[data-cy="wiki.space-item"]');
    expect(items).to.have.lengthOf(2);
    expect(items[0].textContent).to.include('Engineering');
    expect(items[0].textContent).to.include('eng');
    const pending = oneEvent(el, 'wiki-space-select');
    (items[0] as HTMLButtonElement).click();
    const ev = (await pending) as CustomEvent<{id: string}>;
    expect(ev.detail.id).to.equal('eng');
    expect(el.selectedId).to.equal('eng');
  });

  it('shows empty copy when spaces is empty', async () => {
    const el = await fixture<ToborWikiSpace>(html`<tobor-wiki-space></tobor-wiki-space>`);
    await el.updateComplete;
    expect(el.shadowRoot!.textContent).to.include('No spaces.');
    expect(el.shadowRoot!.querySelector('[data-cy="wiki.space-item"]')).to.equal(null);
  });
});

describe('tobor-wiki-entry', () => {
  it('renders untrusted body as text in pre (no unsafeHTML)', async () => {
    const el = await fixture<ToborWikiEntry>(html`<tobor-wiki-entry></tobor-wiki-entry>`);
    el.entry = ENTRY;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[data-cy="wiki.entry"]')).to.exist;
    const pre = el.shadowRoot!.querySelector('pre')!;
    expect(pre).to.exist;
    expect(pre.textContent).to.include('<img src=x onerror=alert(1)>');
    expect(pre.textContent).to.include('<b>bold</b>');
    expect(pre.textContent).to.include('::npl');
    expect(pre.querySelector('b')).to.equal(null);
    expect(pre.querySelector('img')).to.equal(null);
    expect(el.shadowRoot!.querySelector('[part="title"]')!.textContent).to.equal('README');
  });

  it('emits wiki-edit {id}', async () => {
    const el = await fixture<ToborWikiEntry>(html`<tobor-wiki-entry></tobor-wiki-entry>`);
    el.entry = ENTRY;
    await el.updateComplete;
    const pending = oneEvent(el, 'wiki-edit');
    (el.shadowRoot!.querySelector('[part="edit"]') as HTMLButtonElement).click();
    const ev = (await pending) as CustomEvent<{id: string}>;
    expect(ev.detail.id).to.equal('eng-readme');
  });

  it('does not emit wiki-edit without an id', async () => {
    const el = await fixture<ToborWikiEntry>(html`<tobor-wiki-entry></tobor-wiki-entry>`);
    await el.updateComplete;
    expect(el.shadowRoot!.textContent).to.include('No entry.');
    let fired = false;
    el.addEventListener('wiki-edit', () => {
      fired = true;
    });
    expect(el.shadowRoot!.querySelector('[part="edit"]')).to.equal(null);
    expect(fired).to.equal(false);
  });
});

describe('tobor-wiki-entry-editor', () => {
  it('seeds drafts and emits wiki-save {id, title, body, spaceId}', async () => {
    const el = await fixture<ToborWikiEntryEditor>(
      html`<tobor-wiki-entry-editor></tobor-wiki-entry-editor>`,
    );
    el.entry = ENTRY;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[data-cy="wiki.editor"]')).to.exist;
    const title = el.shadowRoot!.querySelector('[part="title"]') as HTMLInputElement;
    const body = el.shadowRoot!.querySelector('[part="body"]') as HTMLTextAreaElement;
    expect(title.value).to.equal('README');
    expect(body.value).to.include('<b>bold</b>');
    title.value = 'Release notes';
    title.dispatchEvent(new Event('input', {bubbles: true, composed: true}));
    body.value = 'plain source';
    body.dispatchEvent(new Event('input', {bubbles: true, composed: true}));
    const pending = oneEvent(el, 'wiki-save');
    (el.shadowRoot!.querySelector('[data-cy="wiki.save"]') as HTMLButtonElement).click();
    const ev = (await pending) as CustomEvent<{
      id: string;
      title: string;
      body: string;
      spaceId?: string;
    }>;
    expect(ev.detail).to.deep.equal({
      id: 'eng-readme',
      title: 'Release notes',
      body: 'plain source',
      spaceId: 'eng',
    });
  });

  it('omits spaceId when the seed has none', async () => {
    const el = await fixture<ToborWikiEntryEditor>(
      html`<tobor-wiki-entry-editor></tobor-wiki-entry-editor>`,
    );
    el.entry = {id: 'x', title: 'T', body: 'B'};
    await el.updateComplete;
    const pending = oneEvent(el, 'wiki-save');
    (el.shadowRoot!.querySelector('[data-cy="wiki.save"]') as HTMLButtonElement).click();
    const ev = (await pending) as CustomEvent<{spaceId?: string}>;
    expect(ev.detail.spaceId).to.equal(undefined);
  });
});

describe('wikiPlainText', () => {
  it('keeps markup as characters', () => {
    expect(wikiPlainText('<b>x</b>')).to.equal('<b>x</b>');
    expect(wikiPlainText(null)).to.equal('');
  });
});
