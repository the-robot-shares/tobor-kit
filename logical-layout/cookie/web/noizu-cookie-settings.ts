import {LitElement, html, css} from 'lit';
import {defineElement} from '../../define.js';


/** Light DOM. Registry: noizu-cookie-settings. */
@defineElement('noizu-cookie-settings')
export class NoizuCookieSettings extends LitElement {
  static override styles = css`
    :host {
      display: inline-block;
    }
  `;

  protected override createRenderRoot() {
    return this;
  }

  private readonly onClick = () => {
    this.dispatchEvent(
      new CustomEvent('cookie-settings-open', {bubbles: true, composed: true}),
    );
  };

  override render() {
    return html`
      <button
        type="button"
        class="btn btn-outline btn-sm"
        data-cy="cookie.settings"
        @click=${this.onClick}
      >
        <slot>Cookie Settings</slot>
      </button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'noizu-cookie-settings': NoizuCookieSettings;
  }
}
