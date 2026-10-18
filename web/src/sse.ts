/**
 * Minimal SSE frame parser.
 *
 * `EventSource` cannot be used: the turn endpoint is a POST with a JSON body
 * and a bearer header, so the stream is read off `fetch().body` instead.
 * This module is framework-free and separately testable.
 */

export interface SseFrame {
  event: string;
  data: string;
  id?: string;
}

/**
 * Feed decoded text in, get complete frames out. Holds a partial tail between
 * calls, so chunk boundaries never split a frame.
 */
export class SseParser {
  #buffer = "";

  push(chunk: string): SseFrame[] {
    this.#buffer += chunk.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const frames: SseFrame[] = [];
    let idx: number;
    while ((idx = this.#buffer.indexOf("\n\n")) !== -1) {
      const raw = this.#buffer.slice(0, idx);
      this.#buffer = this.#buffer.slice(idx + 2);
      const frame = parseFrame(raw);
      if (frame) frames.push(frame);
    }
    return frames;
  }

  /** Flush a trailing frame that arrived without a final blank line. */
  flush(): SseFrame[] {
    const raw = this.#buffer;
    this.#buffer = "";
    const frame = raw.trim() ? parseFrame(raw) : null;
    return frame ? [frame] : [];
  }
}

function parseFrame(raw: string): SseFrame | null {
  let event = "message";
  let id: string | undefined;
  const dataLines: string[] = [];
  let sawField = false;

  for (const line of raw.split("\n")) {
    if (!line || line.startsWith(":")) continue; // blank or comment/heartbeat
    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? "" : line.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);

    switch (field) {
      case "event":
        event = value;
        sawField = true;
        break;
      case "data":
        dataLines.push(value);
        sawField = true;
        break;
      case "id":
        id = value;
        sawField = true;
        break;
      default:
        break; // `retry:` and unknown fields are not our concern
    }
  }

  if (!sawField) return null;
  return id === undefined
    ? { event, data: dataLines.join("\n") }
    : { event, data: dataLines.join("\n"), id };
}

/** Read a `fetch` body stream, emitting frames as they complete. */
export async function readSseStream(
  body: ReadableStream<Uint8Array>,
  onFrame: (frame: SseFrame) => void,
  signal?: AbortSignal,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const parser = new SseParser();

  const abort = () => void reader.cancel().catch(() => undefined);
  signal?.addEventListener("abort", abort, { once: true });

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const frame of parser.push(decoder.decode(value, { stream: true }))) {
        onFrame(frame);
      }
    }
    for (const frame of parser.flush()) onFrame(frame);
  } finally {
    signal?.removeEventListener("abort", abort);
    reader.releaseLock?.();
  }
}
