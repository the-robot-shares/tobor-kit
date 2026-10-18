/**
 * Thread persistence for `<noizu-page-comments>`.
 *
 * `DataSource` is the only storage surface the element knows. Two built-in
 * implementations:
 *
 * - `HttpDataSource` — the annotate service contract (`api-base`), CORS +
 *   `credentials: 'omit'`, bearer token from the in-memory auth client.
 *   Also implements `AttachmentCapableDataSource` (presign → PUT → complete)
 *   and `RealtimeCapableDataSource` (phoenix socket, phase 5).
 * - `MemoryDataSource` — demo/test store, seedable, no network; attachments
 *   are faked with object URLs and realtime is simulated via `emitRealtime`.
 *
 * Custom data sources may skip `AttachmentCapableDataSource`; the composer
 * then hides its attach affordances. Skipping
 * `RealtimeCapableDataSource` just leaves the rail poll-only.
 */

import type {PageAnchor} from "./anchor.js";
import type {AnnotationDocument} from "./annotation.js";
import type {RealtimeCapableDataSource, RealtimeConnection, RealtimeEvent} from "./realtime.js";
import {RealtimeSource} from "./realtime.js";

export interface CommentReply {
  id: string;
  thread_id?: string;
  parent_id?: string | null;
  body_md: string;
  author?: string;
  created_at?: string;
  attachments?: Attachment[];
}

export interface CommentThread {
  id: string;
  page_key: string;
  url: string;
  title?: string;
  anchor: PageAnchor;
  body_md: string;
  resolved?: boolean;
  author?: string;
  created_at?: string;
  comments: CommentReply[];
  attachments?: Attachment[];
}

export interface CreateThreadInput {
  page_key: string;
  url: string;
  title?: string;
  anchor: PageAnchor;
  body_md: string;
  /** Uploaded attachment ids; only own + ready + unbound ones bind (else 422). */
  attachment_ids?: string[];
}

/* ------------------------------------------------------------------ */
/* attachments                                                         */
/* ------------------------------------------------------------------ */

export type AttachmentKind = "file" | "image" | "screenshot";

/** Wire shape of a stored attachment (thread/comment payloads carry `url` presigned). */
export interface Attachment {
  id: string;
  filename: string;
  content_type: string;
  bytes: number;
  kind: AttachmentKind;
  width?: number;
  height?: number;
  annotation?: AnnotationDocument;
  /** Presigned GET url — only present on stored (bound) attachments. */
  url?: string;
}

export interface PresignInput {
  filename: string;
  content_type: string;
  bytes: number;
  kind: AttachmentKind;
}

export interface PresignResult {
  id: string;
  uploadUrl: string;
  headers: Record<string, string>;
}

export interface CompleteMeta {
  width?: number;
  height?: number;
  annotation?: AnnotationDocument;
}

export type UploadProgressFn = (loaded: number, total: number) => void;

/**
 * Upload surface. `HttpDataSource` implements the annotate attachment
 * contract (presign → browser PUT to MinIO → complete); `MemoryDataSource`
 * fakes it with object URLs for demos/tests. Custom data sources may omit
 * it — the composer hides attach affordances when absent.
 */
export interface AttachmentCapableDataSource {
  presign(input: PresignInput): Promise<PresignResult>;
  /** PUT the bytes to the presigned url (no Authorization, no credentials). */
  upload(presigned: PresignResult, blob: Blob, onProgress?: UploadProgressFn): Promise<void>;
  complete(id: string, meta?: CompleteMeta): Promise<Attachment>;
}

/** Error with the HTTP status attached, so UI copy can classify 413/422. */
export class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = "HttpError";
  }
}

export interface DataSource {
  listThreads(pageKey: string): Promise<CommentThread[]>;
  createThread(input: CreateThreadInput): Promise<CommentThread>;
  /** `parent_id` replies one level deep (root comment + replies). */
  reply(threadId: string, bodyMd: string, parentId?: string, attachmentIds?: string[]): Promise<CommentReply>;
  edit(commentId: string, bodyMd: string): Promise<void>;
  remove(commentId: string): Promise<void>;
  resolve(threadId: string): Promise<void>;
  reopen(threadId: string): Promise<void>;
  /** Re-anchor an orphaned thread after a successful re-pick. */
  updateAnchor?(threadId: string, anchor: PageAnchor): Promise<void>;
}

export interface HttpDataSourceOptions {
  apiBase: string;
  site: string;
  /** In-memory bearer token; when empty requests go out unauthenticated. */
  getAccessToken?: () => string | undefined;
  fetch?: typeof fetch;
}

/** Wire format of a stored anchor on the annotate service. */
export type WireAnchor = PageAnchor;

function headers(token?: string): HeadersInit {
  const base: Record<string, string> = {"Content-Type": "application/json", Accept: "application/json"};
  if (token) base.Authorization = `Bearer ${token}`;
  return base;
}

export class HttpDataSource implements DataSource, AttachmentCapableDataSource, RealtimeCapableDataSource {
  private readonly apiBase: string;
  private readonly site: string;
  /** Raw site slug — realtime topics take it verbatim, REST paths encoded. */
  private readonly siteSlug: string;
  private readonly getAccessToken: () => string | undefined;
  private readonly fetchImpl: typeof fetch;

  constructor(options: HttpDataSourceOptions) {
    this.apiBase = options.apiBase.replace(/\/+$/, "");
    this.site = encodeURIComponent(options.site);
    this.siteSlug = options.site;
    this.getAccessToken = options.getAccessToken ?? (() => undefined);
    this.fetchImpl = options.fetch ?? fetch.bind(globalThis);
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await this.fetchImpl(`${this.apiBase}${path}`, {
      method,
      mode: "cors",
      credentials: "omit",
      headers: headers(this.getAccessToken()),
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) {
      throw new HttpError(response.status, `annotate-srv ${method} ${path} -> ${response.status}`);
    }
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  async listThreads(pageKey: string): Promise<CommentThread[]> {
    const result = await this.request<{threads?: CommentThread[]} | CommentThread[]>(
      "GET",
      `/api/v1/sites/${this.site}/threads?page_key=${encodeURIComponent(pageKey)}`,
    );
    return Array.isArray(result) ? result : (result?.threads ?? []);
  }

  async createThread(input: CreateThreadInput): Promise<CommentThread> {
    return this.request<CommentThread>("POST", `/api/v1/sites/${this.site}/threads`, input);
  }

  async reply(threadId: string, bodyMd: string, parentId?: string, attachmentIds?: string[]): Promise<CommentReply> {
    return this.request<CommentReply>("POST", `/api/v1/threads/${encodeURIComponent(threadId)}/comments`, {
      body_md: bodyMd,
      ...(parentId ? {parent_id: parentId} : {}),
      ...(attachmentIds?.length ? {attachment_ids: attachmentIds} : {}),
    });
  }

  /* ---------------- attachments ---------------- */

  async presign(input: PresignInput): Promise<PresignResult> {
    // Site rides the query string: preflights cannot send Authorization.
    const payload = await this.request<Record<string, unknown>>(
      "POST",
      `/api/v1/attachments/presign?site=${this.site}`,
      input,
    );
    const nested = payload.attachment as Record<string, unknown> | undefined;
    const id = (nested?.id ?? payload.id) as string | undefined;
    if (!id || typeof payload.upload_url !== "string") {
      throw new HttpError(0, "annotate-srv presign returned no upload target");
    }
    const headers = (payload.headers as Record<string, string> | undefined) ?? {};
    return {id, uploadUrl: payload.upload_url, headers};
  }

  upload(presigned: PresignResult, blob: Blob, onProgress?: UploadProgressFn): Promise<void> {
    return new Promise((resolve, reject) => {
      // Plain XHR (fetch has no upload progress). MinIO presigned PUTs take
      // no Authorization header and no credentials.
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", presigned.uploadUrl);
      for (const [name, value] of Object.entries(presigned.headers)) {
        xhr.setRequestHeader(name, value);
      }
      if (!Object.keys(presigned.headers).some((name) => name.toLowerCase() === "content-type")) {
        xhr.setRequestHeader("Content-Type", blob.type || "application/octet-stream");
      }
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress?.(event.loaded, event.total);
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new HttpError(xhr.status, `minio PUT -> ${xhr.status}`));
      };
      xhr.onerror = () => reject(new HttpError(0, "minio PUT network error"));
      xhr.onabort = () => reject(new HttpError(0, "minio PUT aborted"));
      xhr.send(blob);
    });
  }

  async complete(id: string, meta?: CompleteMeta): Promise<Attachment> {
    const payload = await this.request<Record<string, unknown>>(
      "POST",
      `/api/v1/attachments/${encodeURIComponent(id)}/complete?site=${this.site}`,
      meta ?? {},
    );
    const attachment = parseAttachment(payload);
    if (!attachment) throw new HttpError(0, "annotate-srv complete returned no attachment");
    return attachment;
  }

  async edit(commentId: string, bodyMd: string): Promise<void> {
    await this.request("PATCH", `/api/v1/comments/${encodeURIComponent(commentId)}`, {body_md: bodyMd});
  }

  async remove(commentId: string): Promise<void> {
    await this.request("DELETE", `/api/v1/comments/${encodeURIComponent(commentId)}`);
  }

  async resolve(threadId: string): Promise<void> {
    await this.request("POST", `/api/v1/threads/${encodeURIComponent(threadId)}/resolve`);
  }

  async reopen(threadId: string): Promise<void> {
    await this.request("POST", `/api/v1/threads/${encodeURIComponent(threadId)}/reopen`);
  }

  async updateAnchor(threadId: string, anchor: PageAnchor): Promise<void> {
    await this.request("PATCH", `/api/v1/threads/${encodeURIComponent(threadId)}/anchor`, {anchor});
  }

  /* ---------------- realtime ---------------- */

  /**
   * Optional capability (phase 5): subscribe to the page topic over a
   * phoenix websocket while the widget is enabled. Connect params carry
   * the site slug and, when signed in, the bearer token; see
   * `docs/backend-requirements.md`.
   */
  connectRealtime(pageKey: string, onEvent: (event: RealtimeEvent) => void): RealtimeConnection {
    const source = new RealtimeSource({
      apiBase: this.apiBase,
      site: this.siteSlug,
      getAccessToken: this.getAccessToken,
      onEvent,
    });
    void source.connect(pageKey);
    return source;
  }
}

let memoryCounter = 0;

interface MemoryAttachmentRecord {
  attachment: Attachment;
  /** Blob captured at upload; backs the preview object URL. */
  blob?: Blob;
  /** Pending uploads carry a placeholder; ready ones the real object URL. */
  objectUrl?: string;
  ready: boolean;
  bound: boolean;
}

/**
 * Accepts `{attachment: {...}}` or a flat attachment object (the service's
 * envelope has drifted between phases; both parse).
 */
export function parseAttachment(payload: unknown): Attachment | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const source = (record.attachment && typeof record.attachment === "object" ? record.attachment : record) as Record<string, unknown>;
  if (typeof source.id !== "string" || typeof source.filename !== "string") return null;
  const kind = source.kind === "image" || source.kind === "screenshot" ? source.kind : "file";
  return {
    id: source.id,
    filename: source.filename,
    content_type: typeof source.content_type === "string" ? source.content_type : "application/octet-stream",
    bytes: typeof source.bytes === "number" ? source.bytes : 0,
    kind,
    ...(typeof source.width === "number" ? {width: source.width} : {}),
    ...(typeof source.height === "number" ? {height: source.height} : {}),
    ...(source.annotation && typeof source.annotation === "object" ? {annotation: source.annotation as Attachment["annotation"]} : {}),
    ...(typeof source.url === "string" ? {url: source.url} : {}),
  };
}

/**
 * In-memory store for demos and tests. Seeds are cloned on `listThreads`, so
 * a Cypress run can re-seed per test without cross-test bleed. Attachments
 * are faked with object URLs: `presign` mints a pending record, `upload`
 * captures the blob, `complete` freezes the record and hands back an
 * `Attachment` whose `url` is a live `blob:` link previews can render.
 */
export class MemoryDataSource implements DataSource, AttachmentCapableDataSource, RealtimeCapableDataSource {
  readonly store = new Map<string, CommentThread>();
  private readonly attachments = new Map<string, MemoryAttachmentRecord>();
  /** Simulated realtime subscribers (`connectRealtime` clients). */
  private readonly realtimeClients = new Set<{pageKey: string; onEvent: (event: RealtimeEvent) => void}>();

  constructor(seeds: CommentThread[] = []) {
    for (const thread of seeds) this.store.set(thread.id, structuredClone(thread));
  }

  private clone<T>(value: T): T {
    return structuredClone(value);
  }

  private nextId(prefix: string): string {
    memoryCounter += 1;
    return `${prefix}-${Date.now().toString(36)}-${memoryCounter}`;
  }

  /* ---------------- attachments ---------------- */

  async presign(input: PresignInput): Promise<PresignResult> {
    const id = this.nextId("attach");
    this.attachments.set(id, {
      attachment: {
        id,
        filename: input.filename,
        content_type: input.content_type,
        bytes: input.bytes,
        kind: input.kind,
      },
      ready: false,
      bound: false,
    });
    return {id, uploadUrl: `memory-upload://${id}`, headers: {}};
  }

  async upload(presigned: PresignResult, blob: Blob, onProgress?: UploadProgressFn): Promise<void> {
    const record = this.attachments.get(presigned.id);
    if (!record) throw new Error(`unknown attachment ${presigned.id}`);
    onProgress?.(0, blob.size);
    await new Promise((resolve) => setTimeout(resolve, 0));
    record.blob = blob;
    record.objectUrl = URL.createObjectURL(blob);
    onProgress?.(blob.size, blob.size);
  }

  async complete(id: string, meta?: CompleteMeta): Promise<Attachment> {
    const record = this.attachments.get(id);
    if (!record) throw new Error(`unknown attachment ${id}`);
    record.ready = true;
    record.attachment.url = record.objectUrl;
    if (meta?.width !== undefined) record.attachment.width = meta.width;
    if (meta?.height !== undefined) record.attachment.height = meta.height;
    if (meta?.annotation) record.attachment.annotation = this.clone(meta.annotation);
    return this.clone(record.attachment);
  }

  /** Bind ready + unbound ids onto a comment; mirrors the 422 mismatch rule. */
  private bind(ids: string[] | undefined): Attachment[] {
    if (!ids?.length) return [];
    return ids.map((id) => {
      const record = this.attachments.get(id);
      if (!record || !record.ready || record.bound) {
        throw new Error("attachment_mismatch");
      }
      record.bound = true;
      return this.clone(record.attachment);
    });
  }

  /* ---------------- threads + comments ---------------- */

  async listThreads(pageKey: string): Promise<CommentThread[]> {
    return [...this.store.values()]
      .filter((thread) => thread.page_key === pageKey)
      .map((thread) => this.clone(thread));
  }

  async createThread(input: CreateThreadInput): Promise<CommentThread> {
    const thread: CommentThread = {
      id: this.nextId("thread"),
      page_key: input.page_key,
      url: input.url,
      title: input.title,
      anchor: this.clone(input.anchor),
      body_md: input.body_md,
      resolved: false,
      created_at: new Date().toISOString(),
      comments: [],
      ...(input.attachment_ids?.length ? {attachments: this.bind(input.attachment_ids)} : {}),
    };
    this.store.set(thread.id, thread);
    return this.clone(thread);
  }

  async reply(threadId: string, bodyMd: string, parentId?: string, attachmentIds?: string[]): Promise<CommentReply> {
    const thread = this.store.get(threadId);
    if (!thread) throw new Error(`unknown thread ${threadId}`);
    const reply: CommentReply = {
      id: this.nextId("comment"),
      thread_id: threadId,
      parent_id: parentId ?? null,
      body_md: bodyMd,
      created_at: new Date().toISOString(),
      ...(attachmentIds?.length ? {attachments: this.bind(attachmentIds)} : {}),
    };
    thread.comments.push(reply);
    return this.clone(reply);
  }

  private findComment(thread: CommentThread, commentId: string): CommentReply | undefined {
    return thread.comments.find((comment) => comment.id === commentId);
  }

  async edit(commentId: string, bodyMd: string): Promise<void> {
    for (const thread of this.store.values()) {
      const comment = this.findComment(thread, commentId);
      if (comment) {
        comment.body_md = bodyMd;
        return;
      }
    }
    throw new Error(`unknown comment ${commentId}`);
  }

  async remove(commentId: string): Promise<void> {
    for (const thread of this.store.values()) {
      const at = thread.comments.findIndex((comment) => comment.id === commentId);
      if (at !== -1) {
        thread.comments.splice(at, 1);
        return;
      }
    }
    throw new Error(`unknown comment ${commentId}`);
  }

  async resolve(threadId: string): Promise<void> {
    const thread = this.store.get(threadId);
    if (!thread) throw new Error(`unknown thread ${threadId}`);
    thread.resolved = true;
  }

  async reopen(threadId: string): Promise<void> {
    const thread = this.store.get(threadId);
    if (!thread) throw new Error(`unknown thread ${threadId}`);
    thread.resolved = false;
  }

  async updateAnchor(threadId: string, anchor: PageAnchor): Promise<void> {
    const thread = this.store.get(threadId);
    if (!thread) throw new Error(`unknown thread ${threadId}`);
    thread.anchor = this.clone(anchor);
  }

  /* ---------------- realtime (simulated) ---------------- */

  /**
   * No-socket stand-in for demos/tests: registers a listener scoped to one
   * pageKey. `emitRealtime` below drives the exact merge path the live
   * phoenix transport uses, without a server.
   */
  connectRealtime(pageKey: string, onEvent: (event: RealtimeEvent) => void): RealtimeConnection {
    const client = {pageKey, onEvent};
    this.realtimeClients.add(client);
    return {
      rejoin: (key: string) => {
        client.pageKey = key;
      },
      disconnect: () => {
        this.realtimeClients.delete(client);
      },
    };
  }

  /** Deliver one simulated realtime event to clients watching its page. */
  emitRealtime(event: RealtimeEvent): void {
    const pageKey = this.eventPageKey(event);
    if (pageKey === null) return;
    for (const client of [...this.realtimeClients]) {
      if (client.pageKey === pageKey) client.onEvent(event);
    }
  }

  private eventPageKey(event: RealtimeEvent): string | null {
    if (event.type === "thread_created") return event.thread.page_key ?? null;
    return this.store.get(event.threadId)?.page_key ?? null;
  }
}
