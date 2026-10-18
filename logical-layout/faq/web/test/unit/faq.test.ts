import {expect, fixture, html, oneEvent} from '@open-wc/testing';
import '../../noizu-faq.js';

describe('noizu-faq', () => {
  it('stamps data-cy on list, items, and triggers', async () => {
    const el = await fixture<HTMLElement>(html`
      <noizu-faq>
        <details>
          <summary>Q1</summary>
          <p>A1</p>
        </details>
        <details>
          <summary>Q2</summary>
          <p>A2</p>
        </details>
        <details>
          <summary>Q3</summary>
          <p>A3</p>
        </details>
      </noizu-faq>
    `);
    expect(el.querySelector('[data-cy="faq.list"]')).to.exist;
    expect(el.querySelectorAll('[data-cy="faq.item"]').length).to.equal(3);
    expect(el.querySelectorAll('[data-cy="faq.trigger"]').length).to.equal(3);
  });

  it('mode=one closes other details when one opens', async () => {
    const el = await fixture<HTMLElement>(html`
      <noizu-faq mode="one">
        <details>
          <summary>Q1</summary>
          <p>A1</p>
        </details>
        <details>
          <summary>Q2</summary>
          <p>A2</p>
        </details>
        <details>
          <summary>Q3</summary>
          <p>A3</p>
        </details>
      </noizu-faq>
    `);
    const items = el.querySelectorAll('details');
    expect(items.length).to.equal(3);
    items[0]!.querySelector('summary')!.click();
    items[1]!.querySelector('summary')!.click();
    expect(items[0]!.open).to.equal(false);
    expect(items[1]!.open).to.equal(true);
    expect(items[2]!.open).to.equal(false);
  });

  it('fires faq-toggle with open and index', async () => {
    const el = await fixture<HTMLElement>(html`
      <noizu-faq>
        <details>
          <summary>Q1</summary>
          <p>A1</p>
        </details>
        <details>
          <summary>Q2</summary>
          <p>A2</p>
        </details>
        <details>
          <summary>Q3</summary>
          <p>A3</p>
        </details>
      </noizu-faq>
    `);
    const items = el.querySelectorAll('details');
    const fired = oneEvent(el, 'faq-toggle');
    items[2]!.open = true;
    const event = await fired;
    expect(event.detail.open).to.equal(true);
    expect(event.detail.index).to.equal(2);
  });
});
