import { expect, fixture, html, oneEvent } from "@open-wc/testing";
import "../../chat-thread.js";
import { ToborChatThread } from "../../chat-thread.js";
import { ToborTranscriptView } from "../../../transcript-view/transcript-view.js";
import type { Turn } from "../../../../types.js";

const TURNS: Turn[] = [
  { id: "t1", role: "user", content: "Is the branch green?", created_at: "2026-01-01T00:00:00Z" },
  { id: "t2", role: "assistant", content: "Branch is green. Push to main.", created_at: "2026-01-01T00:00:05Z" },
];

async function innerView(el: ToborChatThread): Promise<ToborTranscriptView> {
  await el.updateComplete;
  const view = el.shadowRoot!.querySelector("tobor-transcript-view") as ToborTranscriptView | null;
  expect(view).to.exist;
  await view!.updateComplete;
  return view!;
}

describe("tobor-chat-thread", () => {
  it("renders composed transcript-view", async () => {
    const el = await fixture<ToborChatThread>(
      html`<tobor-chat-thread .turns=${TURNS}></tobor-chat-thread>`,
    );
    expect(el.shadowRoot!.querySelector('[data-cy="thread.root"]')).to.exist;
    const view = await innerView(el);
    expect(view).to.be.instanceOf(ToborTranscriptView);
    const turns = view.shadowRoot!.querySelectorAll(".turn");
    expect(turns).to.have.lengthOf(2);
    expect(view.shadowRoot!.textContent).to.include("Branch is green.");
    expect(el.shadowRoot!.querySelector('[data-cy="thread.composer"]')).to.not.exist;
  });

  it("send emits thread-send when composer on", async () => {
    const el = await fixture<ToborChatThread>(
      html`<tobor-chat-thread show-composer></tobor-chat-thread>`,
    );
    await el.updateComplete;
    const composer = el.shadowRoot!.querySelector('[data-cy="thread.composer"]') as HTMLTextAreaElement;
    const send = el.shadowRoot!.querySelector('[data-cy="thread.send"]') as HTMLButtonElement;
    expect(composer).to.exist;
    expect(send).to.exist;
    composer.value = "hello thread";
    composer.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    const pending = oneEvent(el, "thread-send");
    send.click();
    const ev = (await pending) as CustomEvent<{ text: string }>;
    expect(ev.detail.text).to.equal("hello thread");
  });

  it("maps messages with participant and timestamp into the inner view", async () => {
    const el = await fixture<ToborChatThread>(
      html`<tobor-chat-thread
        .messages=${[
          {
            id: "m1",
            role: "user",
            text: "Hello **world**",
            at: "2026-01-01T00:00:00Z",
            participant: "alice",
          },
        ]}
        .participants=${[{ id: "alice", name: "Alice" }]}
      ></tobor-chat-thread>`,
    );
    const view = await innerView(el);
    const text = view.shadowRoot!.textContent ?? "";
    expect(text).to.include("Alice");
    expect(text).to.include("Hello **world**");
    expect(text).to.include("2026-01-01 00:00 UTC");
    expect(el.shadowRoot!.textContent).to.include("Alice");
  });

  it("forwards pending to the inner transcript-view", async () => {
    const el = await fixture<ToborChatThread>(
      html`<tobor-chat-thread pending="working on it…"></tobor-chat-thread>`,
    );
    const view = await innerView(el);
    expect(view.shadowRoot!.querySelector('[data-testid="pending-turn"]')).to.exist;
    expect(view.shadowRoot!.textContent).to.include("working on it…");
  });

  it("does not emit thread-send for blank composer input", async () => {
    const el = await fixture<ToborChatThread>(
      html`<tobor-chat-thread show-composer></tobor-chat-thread>`,
    );
    await el.updateComplete;
    let fired = false;
    el.addEventListener("thread-send", () => {
      fired = true;
    });
    const send = el.shadowRoot!.querySelector('[data-cy="thread.send"]') as HTMLButtonElement;
    send.click();
    await el.updateComplete;
    expect(fired).to.equal(false);
  });
});
