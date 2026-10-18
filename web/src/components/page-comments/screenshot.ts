/**
 * Screenshot capture for `<noizu-page-comments>`. Two paths:
 *
 * - `capturePageDocument()` — DOM rasterization via `@zumer/snapdom`, with
 *   the widget's own layers excluded so the rail/overlay never appear in the
 *   picture. Snapdom may throw (or hand back a tainted canvas) on hostile
 *   pages; callers surface the "Screen capture" fallback.
 * - `captureScreenFrame()` — one frame from `getDisplayMedia`, tracks stopped
 *   immediately after the grab.
 */

export const WIDGET_EXCLUDE: readonly string[] = [
  "noizu-page-comments",
  "noizu-page-comments-rail",
  "noizu-page-comments-overlay",
  "noizu-page-comments-lightbox",
  "noizu-page-comments-snip",
  "[data-pc-owned]",
];

/** Rasterize the full document at scale 1 with the widget's layers removed. */
export async function capturePageDocument(): Promise<HTMLCanvasElement> {
  const {snapdom} = await import("@zumer/snapdom");
  const shot = await snapdom(document.documentElement, {
    scale: 1,
    exclude: [...WIDGET_EXCLUDE],
    excludeMode: "remove",
  });
  return shot.toCanvas();
}

/** One video frame from a screen share. The stream is NOT stopped here. */
export function frameFromStream(stream: MediaStream): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    const fail = (reason: unknown) => {
      video.srcObject = null;
      reject(reason instanceof Error ? reason : new Error("screen capture failed"));
    };
    const grab = () => {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        fail(new Error("canvas unavailable"));
        return;
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      video.pause();
      video.srcObject = null;
      resolve(canvas);
    };
    video.onloadedmetadata = () => {
      video.play().then(grab).catch(fail);
    };
    video.onerror = () => fail(new Error("screen capture stream failed"));
    video.srcObject = stream;
  });
}

/** Prompt for a screen/window share and grab a single frame from it. */
export async function captureScreenFrame(): Promise<HTMLCanvasElement> {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    throw new Error("Screen capture is not supported in this browser");
  }
  const stream = await navigator.mediaDevices.getDisplayMedia({video: true});
  try {
    return await frameFromStream(stream);
  } finally {
    for (const track of stream.getTracks()) track.stop();
  }
}

/** Flattened PNG export; rejects on a tainted canvas. */
export function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("PNG export failed"));
    }, "image/png");
  });
}

/** Decode an attachment url into a full-size canvas (for annotation re-edit). */
export function imageUrlToCanvas(url: string): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    // CORS first so the canvas stays exportable; a server without ACAO falls
    // back to a plain (possibly tainted) load — export failures surface later.
    image.crossOrigin = "anonymous";
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("canvas unavailable"));
        return;
      }
      ctx.drawImage(image, 0, 0);
      resolve(canvas);
    };
    image.onerror = () => {
      if (image.crossOrigin) {
        // Retry without CORS: better a tainted canvas than no editor at all.
        image.crossOrigin = null;
        image.src = url;
        return;
      }
      reject(new Error("image decode failed"));
    };
    image.src = url;
  });
}
