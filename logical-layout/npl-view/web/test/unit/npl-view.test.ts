import {expect, fixture, html, oneEvent} from '@open-wc/testing';
import {
  SAMPLE_SOURCE,
  isNplFoldStart,
  splitNplSections,
  tokenizeNpl,
} from '../../highlight.js';
import {ToborNplView, type NplCopyDetail} from '../../npl-view.js';

function root(el: ToborNplView): ShadowRoot {
  return el.shadowRoot!;
}

function cy(el: ToborNplView, name: string): HTMLElement | null {
  return root(el).querySelector(`[data-cy="${name}"]`);
}

describe('npl highlight helpers', () => {
  it('treats # and ⌜NPL lines as fold starts, not ⌜extend:NPL', () => {
    expect(isNplFoldStart('# Syntax')).to.equal(true);
    expect(isNplFoldStart('  ⌜NPL@1.0⌝')).to.equal(true);
    expect(isNplFoldStart('⌜extend:NPL@1.0⌝')).to.equal(false);
    expect(isNplFoldStart('Greet {user.name}')).to.equal(false);
  });

  it('splits foldable sections on # and ⌜NPL', () => {
    const sections = splitNplSections(SAMPLE_SOURCE);
    const headings = sections.map((section) => section.heading);
    expect(headings.some((h) => h?.includes('⌜NPL@1.0⌝'))).to.equal(true);
    expect(headings.some((h) => h?.includes('# Syntax'))).to.equal(true);
    expect(headings.some((h) => h?.includes('# Agent'))).to.equal(true);
  });

  it('tokenizes declarations, placeholders, infill, logic, attention', () => {
    const kinds = tokenizeNpl(SAMPLE_SOURCE).map((tok) => tok.kind);
    expect(kinds).to.include('declaration');
    expect(kinds).to.include('placeholder');
    expect(kinds).to.include('infill');
    expect(kinds).to.include('logic');
    expect(kinds).to.include('attention');
    const placeholder = tokenizeNpl(SAMPLE_SOURCE).find((tok) => tok.kind === 'placeholder');
    expect(placeholder?.text).to.equal('{user.name}');
  });

  it('tokenizes highlight ticks and npl tags as escaped class kinds', () => {
    const tokens = tokenizeNpl('See `term` in <npl-example>x</npl-example>');
    expect(tokens.map((tok) => tok.kind)).to.include('highlight');
    expect(tokens.map((tok) => tok.kind)).to.include('tag');
    expect(tokens.find((tok) => tok.kind === 'highlight')?.text).to.equal('`term`');
  });
});

describe('tobor-npl-view', () => {
  it('renders source as escaped spans in shadow DOM', async () => {
    const el = await fixture<ToborNplView>(html`<tobor-npl-view></tobor-npl-view>`);
    el.source = SAMPLE_SOURCE;
    await el.updateComplete;

    expect(el.shadowRoot).to.exist;
    expect(cy(el, 'npl.view')).to.exist;
    expect(cy(el, 'npl.copy')).to.exist;
    expect(root(el).querySelectorAll('[data-cy="npl.fold"]').length).to.be.at.least(2);
    expect(root(el).textContent).to.include('{user.name}');
    expect(root(el).querySelector('.npl-placeholder')?.textContent).to.equal('{user.name}');
    expect(root(el).querySelector('.npl-declaration')?.textContent).to.include('⌜NPL@1.0⌝');
  });

  it('does not interpret HTML in source (no unsafeHTML)', async () => {
    const el = await fixture<ToborNplView>(html`<tobor-npl-view></tobor-npl-view>`);
    el.source =
      '# XSS\n<img src="x" onerror="window.__nplXss=1"><script>window.__nplXss=1</script>';
    await el.updateComplete;

    const pane = root(el);
    expect(pane.querySelector('img')).to.equal(null);
    expect(pane.querySelector('script')).to.equal(null);
    expect(pane.textContent).to.include('<img');
    expect(pane.textContent).to.include('<script>');
    expect((window as unknown as {__nplXss?: number}).__nplXss).to.equal(undefined);
  });

  it('folds sections for # and ⌜NPL headings', async () => {
    const el = await fixture<ToborNplView>(html`<tobor-npl-view></tobor-npl-view>`);
    el.source = SAMPLE_SOURCE;
    await el.updateComplete;

    const folds = [...root(el).querySelectorAll<HTMLElement>('[data-cy="npl.fold"]')];
    expect(folds.some((node) => node.textContent?.includes('⌜NPL@1.0⌝'))).to.equal(true);
    expect(folds.some((node) => node.textContent?.includes('# Syntax'))).to.equal(true);
    const details = folds[0]!.closest('details');
    expect(details?.open).to.equal(true);
    folds[0]!.click();
    expect(details?.open).to.equal(false);
  });

  it('emits npl-copy {text} and writes clipboard when available', async () => {
    const written: string[] = [];
    const previous = navigator.clipboard;
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          written.push(text);
        },
      },
    });

    try {
      const el = await fixture<ToborNplView>(html`<tobor-npl-view></tobor-npl-view>`);
      el.source = SAMPLE_SOURCE;
      await el.updateComplete;

      const pending = oneEvent(el, 'npl-copy');
      cy(el, 'npl.copy')!.click();
      const event = (await pending) as CustomEvent<NplCopyDetail>;
      expect(event.detail).to.deep.equal({text: SAMPLE_SOURCE});
      expect(event.bubbles).to.equal(true);
      expect(event.composed).to.equal(true);
      expect(written).to.deep.equal([SAMPLE_SOURCE]);
    } finally {
      Object.defineProperty(navigator, 'clipboard', {configurable: true, value: previous});
    }
  });

  it('emits npl-copy when clipboard is missing', async () => {
    const previous = navigator.clipboard;
    Object.defineProperty(navigator, 'clipboard', {configurable: true, value: undefined});

    try {
      const el = await fixture<ToborNplView>(html`<tobor-npl-view></tobor-npl-view>`);
      el.source = '⌜NPL@1.0⌝';
      await el.updateComplete;

      const pending = oneEvent(el, 'npl-copy');
      cy(el, 'npl.copy')!.click();
      const event = (await pending) as CustomEvent<NplCopyDetail>;
      expect(event.detail).to.deep.equal({text: '⌜NPL@1.0⌝'});
    } finally {
      Object.defineProperty(navigator, 'clipboard', {configurable: true, value: previous});
    }
  });

  it('shows empty copy when source is missing', async () => {
    const el = await fixture<ToborNplView>(html`<tobor-npl-view></tobor-npl-view>`);
    await el.updateComplete;
    expect(root(el).textContent).to.include('No source.');
    expect(cy(el, 'npl.copy')).to.exist;
    expect((cy(el, 'npl.copy') as HTMLButtonElement).disabled).to.equal(true);
    expect(cy(el, 'npl.fold')).to.equal(null);
  });
});
