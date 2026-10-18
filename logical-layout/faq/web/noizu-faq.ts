import {LitElement, html, css} from 'lit';
import {property} from 'lit/decorators.js';
import {defineElement} from '../../define.js';

export interface FaqToggleDetail {
  open: boolean;
  index: number;
}

/** Light DOM FAQ list. Host slots native `<details>`/`<summary>`. */
@defineElement('noizu-faq')
export class NoizuFaq extends LitElement {
  static override styles = css`
    :host {
      display: block;
    }
  `;

  @property()
  mode: 'many' | 'one' = 'many';

  private observer?: MutationObserver;

  protected override createRenderRoot() {
    return this;
  }

  override connectedCallback() {
    super.connectedCallback();
    this.addEventListener('toggle', this.onToggle, true);
    this.addEventListener('click', this.onClick, true);
    this.observer ??= new MutationObserver(this.onSlotChange);
    this.observer.observe(this, {childList: true});
  }

  override disconnectedCallback() {
    this.removeEventListener('toggle', this.onToggle, true);
    this.removeEventListener('click', this.onClick, true);
    this.observer?.disconnect();
    super.disconnectedCallback();
  }

  override render() {
    return html`
      <div class="hui" data-cy="faq.list">
        <slot @slotchange=${this.onSlotChange}></slot>
      </div>
    `;
  }

  protected override firstUpdated() {
    this.onSlotChange();
  }

  private list() {
    return this.querySelector(':scope > [data-cy="faq.list"]');
  }

  private readonly onSlotChange = () => {
    this.adoptDetails();
    this.decorate();
  };

  private adoptDetails() {
    const list = this.list();
    if (!list) return;
    for (const node of [...this.childNodes]) {
      if (node === list) continue;
      if (node.nodeType === Node.COMMENT_NODE) continue;
      list.appendChild(node);
    }
  }

  private items(): HTMLDetailsElement[] {
    const list = this.list();
    const slot = list?.querySelector(':scope > slot');
    if (slot instanceof HTMLSlotElement) {
      const assigned = slot
        .assignedElements({flatten: true})
        .filter((el): el is HTMLDetailsElement => el instanceof HTMLDetailsElement);
      if (assigned.length) return assigned;
    }
    const found: HTMLDetailsElement[] = [];
    const consider = (root: ParentNode | null | undefined) => {
      if (!root) return;
      for (const child of root.children) {
        if (child instanceof HTMLDetailsElement && !found.includes(child)) {
          found.push(child);
        }
      }
    };
    consider(this);
    consider(list);
    consider(slot);
    return found;
  }

  private decorate() {
    for (const details of this.items()) {
      details.classList.add('hui', 'disclosure', 'disclosure-panel');
      details.setAttribute('data-cy', 'faq.item');
      const summary = details.querySelector(':scope > summary');
      if (!summary) continue;
      summary.classList.add('hui', 'disclosure-button');
      summary.setAttribute('data-cy', 'faq.trigger');
    }
  }

  private detailsFromEvent(event: Event): HTMLDetailsElement | null {
    const target = event.target;
    if (target instanceof HTMLDetailsElement) return target;
    if (!(target instanceof Element)) return null;
    const details = target.closest('details');
    return details instanceof HTMLDetailsElement ? details : null;
  }

  private readonly onToggle = (event: Event) => {
    const details = event.target;
    if (!(details instanceof HTMLDetailsElement)) return;
    const items = this.items();
    const index = items.indexOf(details);
    if (index < 0) return;

    if (this.mode === 'one' && details.open) {
      for (const other of items) {
        if (other !== details && other.open) other.open = false;
      }
    }

    this.dispatchEvent(
      new CustomEvent<FaqToggleDetail>('faq-toggle', {
        bubbles: true,
        composed: true,
        detail: {open: details.open, index},
      }),
    );
  };

  private readonly onClick = (event: Event) => {
    if (this.mode !== 'one') return;
    const details = this.detailsFromEvent(event);
    if (!details) return;
    const items = this.items();
    if (!items.includes(details)) return;
    if (details.open) return;
    for (const other of items) {
      if (other !== details && other.open) other.open = false;
    }
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'noizu-faq': NoizuFaq;
  }
  interface HTMLElementEventMap {
    'faq-toggle': CustomEvent<FaqToggleDetail>;
  }
}
