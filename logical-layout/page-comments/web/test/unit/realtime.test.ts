import {expect} from "@open-wc/testing";
import type {CommentReply, CommentThread} from "../../data-source.js";
import {MemoryDataSource} from "../../data-source.js";
import {
  mergeRealtimeEvent,
  OwnWriteRegistry,
  pageTopic,
  parseRealtimeEvent,
  sha256Hex,
  PARITY_VECTOR,
  PARITY_VECTOR_SHA256,
  type RealtimeEvent,
} from "../../realtime.js";

const anchor = {
  css: "#a",
  xpath: "/html[1]/body[1]/div[1]",
  textQuote: {prefix: "", exact: "hello", suffix: ""},
  fingerprint: {tag: "div", textHash: "abc", relPos: 0},
};

function thread(overrides: Partial<CommentThread> = {}): CommentThread {
  return {
    id: "t1",
    page_key: "/page",
    url: "https://x.test/page",
    anchor,
    body_md: "root body",
    resolved: false,
    comments: [],
    ...overrides,
  };
}

function comment(overrides: Partial<CommentReply> = {}): CommentReply {
  return {id: "c1", thread_id: "t1", body_md: "reply body", ...overrides};
}

describe("realtime topic hashing", () => {
  it("matches the backend parity vector (SHA-256, lowercase hex)", async () => {
    expect(PARITY_VECTOR).to.equal("phase5-parity-vector");
    expect(await sha256Hex(PARITY_VECTOR)).to.equal(PARITY_VECTOR_SHA256);
    expect(PARITY_VECTOR_SHA256).to.equal("63b1124d51c9c48fe33623ab2755b4959deaf5bdb2d4426a002c24ddb52b17f5");
  });

  it("hashes other inputs to the same digest shape", async () => {
    const hex = await sha256Hex("https://x.test/page");
    expect(hex).to.match(/^[0-9a-f]{64}$/);
    expect(hex).to.not.equal(await sha256Hex("https://x.test/other"));
  });

  it("builds page:<site_slug>:<sha256hex(page_key)> topics", async () => {
    expect(await pageTopic("demo-site", PARITY_VECTOR)).to.equal(
      `page:demo-site:${PARITY_VECTOR_SHA256}`,
    );
  });
});

describe("parseRealtimeEvent", () => {
  it("parses {thread} envelopes for thread_created", () => {
    const event = parseRealtimeEvent("thread_created", {thread: thread()});
    expect(event).to.deep.equal({type: "thread_created", thread: thread()});
  });

  it("accepts flat comment payloads and thread sibling keys", () => {
    const event = parseRealtimeEvent("comment_created", {
      thread_id: "t1",
      comment: {id: "c9", thread_id: "t1", body_md: "hi"},
    });
    expect(event).to.deep.equal({type: "comment_created", threadId: "t1", comment: {id: "c9", thread_id: "t1", body_md: "hi"}});
  });

  it("parses comment_deleted from {comment_id} and thread_anchor_updated from {anchor}", () => {
    expect(parseRealtimeEvent("comment_deleted", {thread_id: "t1", comment_id: "c9"})).to.deep.equal({
      type: "comment_deleted",
      threadId: "t1",
      commentId: "c9",
    });
    expect(parseRealtimeEvent("thread_anchor_updated", {thread_id: "t1", anchor})).to.deep.equal({
      type: "thread_anchor_updated",
      threadId: "t1",
      anchor,
    });
  });

  it("drops malformed payloads instead of throwing", () => {
    expect(parseRealtimeEvent("thread_created", {nope: true})).to.equal(null);
    expect(parseRealtimeEvent("thread_resolved", {})).to.equal(null);
    expect(parseRealtimeEvent("comment_created", "junk")).to.equal(null);
  });
});

describe("mergeRealtimeEvent", () => {
  it("appends a new thread from thread_created", () => {
    const other = thread({id: "t0"});
    const result = mergeRealtimeEvent([other], {type: "thread_created", thread: thread()});
    expect(result?.threads.map((t) => t.id)).to.deep.equal(["t0", "t1"]);
    expect(result?.threadId).to.equal("t1");
    expect(result?.changed).to.equal(true);
  });

  it("is idempotent: replaying the same event changes nothing", () => {
    const once = mergeRealtimeEvent([], {type: "thread_created", thread: thread()})!;
    const twice = mergeRealtimeEvent(once.threads, {type: "thread_created", thread: thread()})!;
    expect(twice.changed).to.equal(false);
    expect(twice.threads).to.equal(once.threads); // same reference, no churn
    expect(twice.threads).to.have.lengthOf(1);
  });

  it("upserts thread_created content over an existing id", () => {
    const base = [thread()];
    const updated = thread({body_md: "edited by another user"});
    const result = mergeRealtimeEvent(base, {type: "thread_created", thread: updated})!;
    expect(result.threads).to.have.lengthOf(1);
    expect(result.threads[0].body_md).to.equal("edited by another user");
    expect(result.changed).to.equal(true);
  });

  it("appends comment_created to the right thread, idempotently", () => {
    const event: RealtimeEvent = {type: "comment_created", threadId: "t1", comment: comment()};
    const once = mergeRealtimeEvent([thread()], event)!;
    expect(once.threads[0].comments.map((c) => c.id)).to.deep.equal(["c1"]);
    expect(once.changed).to.equal(true);
    const twice = mergeRealtimeEvent(once.threads, event)!;
    expect(twice.changed).to.equal(false);
    expect(twice.threads[0].comments).to.have.lengthOf(1);
    expect(twice.threads).to.equal(once.threads);
  });

  it("replaces the old comment body on comment_updated", () => {
    const base = [thread({comments: [comment()]})];
    const result = mergeRealtimeEvent(base, {
      type: "comment_updated",
      threadId: "t1",
      comment: comment({body_md: "edited"}),
    })!;
    expect(result.threads[0].comments[0].body_md).to.equal("edited");
    expect(result.threads).to.have.lengthOf(1);
  });

  it("does not mutate the input list (pure merge)", () => {
    const base = [thread({comments: [comment()]})];
    mergeRealtimeEvent(base, {type: "comment_created", threadId: "t1", comment: comment({id: "c2"})});
    expect(base[0].comments).to.have.lengthOf(1);
  });

  it("removes the comment on comment_deleted; replay changes nothing", () => {
    const base = [thread({comments: [comment()]})];
    const event: RealtimeEvent = {type: "comment_deleted", threadId: "t1", commentId: "c1"};
    const once = mergeRealtimeEvent(base, event)!;
    expect(once.threads[0].comments).to.have.lengthOf(0);
    expect(once.threadId).to.equal("t1");
    const twice = mergeRealtimeEvent(once.threads, event)!;
    expect(twice.changed).to.equal(false);
    // Deleting an already-absent comment touches nothing.
    expect(twice.threadId).to.equal(null);
  });

  it("flags unknown threads instead of inventing state", () => {
    const result = mergeRealtimeEvent([thread()], {
      type: "comment_created",
      threadId: "t-unknown",
      comment: comment(),
    })!;
    expect(result.unknownThread).to.equal(true);
    expect(result.changed).to.equal(false);
    expect(result.threads).to.have.lengthOf(1);
  });

  it("sets/clears resolved on thread_resolved / thread_reopened, idempotently", () => {
    const resolved = mergeRealtimeEvent([thread()], {type: "thread_resolved", threadId: "t1"})!;
    expect(resolved.threads[0].resolved).to.equal(true);
    expect(resolved.changed).to.equal(true);
    const again = mergeRealtimeEvent(resolved.threads, {type: "thread_resolved", threadId: "t1"})!;
    expect(again.changed).to.equal(false);
    const reopened = mergeRealtimeEvent(resolved.threads, {type: "thread_reopened", threadId: "t1"})!;
    expect(reopened.threads[0].resolved).to.equal(false);
  });

  it("swaps the anchor on thread_anchor_updated and stays quiet on identical anchors", () => {
    const nextAnchor = {...anchor, css: "#moved"};
    const result = mergeRealtimeEvent([thread()], {type: "thread_anchor_updated", threadId: "t1", anchor: nextAnchor})!;
    expect(result.threads[0].anchor.css).to.equal("#moved");
    const replay = mergeRealtimeEvent(result.threads, {
      type: "thread_anchor_updated",
      threadId: "t1",
      anchor: nextAnchor,
    })!;
    expect(replay.changed).to.equal(false);
  });
});

describe("OwnWriteRegistry dedupe", () => {
  it("drops the echo of a recorded own write exactly once", () => {
    const own = new OwnWriteRegistry();
    own.record("c9");
    const event: RealtimeEvent = {type: "comment_created", threadId: "t1", comment: comment({id: "c9"})};
    expect(mergeRealtimeEvent([thread()], event, own)).to.equal(null);
    // The same id from another user later must merge normally.
    const later = mergeRealtimeEvent([thread()], event, own);
    expect(later?.changed).to.equal(true);
    expect(later?.threads[0].comments.map((c) => c.id)).to.deep.equal(["c9"]);
  });

  it("covers own thread writes too (thread_created echo)", () => {
    const own = new OwnWriteRegistry();
    own.record("t9");
    expect(mergeRealtimeEvent([], {type: "thread_created", thread: thread({id: "t9"})}, own)).to.equal(null);
  });

  it("expires stale records so a lost echo cannot swallow foreign writes", async () => {
    const own = new OwnWriteRegistry(5);
    own.record("c9");
    await new Promise((resolve) => setTimeout(resolve, 10));
    const event: RealtimeEvent = {type: "comment_created", threadId: "t1", comment: comment({id: "c9"})};
    expect(mergeRealtimeEvent([thread()], event, own)?.changed).to.equal(true);
  });
});

describe("MemoryDataSource simulated realtime", () => {
  it("delivers emitRealtime only to clients watching that page", async () => {
    const source = new MemoryDataSource([thread()]);
    const seen: string[] = [];
    const watching = source.connectRealtime("/page", (event) => seen.push(event.type));
    const otherPage = source.connectRealtime("/elsewhere", (event) => seen.push(`wrong:${event.type}`));
    source.emitRealtime({type: "comment_created", threadId: "t1", comment: comment()});
    expect(seen).to.deep.equal(["comment_created"]);
    otherPage.disconnect();
    source.emitRealtime({type: "thread_resolved", threadId: "t1"});
    expect(seen).to.deep.equal(["comment_created", "thread_resolved"]);
    watching.disconnect();
    source.emitRealtime({type: "thread_reopened", threadId: "t1"});
    expect(seen).to.deep.equal(["comment_created", "thread_resolved"]);
  });

  it("rejoin switches the client to another pageKey", async () => {
    const source = new MemoryDataSource([thread(), thread({id: "t2", page_key: "/two"})]);
    const seen: string[] = [];
    const client = source.connectRealtime("/page", (event) => seen.push(event.type));
    source.emitRealtime({type: "thread_resolved", threadId: "t2"}); // wrong page
    expect(seen).to.deep.equal([]);
    client.rejoin("/two");
    source.emitRealtime({type: "thread_resolved", threadId: "t2"});
    expect(seen).to.deep.equal(["thread_resolved"]);
    client.disconnect();
  });

  it("routes thread_created by its own page_key", () => {
    const source = new MemoryDataSource([]);
    const seen: string[] = [];
    source.connectRealtime("/page", (event) => seen.push(event.type));
    source.emitRealtime({type: "thread_created", thread: thread()});
    expect(seen).to.deep.equal(["thread_created"]);
  });
});
