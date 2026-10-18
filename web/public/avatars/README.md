# Voice agent avatar collection

Orbit (cream), Pip (yellow), and Nova (lilac) were generated with Google Nano Banana 2 (`gemini-3.1-flash-image`) using the adjacent reproducible schema 0.4 prompts. These are opaque dark navy images, not transparent SVGs.

Each `states.png` is 1280 × 640 pixels: four columns, two rows, eight 320-pixel square cells. Row-major order: idle, listening, thinking, speaking, tool_running, error, offline, celebrating. The voice agent uses the first seven canonical states. `groups.json` describes the asset coordinates; its URLs are relative to the distribution root.

Generation: `generate-media-prompt --no-prep --no-eval --service gemini --model gemini-3.1-flash-image <name>/states.media.prompt`. The evaluator was disabled to avoid provider fallback; all 24 generated cells and all final sheets were visually reviewed against the prompt criteria. Generated originals are retained as `states.raw.png` for provenance. The model emitted a 1376 × 768 sheet and added captions/grid lines to some cells. Deterministic cropping removes these while retaining the full mascot and expression: each original cell is 344 × 384, crop a 320 × 320 square at x=12 within each cell; y=0 for Orbit/Pip and y=32 for Nova. Reassemble cropped cells at their original 4 × 2 positions. No new artwork was synthesized during cropping.

Suggested motion: idle gentle breathing; listening subtle attentive pulse; thinking slow rocking; speaking gentle bounce; tool_running quicker alternating tilt; error brief shake; offline static dimming. Respect `prefers-reduced-motion`: use the correct state image without movement. The eighth celebration pose is available to custom hosts.
