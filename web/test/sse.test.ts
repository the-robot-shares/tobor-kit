import { expect } from "@open-wc/testing";
import { SseParser } from "../src/sse.js";
import { ToborKitClient } from "../src/client.js";

function sseResponse(frames: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const frame of frames) controller.enqueue(encoder.encode(frame));
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

/** Wrap frames in a fetch function (client expects `fetchImpl`, not a Response). */
function sseFetch(frames: string[]): typeof fetch {
  return (async () => sseResponse(frames)) as typeof fetch;
}

describe("SseParser", () => {
  it("parses event + data frames across chunk boundaries", () => {
    const parser = new SseParser();
    const first = parser.push('event: state\ndata: {"state":"thin');
    expect(first).to.deep.equal([]);
    const second = parser.push('king"}\n\n');
    expect(second).to.have.lengthOf(1);
    expect(second[0].event).to.equal("state");
    expect(second[0].data).to.equal('{"state":"thinking"}');
  });

  it("joins multi-line data fields with newlines", () => {
    const parser = new SseParser();
    const frames = parser.push("data: line1\ndata: line2\n\n");
    expect(frames[0].data).to.equal("line1\nline2");
  });

  it("defaults the event name to message and ignores comments", () => {
    const parser = new SseParser();
    const frames = parser.push(": heartbeat\ndata: hi\n\n");
    expect(frames[0].event).to.equal("message");
    expect(frames[0].data).to.equal("hi");
  });

  it("normalizes CRLF separators", () => {
    const parser = new SseParser();
    const frames = parser.push("event: delta\r\ndata: {\"text\":\"a\"}\r\n\r\n");
    expect(frames).to.have.lengthOf(1);
    expect(frames[0].event).to.equal("delta");
  });

  it("flushes a trailing frame without a final blank line", () => {
    const parser = new SseParser();
    parser.push("event: error\ndata: {\"code\":\"x\"}");
    const frames = parser.flush();
    expect(frames).to.have.lengthOf(1);
    expect(frames[0].event).to.equal("error");
  });
});

describe("streamTurn terminal semantics", () => {
  it("terminates on message and passes the turn through", async () => {
    const calls: string[] = [];
    const fetchImpl = (async () => {
      calls.push("turn");
      return sseResponse([
        'event: state\ndata: {"state":"thinking"}\n\n',
        'event: delta\ndata: {"text":"Hel"}\n\n',
        'event: delta\ndata: {"text":"lo"}\n\n',
        'event: message\ndata: {"id":"t1","role":"assistant","content":"Hello","created_at":"2026-01-01T00:00:00Z"}\n\n',
      ]);
    }) as typeof fetch;
    const client = new ToborKitClient({ fetchImpl });

    const states: string[] = [];
    let text = "";
    let message: unknown = null;
    let error: unknown = "not-fired";
    await client.streamTurn("s1", { input: "hi" }, {
      onState: (s) => states.push(s),
      onDelta: (d) => (text += d),
      onMessage: (t) => (message = t),
      onError: (e) => (error = e),
    });

    expect(states).to.deep.equal(["thinking"]);
    expect(text).to.equal("Hello");
    expect(message).to.not.equal(null);
    expect(error).to.equal("not-fired");
  });

  it("terminates on error events", async () => {
    const client = new ToborKitClient({
      fetchImpl: sseFetch(['event: error\ndata: {"code":"overloaded","message":"try later"}\n\n']) as unknown as never,
    });
    let error: { code: string; message: string } | null = null;
    let message: unknown = "not-fired";
    await client.streamTurn("s1", { input: "hi" }, {
      onMessage: (m) => (message = m),
      onError: (e) => (error = e),
    });
    expect((error as { code: string } | null)?.code).to.equal("overloaded");
    expect(message).to.equal("not-fired");
  });

  it("synthesizes stream_incomplete when the stream closes without a terminal frame", async () => {
    const client = new ToborKitClient({
      fetchImpl: sseFetch(['event: state\ndata: {"state":"thinking"}\n\n']) as unknown as never,
    });
    let error: { code: string } | null = null;
    await client.streamTurn("s1", { input: "hi" }, { onError: (e) => (error = e) });
    expect((error as { code: string } | null)?.code).to.equal("stream_incomplete");
  });

  it("fires exactly one terminal callback when both shapes arrive", async () => {
    const client = new ToborKitClient({
      fetchImpl: sseFetch([
        'event: message\ndata: {"id":"t1","role":"assistant","content":"x","created_at":"z"}\n\n',
        'event: error\ndata: {"code":"late","message":"ignored"}\n\n',
      ]) as unknown as never,
    });
    const terminals: string[] = [];
    await client.streamTurn("s1", { input: "hi" }, {
      onMessage: () => terminals.push("message"),
      onError: () => terminals.push("error"),
    });
    expect(terminals).to.deep.equal(["message"]);
  });

  it("tolerates a tool_call frame with an empty id (contract resolution 5)", async () => {
    const client = new ToborKitClient({
      fetchImpl: sseFetch([
        'event: tool_call\ndata: {"id":"","name":"Github.BranchCreate"}\n\n',
        'event: message\ndata: {"id":"t1","role":"assistant","content":"done","created_at":"z"}\n\n',
      ]) as unknown as never,
    });
    const calls: { id: string; name: string }[] = [];
    await client.streamTurn("s1", { input: "hi" }, { onToolCall: (c) => calls.push(c) });
    expect(calls).to.deep.equal([{ id: "", name: "Github.BranchCreate" }]);
  });

  it("drives the canonical event order (state → delta → tool_call → tool_running → tool_result → speaking → message)", async () => {
    const client = new ToborKitClient({
      fetchImpl: sseFetch([
        'event: state\ndata: {"state":"thinking"}\n\n',
        'event: delta\ndata: {"text":"Checking…"}\n\n',
        'event: tool_call\ndata: {"id":"c1","name":"Github.BranchCreate"}\n\n',
        'event: state\ndata: {"state":"tool_running"}\n\n',
        'event: tool_result\ndata: {"id":"c1","ok":true,"summary":"green"}\n\n',
        'event: state\ndata: {"state":"speaking"}\n\n',
        'event: message\ndata: {"id":"t1","role":"assistant","content":"Branch is green.","created_at":"z"}\n\n',
      ]) as unknown as never,
    });
    const states: string[] = [];
    const results: { ok: boolean }[] = [];
    let message: unknown = null;
    let error: unknown = "not-fired";
    await client.streamTurn("s1", { input: "hi" }, {
      onState: (s) => states.push(s),
      onToolResult: (r) => results.push(r),
      onMessage: (m) => (message = m),
      onError: (e) => (error = e),
    });
    expect(states).to.deep.equal(["thinking", "tool_running", "speaking"]);
    expect(results).to.deep.equal([{ id: "c1", ok: true, summary: "green" }]);
    expect(message).to.not.equal(null);
    // No trailing idle frame: the stream ends ON the terminal event, and the
    // client fires no synthetic state after it.
    expect(error).to.equal("not-fired");
  });
});
