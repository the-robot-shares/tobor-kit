/**
 * `<tobor-robot-avatar>` — a state machine over the seven canonical guide
 * states, and nothing else. It never infers a state from voice activity or
 * network traffic; it renders exactly what it is told, which is what makes the
 * SSE `state` event the single source of truth.
 *
 * Renderers: `glyph` is implemented in full (inline SVG, zero dependencies)
 * and is the default. `sprite` and `lottie` share the same state interface but
 * need art that does not exist yet, so they fall back to the glyph and say so
 * via `data-renderer-fallback` rather than rendering an empty box.
 */

import { LitElement, css, html, nothing, svg, type PropertyValues, type TemplateResult } from "lit";
import type { AvatarGroup } from "../voice-agent/types.js";
import {property, state} from "lit/decorators.js";

import { toborKitTokens } from "../mode-toggle/theme.js";
import {
  GUIDE_STATES,
  isGuideState,
  type GuideState,
  type ReducedMotionPolicy,
  type RobotRenderer,
  type RobotStateAnimation,
} from "../../types.js";
import {defineElement} from '../../define.js';

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

@defineElement("tobor-robot-avatar")
export class ToborRobotAvatar extends LitElement {
  static override styles = [
    toborKitTokens,
    css`
      :host {
        display: inline-block;
        width: var(--tobor-kit-robot-size, 96px);
        height: var(--tobor-kit-robot-size, 96px);
        line-height: 0;
      }

      svg {
        width: 100%;
        height: 100%;
        overflow: visible;
      }

      .shell {
        fill: var(--tobor-kit-robot-shell, var(--_surface));
        stroke: var(--tobor-kit-robot-edge, var(--_border));
        stroke-width: 2;
      }

      .visor {
        fill: var(--tobor-kit-robot-visor, #0d0f16);
      }

      .lit {
        fill: var(--tobor-kit-robot-accent, var(--_accent));
      }

      .stroke-lit {
        stroke: var(--tobor-kit-robot-accent, var(--_accent));
        stroke-width: 4;
        stroke-linecap: round;
        fill: none;
      }

      :host([state="error"]) .lit,
      :host([state="error"]) .stroke-lit {
        fill: var(--_danger);
        stroke: var(--_danger);
      }

      :host([state="offline"]) {
        opacity: 0.45;
        filter: grayscale(1);
      }

      /* Animations only run when motion is resolved to "animated". */
      :host([data-motion="animated"]) .blink {
        animation: tk-blink calc(var(--_tk-speed, 1) * 5.2s) infinite;
        transform-origin: center;
      }

      :host([data-motion="animated"]) .pulse {
        animation: tk-pulse calc(var(--_tk-speed, 1) * 1.4s) ease-in-out infinite;
        transform-origin: center;
      }

      :host([data-motion="animated"]) .ring {
        animation: tk-ring calc(var(--_tk-speed, 1) * 1.8s) ease-out infinite;
        transform-origin: 50px 46px;
      }

      :host([data-motion="animated"]) .ring:nth-of-type(2) {
        animation-delay: calc(var(--_tk-speed, 1) * 0.6s);
      }

      :host([data-motion="animated"]) .think-dot {
        animation: tk-think calc(var(--_tk-speed, 1) * 1.2s) ease-in-out infinite;
      }

      :host([data-motion="animated"]) .think-dot:nth-of-type(2) {
        animation-delay: calc(var(--_tk-speed, 1) * 0.15s);
      }

      :host([data-motion="animated"]) .think-dot:nth-of-type(3) {
        animation-delay: calc(var(--_tk-speed, 1) * 0.3s);
      }

      :host([data-motion="animated"]) .bar {
        animation: tk-bar calc(var(--_tk-speed, 1) * 0.7s) ease-in-out infinite;
        transform-origin: 50px 63px;
      }

      :host([data-motion="animated"]) .bar:nth-of-type(2) {
        animation-delay: calc(var(--_tk-speed, 1) * 0.12s);
      }

      :host([data-motion="animated"]) .bar:nth-of-type(3) {
        animation-delay: calc(var(--_tk-speed, 1) * 0.24s);
      }

      :host([data-motion="animated"]) .gear {
        animation: tk-spin calc(var(--_tk-speed, 1) * 2.4s) linear infinite;
        transform-origin: 50px 63px;
      }

      :host([data-motion="animated"][state="idle"]) .asset { animation: tk-float 4s ease-in-out infinite; }
      :host([data-motion="animated"][state="listening"]) .asset { animation: tk-pulse 1.4s ease-in-out infinite; }
      :host([data-motion="animated"][state="thinking"]) .asset { animation: tk-float 1.8s ease-in-out infinite; }
      :host([data-motion="animated"][state="speaking"]) .asset { animation: tk-pulse .45s ease-in-out infinite; }
      :host([data-motion="animated"][state="tool_running"]) .asset { animation: tk-float .8s ease-in-out infinite; }
      :host([data-motion="animated"][state="error"]) .asset { animation: tk-shake .3s ease-out 1; }
      @keyframes tk-shake { 25%,75% { transform:translateX(-3px); } 50% { transform:translateX(3px); } }
      @keyframes tk-float { 50% { transform: translateY(-3px); } }
      @keyframes tk-blink {
        0%, 92%, 100% { transform: scaleY(1); }
        95% { transform: scaleY(0.08); }
      }
      @keyframes tk-pulse {
        0%, 100% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.35); opacity: 0.65; }
      }
      @keyframes tk-ring {
        0% { transform: scale(0.6); opacity: 0.9; }
        100% { transform: scale(1.5); opacity: 0; }
      }
      @keyframes tk-think {
        0%, 100% { opacity: 0.25; transform: translateY(0); }
        50% { opacity: 1; transform: translateY(-3px); }
      }
      @keyframes tk-bar {
        0%, 100% { transform: scaleY(0.35); }
        50% { transform: scaleY(1); }
      }
      @keyframes tk-spin {
        to { transform: rotate(360deg); }
      }

      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
      }
    `,
  ];

  /** One of the seven canonical states. Anything else falls back to `idle`. */
  @property({ type: String, reflect: true })
  state: GuideState = "idle";

  @property({ type: String })
  renderer: RobotRenderer = "glyph";

  /** Sprite sheet / Lottie JSON URL, from `ui.robot.asset`. */
  @property({ type: String })
  asset?: string;

  /** `ui.robot.states` — per-state segment/loop/speed hints. */
  @property({ attribute: false })
  states?: Record<string, RobotStateAnimation>;

  /** `ui.robot.reduced_motion`. */
  @property({ type: String, attribute: "reduced-motion" })
  reducedMotion: ReducedMotionPolicy = "respect";

  @property({ attribute: false })
  avatar?: AvatarGroup;

  /** Accessible label prefix; the state name is appended. */
  @property({ type: String })
  label = "Guide";

  @state()
  private _prefersReducedMotion = false;

  #mql: MediaQueryList | null = null;
  #onMotionChange = (event: MediaQueryListEvent | MediaQueryList) => {
    this._prefersReducedMotion = event.matches;
  };

  /** The state actually rendered — unknown input is clamped to `idle`. */
  get resolvedState(): GuideState {
    return isGuideState(this.state) ? this.state : "idle";
  }

  /** `animated` or `static`, after the reduced-motion policy is applied. */
  get motion(): "animated" | "static" {
    if (this.reducedMotion === "force_static") return "static";
    if (this.reducedMotion === "ignore") return "animated";
    return this._prefersReducedMotion ? "static" : "animated";
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (typeof globalThis.matchMedia === "function") {
      this.#mql = globalThis.matchMedia(REDUCED_MOTION_QUERY);
      this._prefersReducedMotion = this.#mql.matches;
      this.#mql.addEventListener?.("change", this.#onMotionChange as EventListener);
    }
  }

  override disconnectedCallback(): void {
    this.#mql?.removeEventListener?.("change", this.#onMotionChange as EventListener);
    this.#mql = null;
    super.disconnectedCallback();
  }

  override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has("state") && !isGuideState(this.state)) {
      this.dataset.unknownState = String(this.state);
    } else if (changed.has("state")) {
      delete this.dataset.unknownState;
    }
  }

  override render(): TemplateResult {
    const current = this.resolvedState;
    const motion = this.motion;
    const config = this.states?.[current];
    const speed = config?.speed && config.speed > 0 ? 1 / config.speed : 1;
    const asset = this.avatar?.states?.[current] ?? this.avatar?.default;
    const source = asset?.src && !/^(?:javascript|vbscript|data:(?!image\/))/i.test(asset.src) ? asset.src : undefined;
    const fallback = this.renderer !== "glyph" && !source;

    this.dataset.motion = motion;
    this.dataset.state = current;
    this.dataset.renderer = this.renderer;
    if (fallback) {
      this.dataset.rendererFallback = "glyph";
    } else {
      delete this.dataset.rendererFallback;
    }

    if (source && asset) {
      const columns = Math.max(1, asset.columns ?? 1), rows = Math.max(1, asset.rows ?? 1);
      return html`<div role="img" part="image" class="asset" aria-label=${`${this.label}: ${current}`} style=${`width:100%;height:100%;background-image:url(${JSON.stringify(source)});background-repeat:no-repeat;background-size:${columns*100}% ${rows*100}%;background-position:${columns>1?(asset.column??0)*100/(columns-1):50}% ${rows>1?(asset.row??0)*100/(rows-1):50}%;`}> </div><span class="sr-only" data-testid="state-label">${current}</span>`;
    }
    return html`
      <svg
        viewBox="0 0 100 100"
        role="img"
        part="svg"
        aria-label=${`${this.label}: ${current}`}
        style=${`--_tk-speed:${speed}`}
      >
        ${this.#chrome(current, motion)} ${this.#face(current)} ${this.#mouth(current)}
        ${this.#aura(current)}
      </svg>
      <span class="sr-only" data-testid="state-label">${current}</span>
    `;
  }

  /** Head, antenna, torso — constant across states. */
  #chrome(current: GuideState, motion: "animated" | "static") {
    const antennaLit =
      current === "listening" || current === "thinking" || current === "tool_running";
    return svg`
      <line x1="50" y1="20" x2="50" y2="9" class="shell" />
      <circle
        cx="50" cy="7" r="4.5"
        class=${antennaLit ? "lit" : "shell"}
        part="antenna"
      />
      <rect x="17" y="20" width="66" height="53" rx="17" class="shell" part="head" />
      <rect x="25" y="29" width="50" height="27" rx="11" class="visor" part="visor" />
      <rect x="33" y="78" width="34" height="10" rx="5" class="shell" part="torso" />
      ${
        current === "listening" && motion === "animated"
          ? svg`
            <circle class="ring" cx="50" cy="46" r="42" fill="none" stroke="var(--tobor-kit-robot-accent, var(--_accent))" stroke-width="2" />
            <circle class="ring" cx="50" cy="46" r="42" fill="none" stroke="var(--tobor-kit-robot-accent, var(--_accent))" stroke-width="2" />
          `
          : nothing
      }
    `;
  }

  /** Eyes — the primary state tell. */
  #face(current: GuideState) {
    switch (current) {
      case "error":
        return svg`
          <g class="stroke-lit" part="eyes" data-eyes="error">
            <line x1="35" y1="38" x2="44" y2="47" />
            <line x1="44" y1="38" x2="35" y2="47" />
            <line x1="56" y1="38" x2="65" y2="47" />
            <line x1="65" y1="38" x2="56" y2="47" />
          </g>
        `;
      case "offline":
        return svg`
          <g class="stroke-lit" part="eyes" data-eyes="offline">
            <line x1="34" y1="43" x2="45" y2="43" />
            <line x1="55" y1="43" x2="66" y2="43" />
          </g>
        `;
      case "listening":
        return svg`
          <g part="eyes" data-eyes="wide">
            <circle class="lit" cx="39.5" cy="42.5" r="6.5" />
            <circle class="lit" cx="60.5" cy="42.5" r="6.5" />
          </g>
        `;
      case "thinking":
        return svg`
          <g part="eyes" data-eyes="up">
            <circle class="lit" cx="39.5" cy="40" r="4.5" />
            <circle class="lit" cx="60.5" cy="40" r="4.5" />
          </g>
          <g part="thinking-dots">
            <circle class="lit think-dot" cx="41" cy="14" r="3" />
            <circle class="lit think-dot" cx="50" cy="12" r="3" />
            <circle class="lit think-dot" cx="59" cy="14" r="3" />
          </g>
        `;
      default:
        return svg`
          <g class="blink" part="eyes" data-eyes="normal">
            <circle class="lit" cx="39.5" cy="42.5" r="5.5" />
            <circle class="lit" cx="60.5" cy="42.5" r="5.5" />
          </g>
        `;
    }
  }

  /** Mouth region — carries speaking bars and the tool-running gear. */
  #mouth(current: GuideState) {
    switch (current) {
      case "speaking":
        return svg`
          <g part="mouth" data-mouth="bars">
            <rect class="lit bar" x="40" y="59" width="4" height="9" rx="2" />
            <rect class="lit bar" x="48" y="57" width="4" height="13" rx="2" />
            <rect class="lit bar" x="56" y="59" width="4" height="9" rx="2" />
          </g>
        `;
      case "tool_running":
        return svg`
          <g class="gear" part="mouth" data-mouth="gear">
            <circle class="stroke-lit" cx="50" cy="63" r="6" />
            <line class="stroke-lit" x1="50" y1="53.5" x2="50" y2="57" />
            <line class="stroke-lit" x1="50" y1="69" x2="50" y2="72.5" />
            <line class="stroke-lit" x1="40.5" y1="63" x2="44" y2="63" />
            <line class="stroke-lit" x1="56" y1="63" x2="59.5" y2="63" />
          </g>
        `;
      case "error":
        return svg`
          <path class="stroke-lit" part="mouth" data-mouth="frown" d="M41 68 Q50 60 59 68" />
        `;
      case "offline":
        return svg`
          <line class="stroke-lit" part="mouth" data-mouth="flat" x1="41" y1="65" x2="59" y2="65" />
        `;
      case "listening":
        return svg`
          <circle class="lit pulse" part="mouth" data-mouth="listening" cx="50" cy="64" r="4" />
        `;
      default:
        return svg`
          <path class="stroke-lit" part="mouth" data-mouth="smile" d="M42 62 Q50 69 58 62" />
        `;
    }
  }

  /** Small badge that makes `tool_running` unmistakable next to `thinking`. */
  #aura(current: GuideState) {
    if (current !== "tool_running") return nothing;
    return svg`
      <circle class="lit pulse" part="badge" cx="80" cy="24" r="5" />
    `;
  }
}

/** Every state this element understands, in contract order. */
export const ROBOT_STATES = GUIDE_STATES;

declare global {
  interface HTMLElementTagNameMap {
    "tobor-robot-avatar": ToborRobotAvatar;
  }
}
