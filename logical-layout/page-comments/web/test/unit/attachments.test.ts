import {assert} from "@open-wc/testing";

import {PendingUploads, formatBytes, isAcceptedType, kindForFile, uploadError} from "../../attachments.js";

describe("attachment helpers", () => {
  it("accepts exactly the service allowlist", () => {
    for (const type of ["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf", "text/plain"]) {
      assert.equal(isAcceptedType(type), true, type);
    }
    for (const type of ["image/svg+xml", "application/zip", "text/html", ""]) {
      assert.equal(isAcceptedType(type), false, type);
    }
  });

  it("derives kind from the MIME type", () => {
    assert.equal(kindForFile({type: "image/png"}), "image");
    assert.equal(kindForFile({type: "application/pdf"}), "file");
    assert.equal(kindForFile({type: "text/plain"}), "file");
    assert.equal(kindForFile({type: "application/octet-stream"}), "file");
  });

  it("formats byte sizes for humans", () => {
    assert.equal(formatBytes(0), "0 B");
    assert.equal(formatBytes(512), "512 B");
    assert.equal(formatBytes(2048), "2 KB");
    assert.equal(formatBytes(5 * 1024 * 1024), "5.0 MB");
  });

  it("maps failure statuses to specific copy", () => {
    assert.match(uploadError(413), /large/i);
    assert.match(uploadError(422), /not allowed/i);
    assert.match(uploadError(403), /no longer valid/i);
    assert.match(uploadError(undefined), /failed/i);
  });
});

describe("PendingUploads", () => {
  it("tracks the upload lifecycle per local id", () => {
    const store = new PendingUploads();
    const blob = new Blob(["x"], {type: "image/png"});
    const id = store.add(blob, "a.png");
    assert.equal(store.size, 1);
    assert.equal(store.get(id)?.state, "uploading");
    assert.equal(store.hasBlocking(), true);

    store.progress(id, 50, 100);
    assert.equal(store.get(id)?.progress, 50);

    store.ready(id, "att-1");
    const view = store.get(id);
    assert.equal(view?.state, "ready");
    assert.equal(view?.progress, 100);
    assert.equal(view?.attachmentId, "att-1");
    assert.equal(store.hasBlocking(), false);
    assert.deepEqual(store.readyIds(), ["att-1"]);
  });

  it("ignores progress after an upload settles", () => {
    const store = new PendingUploads();
    const id = store.add(new Blob(["x"], {type: "text/plain"}), "a.txt");
    store.ready(id, "att-1");
    store.progress(id, 1, 100);
    assert.equal(store.get(id)?.progress, 100);
  });

  it("records failures with status copy and keeps send blocked", () => {
    const store = new PendingUploads();
    const id = store.add(new Blob(["x"], {type: "image/png"}), "a.png");
    store.fail(id, 413);
    const view = store.get(id);
    assert.equal(view?.state, "error");
    assert.match(view?.error ?? "", /large/i);
    assert.equal(store.hasBlocking(), true);
    assert.deepEqual(store.readyIds(), []);
  });

  it("remove drops one item and returns its preview URL", () => {
    const store = new PendingUploads();
    const id = store.add(new Blob(["x"], {type: "image/png"}), "a.png");
    store.setPreview(id, "blob:preview-1");
    assert.deepEqual(store.remove(id), "blob:preview-1");
    assert.equal(store.size, 0);
    assert.deepEqual(store.remove(id), undefined);
  });

  it("clear drops everything and reports revoked previews", () => {
    const store = new PendingUploads();
    const a = store.add(new Blob(["x"], {type: "image/png"}), "a.png");
    const b = store.add(new Blob(["y"], {type: "application/pdf"}), "b.pdf");
    store.setPreview(a, "blob:preview-a");
    const revoked = store.clear();
    assert.deepEqual(revoked, ["blob:preview-a"]);
    assert.equal(store.size, 0);
    assert.equal(store.get(a), undefined);
    assert.equal(store.get(b), undefined);
  });

  it("list returns detached clones (mutation-safe)", () => {
    const store = new PendingUploads();
    const id = store.add(new Blob(["x"], {type: "image/png"}), "a.png");
    const listed = store.list();
    listed[0].name = "mutated";
    assert.equal(store.get(id)?.name, "a.png");
  });
});
