import {elementUpdated, expect, fixture, html, oneEvent} from '@open-wc/testing';
import {ToborArtifactView} from '../../tobor-artifact-view.js';
import {ToborArtifactEditor} from '../../tobor-artifact-editor.js';
import type {Artifact, ArtifactSaveDetail, ReviewStartDetail} from '../../types.js';

const SAMPLE: Artifact = {
  id: 'demo',
  title: 'Release notes',
  version: 1,
  body: 'Ship the island.',
  mime: 'text/plain',
};

function viewRoot(el: ToborArtifactView): ShadowRoot {
  return el.shadowRoot!;
}

function editorRoot(el: ToborArtifactEditor): ShadowRoot {
  return el.shadowRoot!;
}

describe('tobor-artifact-view', () => {
  it('renders title, version, mime, and body as text in pre', async () => {
    const el = await fixture<ToborArtifactView>(html`<tobor-artifact-view></tobor-artifact-view>`);
    el.artifact = SAMPLE;
    await el.updateComplete;

    const root = viewRoot(el);
    expect(root.querySelector('[data-cy="artifact.view"]')).to.exist;
    expect(root.querySelector('[part="title"]')?.textContent).to.equal('Release notes');
    expect(root.querySelector('[part="version"]')?.textContent).to.equal('v1');
    expect(root.querySelector('[part="mime"]')?.textContent).to.equal('text/plain');
    const pre = root.querySelector('pre[part="body"]');
    expect(pre).to.exist;
    expect(pre?.textContent).to.equal('Ship the island.');
    expect(pre?.querySelector('*')).to.equal(null);
  });

  it('does not interpret HTML in body (no unsafeHTML)', async () => {
    const el = await fixture<ToborArtifactView>(html`<tobor-artifact-view></tobor-artifact-view>`);
    el.artifact = {
      ...SAMPLE,
      body: '<img src="x" onerror="window.__artifactXss=1"><script>window.__artifactXss=1</script>',
    };
    await el.updateComplete;

    const pre = viewRoot(el).querySelector('pre')!;
    expect(pre.querySelector('img')).to.equal(null);
    expect(pre.querySelector('script')).to.equal(null);
    expect(pre.textContent).to.include('<img');
    expect(pre.textContent).to.include('<script>');
    expect((window as unknown as {__artifactXss?: number}).__artifactXss).to.equal(undefined);
  });

  it('re-renders body when version changes', async () => {
    const el = await fixture<ToborArtifactView>(html`<tobor-artifact-view></tobor-artifact-view>`);
    el.artifact = SAMPLE;
    await el.updateComplete;
    expect(viewRoot(el).querySelector('pre')?.textContent).to.equal('Ship the island.');

    el.artifact = {...SAMPLE, version: 2, body: 'Second cut.'};
    await el.updateComplete;
    expect(viewRoot(el).querySelector('[part="version"]')?.textContent).to.equal('v2');
    expect(viewRoot(el).querySelector('pre')?.textContent).to.equal('Second cut.');
  });

  it('emits review-start with artifactId and version', async () => {
    const el = await fixture<ToborArtifactView>(html`<tobor-artifact-view></tobor-artifact-view>`);
    el.artifact = SAMPLE;
    await el.updateComplete;

    const pending = oneEvent(el, 'review-start');
    viewRoot(el).querySelector<HTMLButtonElement>('[data-cy="artifact.review"]')!.click();
    const event = (await pending) as CustomEvent<ReviewStartDetail>;
    expect(event.detail).to.deep.equal({artifactId: 'demo', version: 1});
    expect(event.bubbles).to.equal(true);
    expect(event.composed).to.equal(true);
  });

  it('shows empty copy when artifact is missing', async () => {
    const el = await fixture<ToborArtifactView>(html`<tobor-artifact-view></tobor-artifact-view>`);
    await el.updateComplete;
    expect(viewRoot(el).textContent).to.include('No artifact.');
    expect(viewRoot(el).querySelector('[data-cy="artifact.review"]')).to.equal(null);
  });
});

describe('tobor-artifact-editor', () => {
  it('seeds title and body from artifact', async () => {
    const el = await fixture<ToborArtifactEditor>(
      html`<tobor-artifact-editor></tobor-artifact-editor>`,
    );
    el.artifact = SAMPLE;
    await el.updateComplete;

    const root = editorRoot(el);
    expect(root.querySelector('[data-cy="artifact.editor"]')).to.exist;
    expect(root.querySelector<HTMLInputElement>('input[name="title"]')?.value).to.equal(
      'Release notes',
    );
    expect(root.querySelector<HTMLTextAreaElement>('textarea[name="body"]')?.value).to.equal(
      'Ship the island.',
    );
  });

  it('emits artifact-save with drafts; does not persist', async () => {
    const origFetch = window.fetch;
    let fetched = false;
    window.fetch = (async () => {
      fetched = true;
      return new Response('{}');
    }) as typeof fetch;

    const el = await fixture<ToborArtifactEditor>(
      html`<tobor-artifact-editor></tobor-artifact-editor>`,
    );
    el.artifact = SAMPLE;
    await el.updateComplete;

    const title = editorRoot(el).querySelector<HTMLInputElement>('input[name="title"]')!;
    const body = editorRoot(el).querySelector<HTMLTextAreaElement>('textarea[name="body"]')!;
    title.value = 'Edited title';
    title.dispatchEvent(new Event('input'));
    body.value = 'Edited body';
    body.dispatchEvent(new Event('input'));
    await elementUpdated(el);

    const pending = oneEvent(el, 'artifact-save');
    editorRoot(el).querySelector<HTMLButtonElement>('[data-cy="artifact.save"]')!.click();
    const event = (await pending) as CustomEvent<ArtifactSaveDetail>;
    expect(event.detail).to.deep.equal({
      id: 'demo',
      title: 'Edited title',
      body: 'Edited body',
      version: 1,
    });
    expect(event.bubbles).to.equal(true);
    expect(event.composed).to.equal(true);
    expect(fetched).to.equal(false);

    window.fetch = origFetch;
  });

  it('omits version when the seed has none', async () => {
    const el = await fixture<ToborArtifactEditor>(
      html`<tobor-artifact-editor></tobor-artifact-editor>`,
    );
    el.artifact = {id: 'new', title: '', body: ''} as Artifact;
    await el.updateComplete;
    const pending = oneEvent(el, 'artifact-save');
    editorRoot(el).querySelector<HTMLButtonElement>('[data-cy="artifact.save"]')!.click();
    const event = (await pending) as CustomEvent<ArtifactSaveDetail>;
    expect(event.detail.id).to.equal('new');
    expect(event.detail).to.not.have.property('version');
  });
});
