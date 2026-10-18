"""FastAPI host: serve a page that mounts <tobor-review-panel>.

GET/POST /artifacts/{id}/reviews and POST …/resolve are host-owned.
Never put a bearer secret on the element. Run: `uvicorn embed:app --port 8080`
"""

from datetime import datetime, timezone
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse
from pydantic import BaseModel

app = FastAPI()

PAGE = """<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <title>tobor-review-panel</title>
    <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/review-panel/review-panel.js"></script>
  </head>
  <body>
    <h1>Reviews</h1>
    <div class="demo-frame">
      <tobor-review-panel artifact-id="artifact-1"></tobor-review-panel>
    </div>
    <script type="module">
      const el = document.querySelector('tobor-review-panel');
      const artifactId = el.artifactId || 'artifact-1';
      async function load() {
        const res = await fetch('/artifacts/' + encodeURIComponent(artifactId) + '/reviews', {credentials: 'same-origin'});
        if (!res.ok) return;
        el.reviews = (await res.json()).reviews ?? [];
      }
      el.addEventListener('review-submit', (event) => {
        fetch('/artifacts/' + encodeURIComponent(event.detail.artifactId) + '/reviews', {
          method: 'POST', headers: {'content-type': 'application/json'}, credentials: 'same-origin',
          body: JSON.stringify({body: event.detail.body}),
        }).then((res) => { if (res.ok) return load(); });
      });
      el.addEventListener('review-resolve', (event) => {
        fetch('/artifacts/' + encodeURIComponent(artifactId) + '/reviews/' + encodeURIComponent(event.detail.id) + '/resolve', {
          method: 'POST', credentials: 'same-origin',
        }).then((res) => { if (res.ok) return load(); });
      });
      load();
    </script>
  </body>
</html>
"""

REVIEWS: dict[str, list[dict]] = {
    "artifact-1": [
        {"id": "r1", "author": "Ada", "body": "Looks good", "at": "2026-01-01T00:00:00Z", "status": "open"}
    ]
}


class CreateBody(BaseModel):
    body: str


@app.get("/", response_class=HTMLResponse)
async def index() -> str:
    return PAGE


@app.get("/artifacts/{artifact_id}/reviews")
async def list_reviews(artifact_id: str) -> JSONResponse:
    return JSONResponse({"reviews": REVIEWS.get(artifact_id, [])})


@app.post("/artifacts/{artifact_id}/reviews")
async def create_review(artifact_id: str, payload: CreateBody) -> JSONResponse:
    row = {
        "id": f"r-{uuid4().hex[:8]}",
        "author": "you",
        "body": payload.body,
        "at": datetime.now(timezone.utc).isoformat(),
        "status": "open",
    }
    REVIEWS.setdefault(artifact_id, []).append(row)
    return JSONResponse(row, status_code=201)


@app.post("/artifacts/{artifact_id}/reviews/{review_id}/resolve")
async def resolve_review(artifact_id: str, review_id: str) -> JSONResponse:
    for row in REVIEWS.get(artifact_id, []):
        if row["id"] == review_id:
            row["status"] = "resolved"
            return JSONResponse({"id": review_id, "status": "resolved"})
    raise HTTPException(status_code=404, detail="not found")
