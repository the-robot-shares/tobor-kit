import {expect, fixture, html, oneEvent} from '@open-wc/testing';
import '../../asset-editor.js';
import '../../asset-view.js';
import {mimeKind} from '../../asset.js';
import type {Asset, AssetOpenDetail, AssetSaveDetail} from '../../asset.js';
import type {ToborAssetEditor} from '../../asset-editor.js';
import type {ToborAssetView} from '../../asset-view.js';

function cy(el: LitHost, name: string): HTMLElement | null {
  return el.shadowRoot!.querySelector(`[data-cy="${name}"]`);
}

type LitHost = HTMLElement & {shadowRoot: ShadowRoot | null};

const TEXT: Asset = {
  id: 'note-1',
  name: 'readme.txt',
  mime: 'text/plain',
  body: 'Hello from the host.',
};

const IMAGE: Asset = {
  id: 'img-1',
  name: 'hero.png',
  mime: 'image/png',
  src: 'data:image/png;base64,aaaa',
};

describe('mimeKind', () => {
  it('strips parameters', () => {
    expect(mimeKind('text/plain; charset=utf-8')).to.equal('text');
    expect(mimeKind('image/png')).to.equal('image');
    expect(mimeKind('application/zip')).to.equal('other');
  });
});

describe('tobor-asset-view', () => {
  it('empty state has asset.view and no preview', async () => {
    const el = await fixture<ToborAssetView>(html`<tobor-asset-view></tobor-asset-view>`);
    expect(cy(el, 'asset.view')).to.exist;
    expect(cy(el, 'asset.preview')).to.equal(null);
    expect(el.shadowRoot!.textContent).to.include('No asset');
  });

  it('image mime renders img', async () => {
    const el = await fixture<ToborAssetView>(html`<tobor-asset-view></tobor-asset-view>`);
    el.asset = IMAGE;
    await el.updateComplete;

    const preview = cy(el, 'asset.preview') as HTMLImageElement | null;
    expect(preview).to.exist;
    expect(preview!.tagName).to.equal('IMG');
    expect(preview!.getAttribute('src')).to.equal(IMAGE.src);
    expect(preview!.getAttribute('alt')).to.equal(IMAGE.name);
    expect(preview!.getAttribute('data-kind')).to.equal('image');
  });

  it('text mime renders escaped body in pre (never HTML)', async () => {
    const el = await fixture<ToborAssetView>(html`<tobor-asset-view></tobor-asset-view>`);
    el.asset = {
      id: 'html-1',
      name: 'note.html',
      mime: 'text/html',
      body: '<script>window.__xss=1</script><img src=x>',
    };
    await el.updateComplete;

    const preview = cy(el, 'asset.preview')!;
    expect(preview.tagName).to.equal('PRE');
    expect(preview.getAttribute('data-kind')).to.equal('text');
    expect(preview.querySelector('script')).to.equal(null);
    expect(preview.querySelector('img')).to.equal(null);
    expect(preview.textContent).to.include('<script>window.__xss=1</script>');
    expect(preview.innerHTML).to.include('&lt;script&gt;');
    expect((window as unknown as {__xss?: number}).__xss).to.equal(undefined);
  });

  it('other mime with src renders download fallback', async () => {
    const el = await fixture<ToborAssetView>(html`<tobor-asset-view></tobor-asset-view>`);
    el.asset = {id: 'bin-1', name: 'bundle.zip', mime: 'application/zip', src: '/files/bundle.zip'};
    await el.updateComplete;

    const preview = cy(el, 'asset.preview')!;
    expect(preview.getAttribute('data-kind')).to.equal('other');
    const link = el.shadowRoot!.querySelector<HTMLAnchorElement>('a[part="download"]');
    expect(link).to.exist;
    expect(link!.getAttribute('href')).to.equal('/files/bundle.zip');
    expect(link!.getAttribute('download')).to.equal('bundle.zip');
  });

  it('other mime without src shows name', async () => {
    const el = await fixture<ToborAssetView>(html`<tobor-asset-view></tobor-asset-view>`);
    el.asset = {id: 'bin-2', name: 'blob.bin', mime: 'application/octet-stream'};
    await el.updateComplete;

    expect(cy(el, 'asset.preview')?.textContent?.trim()).to.equal('blob.bin');
    expect(el.shadowRoot!.querySelector('a')).to.equal(null);
  });

  it('click preview emits asset-open {id}', async () => {
    const el = await fixture<ToborAssetView>(html`<tobor-asset-view></tobor-asset-view>`);
    el.asset = TEXT;
    await el.updateComplete;

    const pending = oneEvent(el, 'asset-open');
    cy(el, 'asset.preview')!.click();
    const event = (await pending) as CustomEvent<AssetOpenDetail>;

    expect(event.bubbles).to.equal(true);
    expect(event.composed).to.equal(true);
    expect(event.detail).to.deep.equal({id: 'note-1'});
  });

  it('rejects javascript: src', async () => {
    const el = await fixture<ToborAssetView>(html`<tobor-asset-view></tobor-asset-view>`);
    el.asset = {id: 'img-2', name: 'x', mime: 'image/png', src: 'javascript:alert(1)'};
    await el.updateComplete;

    expect(el.shadowRoot!.querySelector('img')).to.equal(null);
    expect(cy(el, 'asset.preview')?.textContent?.trim()).to.equal('x');
  });
});

describe('tobor-asset-editor', () => {
  it('has editor and save hooks', async () => {
    const el = await fixture<ToborAssetEditor>(html`<tobor-asset-editor></tobor-asset-editor>`);
    expect(cy(el, 'asset.editor')).to.exist;
    expect(cy(el, 'asset.save')).to.exist;
    expect((cy(el, 'asset.save') as HTMLButtonElement).disabled).to.equal(true);
  });

  it('textarea only for text mime', async () => {
    const el = await fixture<ToborAssetEditor>(html`<tobor-asset-editor></tobor-asset-editor>`);
    el.asset = TEXT;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('textarea[name="body"]')).to.exist;
    expect(el.shadowRoot!.querySelector<HTMLInputElement>('input[name="name"]')!.value).to.equal(
      'readme.txt',
    );

    el.asset = IMAGE;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('textarea[name="body"]')).to.equal(null);
  });

  it('save text emits asset-save {id, name, body}', async () => {
    const el = await fixture<ToborAssetEditor>(html`<tobor-asset-editor></tobor-asset-editor>`);
    el.asset = TEXT;
    await el.updateComplete;

    const name = el.shadowRoot!.querySelector<HTMLInputElement>('input[name="name"]')!;
    name.value = 'renamed.txt';
    name.dispatchEvent(new Event('input'));
    const body = el.shadowRoot!.querySelector<HTMLTextAreaElement>('textarea[name="body"]')!;
    body.value = 'edited';
    body.dispatchEvent(new Event('input'));

    const pending = oneEvent(el, 'asset-save');
    cy(el, 'asset.save')!.click();
    const event = (await pending) as CustomEvent<AssetSaveDetail>;

    expect(event.bubbles).to.equal(true);
    expect(event.composed).to.equal(true);
    expect(event.detail).to.deep.equal({id: 'note-1', name: 'renamed.txt', body: 'edited'});
    expect(el.asset?.name).to.equal('readme.txt');
  });

  it('save image omits body', async () => {
    const el = await fixture<ToborAssetEditor>(html`<tobor-asset-editor></tobor-asset-editor>`);
    el.asset = IMAGE;
    await el.updateComplete;

    const pending = oneEvent(el, 'asset-save');
    cy(el, 'asset.save')!.click();
    const event = (await pending) as CustomEvent<AssetSaveDetail>;

    expect(event.detail).to.deep.equal({id: 'img-1', name: 'hero.png'});
    expect('body' in event.detail).to.equal(false);
  });
});
