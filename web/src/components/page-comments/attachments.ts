/**
 * Attachment upload state for `<noizu-page-comments>` — pure logic, no Lit,
 * no network. The composer owns a `PendingUploads` store; the controller
 * drives each item through presign → upload → complete and mirrors the view
 * state down to the rail. Error copy classifies the two contract failures
 * hosts see in practice (size cap → 413, type/binding rules → 422).
 */

import type {AttachmentKind} from "./data-source.js";

/** Content types the annotate service accepts (`docs/API.md` allowlist). */
export const ACCEPTED_TYPES: readonly string[] = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
];

/** `accept` attribute for the composer's file picker. */
export const ATTACH_ACCEPT = ACCEPTED_TYPES.join(",");

export function isAcceptedType(type: string): boolean {
  return ACCEPTED_TYPES.includes(type);
}

export function kindForFile(file: {type: string}): AttachmentKind {
  return file.type.startsWith("image/") ? "image" : "file";
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export type PendingState = "uploading" | "ready" | "error";

export interface PendingAttachmentView {
  localId: string;
  name: string;
  kind: AttachmentKind;
  bytes: number;
  state: PendingState;
  /** 0..100 while uploading. */
  progress: number;
  error?: string;
  attachmentId?: string;
  /** Object URL for image/screenshot previews (revoked on remove/clear). */
  previewUrl?: string;
}

/** Human copy for a failed upload; `status` is the HTTP status when known. */
export function uploadError(status: number | undefined): string {
  if (status === 413) return "File is too large for this site's upload limit.";
  if (status === 422) return "File type is not allowed here.";
  if (status === 403) return "Upload is no longer valid — remove and re-attach.";
  return "Upload failed. Remove and try again.";
}

let localCounter = 0;

/**
 * Ordered pending-upload store. One instance per composer (plus one per
 * reply box that hosts edited screenshots); views are cloned on read so Lit
 * property assignment always sees a new array.
 */
export class PendingUploads {
  private items = new Map<string, PendingAttachmentView>();
  private order: string[] = [];

  /** Add a blob under a local id; kind derives from its MIME type. */
  add(blob: Blob, name: string, kind?: AttachmentKind): string {
    localCounter += 1;
    const localId = `pending-${Date.now().toString(36)}-${localCounter}`;
    const resolvedKind = kind ?? kindForFile(blob);
    this.items.set(localId, {
      localId,
      name,
      kind: resolvedKind,
      bytes: blob.size,
      state: "uploading",
      progress: 0,
    });
    this.order.push(localId);
    return localId;
  }

  /** Attach an image/screenshot preview URL (caller owns revocation otherwise). */
  setPreview(localId: string, previewUrl: string): void {
    const item = this.items.get(localId);
    if (item) {
      this.#revokePreview(item);
      item.previewUrl = previewUrl;
    }
  }

  #revokePreview(item: PendingAttachmentView): void {
    if (item.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(item.previewUrl);
  }

  progress(localId: string, loaded: number, total: number): void {
    const item = this.items.get(localId);
    if (!item || item.state !== "uploading") return;
    item.progress = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0;
  }

  ready(localId: string, attachmentId: string): void {
    const item = this.items.get(localId);
    if (!item) return;
    item.state = "ready";
    item.progress = 100;
    item.attachmentId = attachmentId;
    delete item.error;
  }

  fail(localId: string, status?: number): void {
    const item = this.items.get(localId);
    if (!item) return;
    item.state = "error";
    item.error = uploadError(status);
  }

  /** Drop one item; returns its preview URL so the caller can revoke it. */
  remove(localId: string): string | undefined {
    const item = this.items.get(localId);
    if (!item) return undefined;
    const previewUrl = item.previewUrl;
    this.items.delete(localId);
    this.order = this.order.filter((id) => id !== localId);
    return previewUrl;
  }

  /** Remove every item; returns revoked preview URLs. */
  clear(): string[] {
    const revoked = this.order.map((id) => this.items.get(id)?.previewUrl).filter((url): url is string => Boolean(url));
    this.items.clear();
    this.order = [];
    return revoked;
  }

  list(): PendingAttachmentView[] {
    return this.order.map((id) => ({...this.items.get(id)!}));
  }

  get(localId: string): PendingAttachmentView | undefined {
    const item = this.items.get(localId);
    return item ? {...item} : undefined;
  }

  get size(): number {
    return this.order.length;
  }

  /** True while anything is in flight or failed — the send button waits. */
  hasBlocking(): boolean {
    return [...this.items.values()].some((item) => item.state !== "ready");
  }

  readyIds(): string[] {
    return this.order.map((id) => this.items.get(id)!).filter((item) => item.state === "ready" && item.attachmentId).map((item) => item.attachmentId!);
  }
}

/** Natural dimensions of an image blob, or null when it cannot be decoded. */
export function imageSize(file: Blob): Promise<{width: number; height: number} | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve({width: image.naturalWidth, height: image.naturalHeight});
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    image.src = url;
  });
}
