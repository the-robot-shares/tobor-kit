/**
 * Shared theming surface.
 *
 * Every element is styled exclusively through these custom properties, so a
 * host restyles the whole kit without piercing Shadow DOM. The guide
 * projection's free-form `ui.theme` map is applied by turning each key into
 * `--tobor-kit-<key>` on the panel host.
 */

import { css } from "lit";

export const toborKitTokens = css`
  :host {
    --tobor-kit-font: var(--tobor-kit-font-family, system-ui, -apple-system, "Segoe UI", sans-serif);
    --_bg: var(--tobor-kit-bg, #12131a);
    --_surface: var(--tobor-kit-surface, #1b1d27);
    --_fg: var(--tobor-kit-fg, #e8e9f0);
    --_muted: var(--tobor-kit-muted, #9aa0b4);
    --_accent: var(--tobor-kit-accent, #6ee7c7);
    --_accent-fg: var(--tobor-kit-accent-fg, #08130f);
    --_border: var(--tobor-kit-border, #2c2f3d);
    --_danger: var(--tobor-kit-danger, #ff6b6b);
    --_warn: var(--tobor-kit-warn, #f5c451);
    --_radius: var(--tobor-kit-radius, 12px);
    --_gap: var(--tobor-kit-gap, 12px);
    --_shadow: var(--tobor-kit-shadow, 0 12px 32px rgb(0 0 0 / 35%));
    --_duration: var(--tobor-kit-duration, 320ms);
    color: var(--_fg);
    font-family: var(--tobor-kit-font);
    box-sizing: border-box;
  }

  *,
  *::before,
  *::after {
    box-sizing: inherit;
  }
`;

/** Buttons/inputs shared by several elements. */
export const toborKitControls = css`
  button {
    font: inherit;
    color: inherit;
    background: transparent;
    border: 1px solid var(--_border);
    border-radius: calc(var(--_radius) / 2);
    padding: 6px 10px;
    cursor: pointer;
  }

  button:hover:not(:disabled) {
    border-color: var(--_accent);
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  button[aria-pressed="true"],
  button[aria-checked="true"] {
    background: var(--_accent);
    color: var(--_accent-fg);
    border-color: var(--_accent);
  }

  :focus-visible {
    outline: 2px solid var(--_accent);
    outline-offset: 2px;
  }

  .muted {
    color: var(--_muted);
  }

  .notice {
    border: 1px solid var(--_warn);
    border-radius: calc(var(--_radius) / 2);
    padding: 8px 10px;
    font-size: 0.85em;
  }

  .notice--error {
    border-color: var(--_danger);
    color: var(--_danger);
  }
`;

/** Apply the projection's `ui.theme` map to a host element. */
export function applyThemeVars(host: HTMLElement, theme: Record<string, string> | undefined): void {
  if (!theme) return;
  for (const [key, value] of Object.entries(theme)) {
    const name = key.startsWith("--") ? key : `--tobor-kit-${key.replace(/_/g, "-")}`;
    host.style.setProperty(name, value);
  }
}
