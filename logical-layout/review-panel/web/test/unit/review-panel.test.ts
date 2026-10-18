import {expect, fixture, html, oneEvent} from '@open-wc/testing';
import '../../review-panel.js';
import type {
  Review,
  ReviewResolveDetail,
  ReviewSubmitDetail,
  ToborReviewPanel,
} from '../../review-panel.js';
import {normalizeReviews} from '../../review-panel.js';

const ROWS: Review[] = [
  {
    id: 'r1',
    author: 'Ada',
    body: 'Looks **good**',
    at: '2026-01-01T00:00:00Z',
    status: 'open',
  },
  {
    id: 'r2',
    author: 'Gus',
    body: 'Ship it',
    at: '2026-01-02T12:30:00Z',
    status: 'resolved',
  },
];

function cy(el: ToborReviewPanel, name: string): HTMLElement | null {
  return el.shadowRoot!.querySelector(`[data-cy="${name}"]`);
}

function items(el: ToborReviewPanel): NodeListOf<HTMLElement> {
  return el.shadowRoot!.querySelectorAll('[data-cy="review.item"]');
}

describe('tobor-review-panel', () => {
  it('renders the list in shadow DOM with review.panel / review.item', async () => {
    const el = await fixture<ToborReviewPanel>(
      html`<tobor-review-panel artifact-id="artifact-1"></tobor-review-panel>`,
    );
    el.reviews = ROWS;
    await el.updateComplete;

    expect(el.shadowRoot).to.exist;
    expect(cy(el, 'review.panel')).to.exist;
    expect(items(el)).to.have.lengthOf(2);
    expect(el.shadowRoot!.textContent).to.include('Ada');
    expect(el.shadowRoot!.textContent).to.include('Looks **good**');
    expect(el.shadowRoot!.textContent).to.include('2026-01-01 00:00 UTC');
    expect(el.getAttribute('artifact-id')).to.equal('artifact-1');
  });

  it('shows composer by default and hides it when show-composer="false"', async () => {
    const on = await fixture<ToborReviewPanel>(html`<tobor-review-panel></tobor-review-panel>`);
    expect(on.showComposer).to.equal(true);
    expect(cy(on, 'review.composer')).to.exist;
    expect(cy(on, 'review.submit')).to.exist;

    const off = await fixture<ToborReviewPanel>(
      html`<tobor-review-panel show-composer="false"></tobor-review-panel>`,
    );
    expect(off.showComposer).to.equal(false);
    expect(cy(off, 'review.composer')).to.equal(null);
    expect(cy(off, 'review.submit')).to.equal(null);
  });

  it('submit emits review-submit {artifactId, body} and does not append locally', async () => {
    const el = await fixture<ToborReviewPanel>(
      html`<tobor-review-panel artifact-id="artifact-1"></tobor-review-panel>`,
    );
    el.reviews = ROWS;
    await el.updateComplete;

    const composer = cy(el, 'review.composer') as HTMLTextAreaElement;
    const submit = cy(el, 'review.submit') as HTMLButtonElement;
    composer.value = '  please fix the caption  ';
    composer.dispatchEvent(new Event('input', {bubbles: true, composed: true}));
    const pending = oneEvent(el, 'review-submit');
    submit.click();
    const event = (await pending) as CustomEvent<ReviewSubmitDetail>;

    expect(event.bubbles).to.equal(true);
    expect(event.composed).to.equal(true);
    expect(event.detail).to.deep.equal({artifactId: 'artifact-1', body: 'please fix the caption'});
    expect(el.reviews).to.have.lengthOf(2);
    expect(items(el)).to.have.lengthOf(2);
  });

  it('does not emit review-submit for blank composer input', async () => {
    const el = await fixture<ToborReviewPanel>(html`<tobor-review-panel></tobor-review-panel>`);
    let fired = false;
    el.addEventListener('review-submit', () => {
      fired = true;
    });
    (cy(el, 'review.submit') as HTMLButtonElement).click();
    await el.updateComplete;
    expect(fired).to.equal(false);
  });

  it('resolve on an open row emits review-resolve {id} and leaves reviews unchanged', async () => {
    const el = await fixture<ToborReviewPanel>(html`<tobor-review-panel></tobor-review-panel>`);
    el.reviews = ROWS;
    await el.updateComplete;

    const open = el.shadowRoot!.querySelector('[data-id="r1"]') as HTMLElement;
    const resolved = el.shadowRoot!.querySelector('[data-id="r2"]') as HTMLElement;
    expect(open.querySelector('[part="resolve"]')).to.exist;
    expect(resolved.querySelector('[part="resolve"]')).to.equal(null);

    const pending = oneEvent(el, 'review-resolve');
    (open.querySelector('[part="resolve"]') as HTMLButtonElement).click();
    const event = (await pending) as CustomEvent<ReviewResolveDetail>;

    expect(event.detail).to.deep.equal({id: 'r1'});
    expect(el.reviews[0]?.status).to.equal('open');
  });

  it('empty list shows empty copy and still offers the composer', async () => {
    const el = await fixture<ToborReviewPanel>(html`<tobor-review-panel></tobor-review-panel>`);
    await el.updateComplete;
    expect(el.shadowRoot!.textContent).to.include('No reviews yet');
    expect(items(el)).to.have.lengthOf(0);
    expect(cy(el, 'review.composer')).to.exist;
  });

  it('renders the empty state when a host assigns reviews = undefined', async () => {
    const el = await fixture<ToborReviewPanel>(
      html`<tobor-review-panel artifact-id="artifact-1"></tobor-review-panel>`,
    );
    // Hosts (e.g. configurator applyAttributes) may clobber the class default.
    (el as unknown as {reviews: unknown}).reviews = undefined;
    await el.updateComplete;
    expect(el.shadowRoot!.textContent).to.include('No reviews yet');
    expect(items(el)).to.have.lengthOf(0);
    expect(cy(el, 'review.composer')).to.exist;
  });

  it('normalizeReviews drops non-array input and non-object rows', async () => {
    expect(normalizeReviews(undefined)).to.deep.equal([]);
    expect(normalizeReviews(null)).to.deep.equal([]);
    expect(normalizeReviews('nope')).to.deep.equal([]);
    expect(normalizeReviews([ROWS[0], null, 'junk', ROWS[1]])).to.deep.equal(ROWS);
  });
});
