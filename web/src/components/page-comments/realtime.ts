/**
 * Realtime layer for `<noizu-page-comments>` (phase 5).
 *
 * `RealtimeSource` owns a phoenix `Socket` against the annotate service
 * (`wss://…/socket/annotate`, websocket-only transport) and joins one topic
 * per page: `page:<site_slug>:<sha256hex(page_key)>`. The page_key hash is
 * SubtleCrypto SHA-256 — the backend asserts the same vector this package
 * tests (`phase5-parity-vector` → `63b1124d…b17f5`), so a casing or
 * encoding drift on either side fails a test instead of silently joining
 * the wrong topic.
 *
 * Everything the rail needs to react to a push is a pure function of the
 * current thread list plus one event: `mergeRealtimeEvent` upserts by id so
 * replays are no-ops, and an optional `OwnWriteRegistry` drops the echo of
 * a write this client just made (own writes are followed by a refetch, so
 * the echo carries nothing new and could only clobber newer local state).
 */

import type {Channel, Socket} from "phoenix";

import type {PageAnchor} from "./anchor.js";
import type {CommentReply, CommentThread} from "./data-source.js";

/* ------------------------------------------------------------------ */
/* topic hashing                                                       */
/* ------------------------------------------------------------------ */

/** SubtleCrypto SHA-256 of `input`, lowercase hex. */
export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Topic for one page's threads: `page:<site_slug>:<sha256hex(page_key)>`.
 * The site slug rides the topic verbatim (it is NOT the URL-encoded form
 * `HttpDataSource` uses in REST paths).
 */
export async function pageTopic(site: string, pageKey: string): Promise<string> {
  return `page:${site}:${await sha256Hex(pageKey)}`;
}

/** Backend parity vector — the same string/hash the service asserts. */
export const PARITY_VECTOR = "phase5-parity-vector";
export const PARITY_VECTOR_SHA256 = "63b1124d51c9c48fe33623ab2755b4959deaf5bdb2d4426a002c24ddb52b17f5";

/* ------------------------------------------------------------------ */
/* events                                                              */
/* ------------------------------------------------------------------ */

export type RealtimeEventName =
  | "thread_created"
  | "comment_created"
  | "comment_updated"
  | "comment_deleted"
  | "thread_resolved"
  | "thread_reopened"
  | "thread_anchor_updated";

export const REALTIME_EVENT_NAMES: readonly RealtimeEventName[] = [
  "thread_created",
  "comment_created",
  "comment_updated",
  "comment_deleted",
  "thread_resolved",
  "thread_reopened",
  "thread_anchor_updated",
];

export type RealtimeEvent =
  | {type: "thread_created"; thread: CommentThread}
  | {type: "comment_created"; threadId: string; comment: CommentReply}
  | {type: "comment_updated"; threadId: string; comment: CommentReply}
  | {type: "comment_deleted"; threadId: string; commentId: string}
  | {type: "thread_resolved"; threadId: string}
  | {type: "thread_reopened"; threadId: string}
  | {type: "thread_anchor_updated"; threadId: string; anchor: PageAnchor};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

/**
 * Tolerant payload parser: channel events arrive as `{"thread": …}` /
 * `{"comment": …}` envelopes, but sibling keys (`thread_id`, `anchor`, …)
 * are honored too so minor backend envelope drift does not drop events.
 */
export function parseRealtimeEvent(name: RealtimeEventName, payload: unknown): RealtimeEvent | null {
  const body = asRecord(payload) ?? {};
  const thread = asRecord(body.thread);
  const comment = asRecord(body.comment) ?? (body.id && !thread && (body.body_md !== undefined) ? body : null);
  const threadId = asString(body.thread_id) ?? asString(thread?.id) ?? asString(comment?.thread_id);
  switch (name) {
    case "thread_created":
      if (!thread || !asString(thread.id)) return null;
      return {type: "thread_created", thread: thread as unknown as CommentThread};
    case "comment_created":
    case "comment_updated":
      if (!comment || !asString(comment.id) || !threadId) return null;
      return {type: name, threadId, comment: comment as unknown as CommentReply};
    case "comment_deleted":
      return {type: "comment_deleted", threadId: threadId ?? "", commentId: asString(body.comment_id) ?? asString(comment?.id) ?? ""};
    case "thread_resolved":
    case "thread_reopened":
      if (!threadId) return null;
      return {type: name, threadId};
    case "thread_anchor_updated":
      if (!threadId || !asRecord(body.anchor)) return null;
      return {type: "thread_anchor_updated", threadId, anchor: body.anchor as unknown as PageAnchor};
  }
}

/* ------------------------------------------------------------------ */
/* own-write dedupe                                                    */
/* ------------------------------------------------------------------ */

const OWN_WRITE_TTL_MS = 30_000;

/**
 * Ids of writes this client made. An incoming echo carrying a recorded id
 * is dropped once; a later event for the same id (another user's edit)
 * merges normally. Entries expire so a lost echo cannot swallow a future
 * foreign write to the same object.
 */
export class OwnWriteRegistry {
  private readonly ids = new Map<string, number>();
  private readonly ttlMs: number;

  constructor(ttlMs: number = OWN_WRITE_TTL_MS) {
    this.ttlMs = ttlMs;
  }

  record(id: string): void {
    this.ids.set(id, Date.now());
  }

  /** True (once per record) when `id` matches a recent own write. */
  consume(id: string): boolean {
    this.prune();
    if (!this.ids.has(id)) return false;
    this.ids.delete(id);
    return true;
  }

  private prune(): void {
    const now = Date.now();
    for (const [id, at] of this.ids) {
      if (now - at > this.ttlMs) this.ids.delete(id);
    }
  }
}

/* ------------------------------------------------------------------ */
/* merge                                                               */
/* ------------------------------------------------------------------ */

export interface MergeResult {
  /** Next thread list (same reference when nothing changed). */
  threads: CommentThread[];
  /** Thread the event landed on; null when it touched nothing known. */
  threadId: string | null;
  /** False when the event was a pure replay of current state. */
  changed: boolean;
  /** True when the event names a thread this list does not know. */
  unknownThread: boolean;
}

/** Key-order-independent structural key, for change detection. */
function stableKey(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableKey).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : 1));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableKey(v)}`).join(",")}}`;
}

function replaceAt<T>(list: T[], index: number, value: T): T[] {
  const next = list.slice();
  next[index] = value;
  return next;
}

/**
 * Merge one realtime event into a thread list. Pure and idempotent: the
 * same event applied twice leaves the list untouched the second time, and
 * every mutation is an upsert/remove **by id** (never an append-by-value).
 *
 * Returns `null` for the echo of a write `ownWrites` has recorded — the
 * caller refetches after its own writes, so such an echo must not
 * duplicate or clobber anything.
 */
export function mergeRealtimeEvent(
  threads: CommentThread[],
  event: RealtimeEvent,
  ownWrites?: OwnWriteRegistry,
): MergeResult | null {
  const primaryId =
    event.type === "thread_created"
      ? event.thread.id
      : event.type === "comment_created" || event.type === "comment_updated"
        ? event.comment.id
        : event.type === "comment_deleted"
          ? event.commentId
          : event.threadId;
  if (ownWrites?.consume(primaryId)) return null;

  const threadIndexOf = (threadId: string | undefined): number =>
    threadId ? threads.findIndex((thread) => thread.id === threadId) : -1;
  const commentLocation = (commentId: string): {threadAt: number; commentAt: number} | null => {
    for (let threadAt = 0; threadAt < threads.length; threadAt += 1) {
      const commentAt = threads[threadAt].comments.findIndex((comment) => comment.id === commentId);
      if (commentAt !== -1) return {threadAt, commentAt};
    }
    return null;
  };

  switch (event.type) {
    case "thread_created": {
      const at = threads.findIndex((thread) => thread.id === event.thread.id);
      if (at === -1) {
        return {threads: [...threads, event.thread], threadId: event.thread.id, changed: true, unknownThread: false};
      }
      if (stableKey(threads[at]) === stableKey(event.thread)) {
        return {threads, threadId: event.thread.id, changed: false, unknownThread: false};
      }
      return {threads: replaceAt(threads, at, event.thread), threadId: event.thread.id, changed: true, unknownThread: false};
    }
    case "comment_created":
    case "comment_updated": {
      const threadAt = threadIndexOf(event.threadId);
      if (threadAt === -1) {
        return {threads, threadId: null, changed: false, unknownThread: true};
      }
      const thread = threads[threadAt];
      const commentAt = thread.comments.findIndex((comment) => comment.id === event.comment.id);
      if (commentAt !== -1 && stableKey(thread.comments[commentAt]) === stableKey(event.comment)) {
        return {threads, threadId: thread.id, changed: false, unknownThread: false};
      }
      const nextComments =
        commentAt === -1
          ? [...thread.comments, event.comment]
          : replaceAt(thread.comments, commentAt, event.comment);
      const nextThread: CommentThread = {...thread, comments: nextComments};
      return {threads: replaceAt(threads, threadAt, nextThread), threadId: thread.id, changed: true, unknownThread: false};
    }
    case "comment_deleted": {
      const hit = commentLocation(event.commentId);
      if (!hit) return {threads, threadId: null, changed: false, unknownThread: false};
      const thread = threads[hit.threadAt];
      const nextComments = thread.comments.filter((comment) => comment.id !== event.commentId);
      const nextThread: CommentThread = {...thread, comments: nextComments};
      return {threads: replaceAt(threads, hit.threadAt, nextThread), threadId: thread.id, changed: true, unknownThread: false};
    }
    case "thread_resolved":
    case "thread_reopened": {
      const threadAt = threadIndexOf(event.threadId);
      if (threadAt === -1) return {threads, threadId: null, changed: false, unknownThread: true};
      const thread = threads[threadAt];
      const resolved = event.type === "thread_resolved";
      if (thread.resolved === resolved) {
        return {threads, threadId: thread.id, changed: false, unknownThread: false};
      }
      const nextThread: CommentThread = {...thread, resolved};
      return {threads: replaceAt(threads, threadAt, nextThread), threadId: thread.id, changed: true, unknownThread: false};
    }
    case "thread_anchor_updated": {
      const threadAt = threadIndexOf(event.threadId);
      if (threadAt === -1) return {threads, threadId: null, changed: false, unknownThread: true};
      const thread = threads[threadAt];
      if (stableKey(thread.anchor) === stableKey(event.anchor)) {
        return {threads, threadId: thread.id, changed: false, unknownThread: false};
      }
      const nextThread: CommentThread = {...thread, anchor: event.anchor};
      return {threads: replaceAt(threads, threadAt, nextThread), threadId: thread.id, changed: true, unknownThread: false};
    }
  }
}

/* ------------------------------------------------------------------ */
/* connection                                                          */
/* ------------------------------------------------------------------ */

/** Handle the controller holds for a live realtime subscription. */
export interface RealtimeConnection {
  /** Switch to another pageKey's topic (socket stays up). */
  rejoin(pageKey: string): void;
  /** Drop the subscription and close the socket. */
  disconnect(): void;
}

/**
 * Optional data-source capability, parallel to
 * `AttachmentCapableDataSource`: when present and the `realtime` property
 * is on, the controller subscribes while enabled.
 */
export interface RealtimeCapableDataSource {
  connectRealtime(pageKey: string, onEvent: (event: RealtimeEvent) => void): RealtimeConnection;
}

export type RealtimeStatus = "connecting" | "connected" | "disconnected";

export interface RealtimeSourceOptions {
  apiBase: string;
  /** Raw site slug (goes into connect params and the topic verbatim). */
  site: string;
  getAccessToken?: () => string | undefined;
  onEvent: (event: RealtimeEvent) => void;
  onStatus?: (status: RealtimeStatus) => void;
}

/** Socket-level exponential backoff: 1s, 2s, 4s … capped 30s, with jitter. */
export function reconnectAfterMs(tries: number): number {
  const base = Math.min(30_000, 1_000 * 2 ** Math.max(0, tries - 1));
  return base + Math.floor(Math.random() * 250);
}

/**
 * Phoenix socket wrapper. One `RealtimeSource` = one socket = one joined
 * topic; `rejoin(pageKey)` swaps topics (page change), and a token change
 * (sign-in/out) is a disconnect + fresh `connectRealtime` since connect
 * params are fixed per socket.
 */
export class RealtimeSource implements RealtimeConnection {
  private readonly apiBase: string;
  private readonly site: string;
  private readonly getAccessToken: () => string | undefined;
  private readonly onEvent: (event: RealtimeEvent) => void;
  private readonly onStatus: (status: RealtimeStatus) => void;

  private socket: Socket | null = null;
  private channel: Channel | null = null;
  private pageKey: string | null = null;
  private disposed = false;

  constructor(options: RealtimeSourceOptions) {
    this.apiBase = options.apiBase.replace(/\/+$/, "");
    this.site = options.site;
    this.getAccessToken = options.getAccessToken ?? (() => undefined);
    this.onEvent = options.onEvent;
    this.onStatus = options.onStatus ?? (() => {});
  }

  /** Open the socket (websocket-only) and join `page:<site>:<hash>`. */
  async connect(pageKey: string): Promise<void> {
    if (this.disposed || this.socket) return;
    this.pageKey = pageKey;
    this.onStatus("connecting");
    let Phoenix: typeof import("phoenix");
    try {
      Phoenix = await import("phoenix");
    } catch (error) {
      console.warn("[page-comments] phoenix client unavailable — realtime off", error);
      this.onStatus("disconnected");
      return;
    }
    if (this.disposed || this.socket) return; // disconnect raced the import
    const token = this.getAccessToken();
    const url = `${this.apiBase.replace(/^http/, "ws")}/socket/annotate`;
    const socket = new Phoenix.Socket(url, {
      params: {site: this.site, ...(token ? {token} : {})},
      transport: WebSocket, // websocket only — no longpoll fallback
      reconnectAfterMs,
    });
    socket.onOpen(() => {
      if (this.socket !== socket || this.disposed) return;
      this.onStatus("connected");
      if (!this.channel) this.joinTopic();
    });
    socket.onError(() => {
      if (this.socket === socket && !this.disposed) this.onStatus("connecting");
    });
    this.socket = socket;
    socket.connect();
    this.joinTopic(); // phoenix buffers the join until the socket opens
  }

  rejoin(pageKey: string): void {
    if (this.disposed || pageKey === this.pageKey) return;
    this.pageKey = pageKey;
    this.channel?.leave();
    this.channel = null;
    this.joinTopic();
  }

  disconnect(): void {
    this.disposed = true;
    this.channel?.leave();
    this.channel = null;
    this.socket?.disconnect();
    this.socket = null;
    this.pageKey = null;
    this.onStatus("disconnected");
  }

  private joinTopic(): void {
    const socket = this.socket;
    const pageKey = this.pageKey;
    if (!socket || pageKey === null) return;
    void (async () => {
      let topic: string;
      try {
        topic = await pageTopic(this.site, pageKey);
      } catch {
        return; // no SubtleCrypto (insecure context) — realtime is a bonus
      }
      if (this.disposed || this.socket !== socket || this.pageKey !== pageKey || this.channel) return;
      const channel = socket.channel(topic, {});
      for (const name of REALTIME_EVENT_NAMES) {
        channel.on(name, (payload: unknown) => {
          if (this.disposed) return;
          const event = parseRealtimeEvent(name, payload);
          if (event) this.onEvent(event);
        });
      }
      channel.join().receive("error", (error: unknown) => {
        if (!this.disposed) console.warn("[page-comments] realtime join failed", topic, error);
      });
      this.channel = channel;
    })();
  }
}
