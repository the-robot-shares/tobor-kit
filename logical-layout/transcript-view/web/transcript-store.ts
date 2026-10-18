/**
 * Pluggable transcript stores, matching `transcript.store` in the projection.
 *
 * `memory` and `local` live entirely in the browser. `backend` reads
 * `GET /sessions/{id}/transcript`, which answers 501 for the other two — a
 * state the UI must show as "not server-backed", never as an empty list.
 */

import type { ToborKitClient } from "../../client.js";
import type { Turn } from "../../types.js";

export type TranscriptLoad =
  | { status: "ok"; turns: Turn[]; has_more: boolean }
  /** The configured store is client-side; the server has nothing to give. */
  | { status: "not_server_backed" };

export interface TranscriptStore {
  readonly kind: "memory" | "local" | "backend";
  /** True when `append` is meaningful (client-side stores). */
  readonly writable: boolean;
  load(): Promise<TranscriptLoad>;
  append(turn: Turn): Promise<void>;
  clear(): Promise<void>;
}

export function createMemoryStore(retain = 0): TranscriptStore {
  let turns: Turn[] = [];
  return {
    kind: "memory",
    writable: true,
    async load() {
      return { status: "ok", turns: [...turns], has_more: false };
    },
    async append(turn) {
      turns = trim([...turns, turn], retain);
    },
    async clear() {
      turns = [];
    },
  };
}

export function createLocalStore(key: string, retain = 0, storage?: Storage): TranscriptStore {
  const store = () => storage ?? globalThis.localStorage;
  const read = (): Turn[] => {
    try {
      const raw = store()?.getItem(key);
      const parsed = raw ? (JSON.parse(raw) as unknown) : null;
      return Array.isArray(parsed) ? (parsed as Turn[]) : [];
    } catch {
      return [];
    }
  };
  const write = (turns: Turn[]) => {
    try {
      store()?.setItem(key, JSON.stringify(turns));
    } catch {
      /* quota or a storage-denied context; the transcript is best-effort here */
    }
  };
  return {
    kind: "local",
    writable: true,
    async load() {
      return { status: "ok", turns: read(), has_more: false };
    },
    async append(turn) {
      write(trim([...read(), turn], retain));
    },
    async clear() {
      try {
        store()?.removeItem(key);
      } catch {
        /* ignore */
      }
    },
  };
}

export function createBackendStore(client: ToborKitClient, sessionId: string, limit?: number): TranscriptStore {
  return {
    kind: "backend",
    writable: false,
    async load() {
      const result = await client.getTranscript(
        sessionId,
        limit == null ? {} : { limit },
      );
      if (!result.supported) return { status: "not_server_backed" };
      return { status: "ok", turns: result.turns, has_more: result.has_more };
    },
    async append() {
      // The server records turns itself; a client append would be a lie.
    },
    async clear() {
      await client.deleteTranscript(sessionId);
    },
  };
}

/** Build the store named by `transcript.store` in the guide projection. */
export function storeForGuide(options: {
  store?: "memory" | "local" | "backend";
  retain_turns?: number;
  client?: ToborKitClient;
  sessionId?: string;
  slug?: string;
}): TranscriptStore {
  const retain = options.retain_turns ?? 0;
  switch (options.store) {
    case "backend":
      if (options.client && options.sessionId) {
        return createBackendStore(options.client, options.sessionId, retain || undefined);
      }
      return createMemoryStore(retain);
    case "local":
      return createLocalStore(`tobor-kit:transcript:${options.slug ?? "default"}`, retain);
    default:
      return createMemoryStore(retain);
  }
}

function trim(turns: Turn[], retain: number): Turn[] {
  return retain > 0 && turns.length > retain ? turns.slice(turns.length - retain) : turns;
}
