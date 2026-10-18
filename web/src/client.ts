/**
 * `ToborKitClient` — the only thing in this package that talks HTTP.
 *
 * It implements `openapi/tobor-kit.openapi.yaml` and nothing else. The status
 * codes the contract gives *meaning* to (409 on `/voice/token`, 403 on
 * `PUT /telemetry/consent`, 501 on the transcript endpoints) are returned as
 * typed outcomes rather than thrown, because they are states the UI must
 * render distinctly — not failures.
 */

import { readSseStream } from "./sse.js";
import {
  isGuideState,
  type ApiError,
  type GuideProjection,
  type Session,
  type TelemetryConsent,
  type ToolInventory,
  type Turn,
  type TurnStreamHandlers,
  type VoiceCredential,
} from "./types.js";

export const DEFAULT_BASE_URL = "/api/tobor-kit";

export class ToborKitError extends Error {
  readonly status: number;
  readonly code: string;
  readonly detail?: Record<string, unknown>;

  constructor(status: number, error: ApiError) {
    super(error.message);
    this.name = "ToborKitError";
    this.status = status;
    this.code = error.code;
    if (error.detail) this.detail = error.detail;
  }
}

export type TokenProvider = string | (() => string | null | undefined | Promise<string | null | undefined>);

export interface ToborKitClientOptions {
  /** Defaults to `/api/tobor-kit`, matching the contract's `servers` entry. */
  baseUrl?: string;
  /** Bearer token, or a function returning one (re-read on every request). */
  token?: TokenProvider;
  /** Injectable for tests / non-browser hosts. */
  fetchImpl?: typeof fetch;
}

/** `POST /voice/token` — 409 means "this adapter needs no credential". */
export type VoiceTokenResult =
  | { ok: true; credential: VoiceCredential }
  | { ok: false; reason: "not_required" }
  | { ok: false; reason: "unavailable"; message: string };

/** `PUT /telemetry/consent` — 403 means the guide default is binding. */
export type TelemetryUpdateResult =
  | { ok: true; consent: TelemetryConsent }
  | { ok: false; reason: "forbidden" };

/**
 * `GET /sessions/{id}/transcript` — 501 means the configured store is
 * client-side. That is NOT an empty transcript and NOT an error.
 */
export type TranscriptResult =
  | { supported: true; turns: Turn[]; has_more: boolean }
  | { supported: false };

export interface CreateSessionBody {
  resume_id?: string;
  locale?: string;
  client?: "web" | "ios" | "macos" | "other";
}

export interface CreateTurnBody {
  input: string;
  task_id?: string;
  idempotency_key?: string;
}

export class ToborKitClient {
  readonly baseUrl: string;
  #token: TokenProvider | undefined;
  #fetch: typeof fetch;

  constructor(options: ToborKitClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.#token = options.token;
    const f = options.fetchImpl ?? globalThis.fetch;
    this.#fetch = f.bind(globalThis);
  }

  setToken(token: TokenProvider | undefined): void {
    this.#token = token;
  }

  /* ----------------------------------------------------------------- guide */

  /** `GET /guide` — the config projection. Never contains the NPL preamble. */
  async getGuide(signal?: AbortSignal): Promise<GuideProjection> {
    return this.#json<GuideProjection>(await this.#request("GET", "/guide", { signal }));
  }

  /* --------------------------------------------------------------- session */

  async createSession(body: CreateSessionBody = {}, signal?: AbortSignal): Promise<Session> {
    return this.#json<Session>(await this.#request("POST", "/sessions", { body, signal }));
  }

  async getSession(sessionId: string, signal?: AbortSignal): Promise<Session> {
    return this.#json<Session>(
      await this.#request("GET", `/sessions/${encodeURIComponent(sessionId)}`, { signal }),
    );
  }

  async endSession(sessionId: string, signal?: AbortSignal): Promise<void> {
    await this.#request("DELETE", `/sessions/${encodeURIComponent(sessionId)}`, { signal });
  }

  /**
   * `POST /sessions/{id}/turn` — consumes the SSE stream.
   *
   * The contract guarantees exactly one terminal `message` or `error`. This
   * enforces it: a stream that closes without one raises a synthetic
   * `stream_incomplete` error so the caller never leaves the avatar spinning.
   */
  async streamTurn(
    sessionId: string,
    body: CreateTurnBody,
    handlers: TurnStreamHandlers = {},
    signal?: AbortSignal,
  ): Promise<void> {
    const res = await this.#request(
      "POST",
      `/sessions/${encodeURIComponent(sessionId)}/turn`,
      { body, signal, accept: "text/event-stream" },
    );

    let terminated = false;
    const terminalError = (error: ApiError) => {
      if (terminated) return;
      terminated = true;
      handlers.onError?.(error);
    };

    if (!res.body) {
      terminalError({ code: "stream_unavailable", message: "response carried no body stream" });
      return;
    }

    try {
      await readSseStream(
        res.body,
        (frame) => {
          if (terminated) return;
          const data = safeParse(frame.data);
          switch (frame.event) {
            case "state": {
              const state = (data as { state?: unknown } | null)?.state;
              if (isGuideState(state)) handlers.onState?.(state);
              break;
            }
            case "delta": {
              const text = (data as { text?: unknown } | null)?.text;
              if (typeof text === "string") handlers.onDelta?.(text);
              break;
            }
            case "tool_call": {
              // Lenient decode: empty id tolerated, name is the required key.
              const d = data as { id?: string; name?: string; args?: unknown } | null;
              if (d?.name) {
                handlers.onToolCall?.(
                  "args" in d ? { id: d.id ?? "", name: d.name, args: d.args } : { id: d.id ?? "", name: d.name },
                );
              }
              break;
            }
            case "tool_result": {
              const d = data as { id?: string; ok?: boolean; summary?: string } | null;
              if (d?.id) {
                handlers.onToolResult?.({ id: d.id, ok: d.ok === true, summary: d.summary });
              }
              break;
            }
            case "message": {
              terminated = true;
              handlers.onMessage?.(data as Turn);
              break;
            }
            case "error": {
              terminated = true;
              const d = (data ?? {}) as Partial<ApiError>;
              handlers.onError?.({
                code: d.code ?? "unknown",
                message: d.message ?? "stream reported an error",
              });
              break;
            }
            default:
              break;
          }
        },
        signal,
      );
    } catch (err) {
      terminalError({
        code: "stream_failed",
        message: err instanceof Error ? err.message : String(err),
      });
      return;
    }

    // Closed without the guaranteed terminal frame.
    terminalError({
      code: "stream_incomplete",
      message: "stream closed before a terminal message or error",
    });
  }

  /* ------------------------------------------------------------------- mcp */

  /**
   * `GET /mcp/tools`. Rendered verbatim by both `tool-list` and `task-menu` —
   * the `mcp.menu` overlay is applied server-side so web and Swift cannot
   * drift. Never re-dress this client-side.
   */
  async listTools(options: { refresh?: boolean; signal?: AbortSignal } = {}): Promise<ToolInventory> {
    const path = options.refresh ? "/mcp/tools?refresh=true" : "/mcp/tools";
    const inventory = await this.#json<ToolInventory>(
      await this.#request("GET", path, { signal: options.signal }),
    );
    return {
      groups: inventory.groups ?? [],
      tools: inventory.tools ?? [],
      degraded: inventory.degraded ?? [],
    };
  }

  /* ----------------------------------------------------------------- voice */

  /**
   * `POST /voice/token`. 409 is the documented answer for the `native`
   * adapter — no credential is needed — so it is a success shape, not a throw.
   */
  async mintVoiceToken(signal?: AbortSignal): Promise<VoiceTokenResult> {
    const res = await this.#request("POST", "/voice/token", {
      signal,
      allowStatus: [409, 503],
    });
    if (res.status === 409) return { ok: false, reason: "not_required" };
    if (res.status === 503) {
      const err = await readError(res);
      return { ok: false, reason: "unavailable", message: err.message };
    }
    return { ok: true, credential: await this.#json<VoiceCredential>(res) };
  }

  /* ------------------------------------------------------------- telemetry */

  async getTelemetryConsent(signal?: AbortSignal): Promise<TelemetryConsent> {
    return this.#json<TelemetryConsent>(
      await this.#request("GET", "/telemetry/consent", { signal }),
    );
  }

  /** 403 means `user_overridable` is false — the client should not have asked. */
  async setTelemetryConsent(enabled: boolean, signal?: AbortSignal): Promise<TelemetryUpdateResult> {
    const res = await this.#request("PUT", "/telemetry/consent", {
      body: { enabled },
      signal,
      allowStatus: [403],
    });
    if (res.status === 403) return { ok: false, reason: "forbidden" };
    return { ok: true, consent: await this.#json<TelemetryConsent>(res) };
  }

  /* ------------------------------------------------------------ transcript */

  async getTranscript(
    sessionId: string,
    options: { limit?: number; before?: string; signal?: AbortSignal } = {},
  ): Promise<TranscriptResult> {
    const params = new URLSearchParams();
    if (options.limit != null) params.set("limit", String(options.limit));
    if (options.before) params.set("before", options.before);
    const qs = params.toString();
    const res = await this.#request(
      "GET",
      `/sessions/${encodeURIComponent(sessionId)}/transcript${qs ? `?${qs}` : ""}`,
      { signal: options.signal, allowStatus: [501] },
    );
    if (res.status === 501) return { supported: false };
    const body = await this.#json<{ turns?: Turn[]; has_more?: boolean }>(res);
    return { supported: true, turns: body.turns ?? [], has_more: body.has_more === true };
  }

  async deleteTranscript(sessionId: string, signal?: AbortSignal): Promise<{ supported: boolean }> {
    const res = await this.#request(
      "DELETE",
      `/sessions/${encodeURIComponent(sessionId)}/transcript`,
      { signal, allowStatus: [501] },
    );
    return { supported: res.status !== 501 };
  }

  /* --------------------------------------------------------------- private */

  async #request(
    method: string,
    path: string,
    options: {
      body?: unknown;
      signal?: AbortSignal;
      accept?: string;
      allowStatus?: number[];
    } = {},
  ): Promise<Response> {
    const headers: Record<string, string> = {
      Accept: options.accept ?? "application/json",
    };
    if (options.body !== undefined) headers["Content-Type"] = "application/json";

    const token = typeof this.#token === "function" ? await this.#token() : this.#token;
    if (token) headers.Authorization = `Bearer ${token}`;

    const init: RequestInit = { method, headers };
    if (options.body !== undefined) init.body = JSON.stringify(options.body);
    if (options.signal) init.signal = options.signal;

    const res = await this.#fetch(`${this.baseUrl}${path}`, init);
    if (res.ok || options.allowStatus?.includes(res.status)) return res;
    throw new ToborKitError(res.status, await readError(res));
  }

  async #json<T>(res: Response): Promise<T> {
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    if (!text) return undefined as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new ToborKitError(res.status, {
        code: "malformed_response",
        message: "response was not valid JSON",
      });
    }
  }
}

async function readError(res: Response): Promise<ApiError> {
  let text = "";
  try {
    text = await res.text();
  } catch {
    /* body already consumed or unreadable */
  }
  try {
    const parsed = JSON.parse(text) as Partial<ApiError>;
    if (parsed && typeof parsed.message === "string") {
      return { code: parsed.code ?? `http_${res.status}`, message: parsed.message };
    }
  } catch {
    /* not JSON */
  }
  return {
    code: `http_${res.status}`,
    message: text.slice(0, 300) || `request failed with status ${res.status}`,
  };
}

function safeParse(data: string): unknown {
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}
