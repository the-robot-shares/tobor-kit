/**
 * `<noizu-footer-brand>` — one-line "made by" attribution for site footers.
 *
 * Renders `A <a>The Robot Lives</a> Joint` with the brand name in a display
 * face. Presentational only: no events, no slots, no backend. Host-only
 * island (registry: noizu-footer-brand).
 *
 * Layering rule (docs/THEMING.md): presets only set the private scheme /
 * palette aliases; the consumed aliases consult the public
 * `--noizu-footer-brand-*` vars FIRST, so an explicit host override always
 * beats a preset. The public vars themselves are never declared here —
 * declaring them would break ancestor-level theming.
 */

import { LitElement, css, html, nothing, type TemplateResult } from "lit";
import {property} from "lit/decorators.js";
import { ifDefined } from "lit/directives/if-defined.js";

import { toborKitTokens } from "../mode-toggle/theme.js";
import {defineElement} from '../../define.js';

@defineElement("noizu-footer-brand")
export class NoizuFooterBrand extends LitElement {
  static override styles = [
    toborKitTokens,
    css`
      :host {
        display: block;
        text-align: center;

        /* Theme (scheme) layer — the kit palette is dark by default. */
        --_scheme-fg: var(--tobor-kit-fg, #e8e9f0);
        --_scheme-muted: var(--tobor-kit-muted, #9aa0b4);
        --_scheme-brand: var(--tobor-kit-accent, #6ee7c7);

        /* Palette layer. default: muted body, accent brand. */
        --_palette-fg: var(--_scheme-muted);
        --_palette-brand: var(--_scheme-brand);
        --_palette-underline: transparent;

        /* Consumed aliases — public var consulted first (host overrides win
           over every preset); presets fill the fallback. */
        --_fg: var(--noizu-footer-brand-fg, var(--_palette-fg));
        --_brand: var(--noizu-footer-brand-brand-color, var(--_palette-brand));
        --_muted: var(--_scheme-muted);
        --_font: var(--noizu-footer-brand-font, var(--tobor-kit-font));
        --_brand-font: var(--noizu-footer-brand-brand-font, "Space Grotesk", var(--tobor-kit-font));
        --_size: var(--noizu-footer-brand-size, 0.875rem);
        --_letter-spacing: var(--noizu-footer-brand-letter-spacing, normal);
      }

      /* theme="light" preset — --noizu-footer-brand-* overrides still win
         because the consumed aliases re-consult the public var. */
      :host([theme="light"]) {
        --_scheme-fg: #14161f;
        --_scheme-muted: #5a5f73;
        --_scheme-brand: #0e7a5f;
      }

      /* theme="auto" — dark defaults above; light inside a light preference. */
      @media (prefers-color-scheme: light) {
        :host([theme="auto"]) {
          --_scheme-fg: #14161f;
          --_scheme-muted: #5a5f73;
          --_scheme-brand: #0e7a5f;
        }
      }

      /* Palette presets — token values only, no runtime logic. */
      :host([palette="mono"]) {
        --_palette-fg: var(--_scheme-fg);
        --_palette-brand: var(--_scheme-fg);
      }

      :host([palette="accent"]) {
        --_palette-fg: var(--_scheme-fg);
        --_palette-brand: var(--_scheme-brand);
        --_palette-underline: var(--_scheme-brand);
      }

      :host([align="start"]) {
        text-align: start;
      }

      :host([align="end"]) {
        text-align: end;
      }

      .root {
        margin: 0;
        padding: var(--noizu-footer-brand-padding, 0);
        font-family: var(--_font);
        font-size: var(--_size);
        letter-spacing: var(--_letter-spacing);
        color: var(--_fg);
      }

      .link {
        color: var(--_brand);
        font-family: var(--_brand-font);
        font-weight: 600;
        text-decoration: none;
        text-decoration-color: var(--_palette-underline);
        text-underline-offset: 3px;
      }

      /* accent palette: underline in the brand accent on hover/focus. */
      :host([palette="accent"]) .link:hover,
      :host([palette="accent"]) .link:focus-visible {
        text-decoration: underline;
      }

      .link:focus-visible {
        outline: 2px solid var(--_accent);
        outline-offset: 2px;
      }

      /* Motion only when the visitor welcomes it. */
      @media (prefers-reduced-motion: no-preference) {
        .link {
          transition: text-decoration-color var(--_duration, 320ms) ease;
        }
      }
    `,
  ];

  /** Link target URL for the brand name. */
  @property({ type: String, reflect: true })
  href = "https://derobot.is";

  /** Anchor target; the attribute is omitted when empty. `_blank` renders `rel="noopener noreferrer"`. */
  @property({ type: String, reflect: true })
  target = "";

  /** Brand name rendered inside the link. */
  @property({ type: String, reflect: true })
  brand = "The Robot Lives";

  /** Leading text; empty string suppresses the piece and its spacing. */
  // `override` — shadows the DOM's (unused) Element.prefix namespace accessor.
  @property({ type: String, reflect: true })
  override prefix = "A";

  /** Trailing text; empty string suppresses the piece and its spacing. */
  @property({ type: String, reflect: true })
  suffix = "Joint";

  /** Color scheme preset: `dark` (kit default) | `light` | `auto`. */
  @property({ type: String, reflect: true })
  theme = "dark";

  /** Palette preset: `default` | `mono` | `accent` — token values only. */
  @property({ type: String, reflect: true })
  palette = "default";

  /** Inline alignment of the line: `start` | `center` | `end`. */
  @property({ type: String, reflect: true })
  align = "center";

  override render(): TemplateResult {
    return html`
      <p part="root" data-cy="footer-brand-root" class="root">
        ${this.prefix ? html`${this.prefix} ` : nothing}<a
          part="link brand"
          data-cy="footer-brand-link"
          class="link"
          href=${this.href}
          target=${ifDefined(this.target || undefined)}
          rel=${ifDefined(this.target === "_blank" ? "noopener noreferrer" : undefined)}
          >${this.brand}</a
        >${this.suffix ? html` ${this.suffix}` : nothing}
      </p>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "noizu-footer-brand": NoizuFooterBrand;
  }
}
