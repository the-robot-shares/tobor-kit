"""FastAPI host for <noizu-page-comments>.

Serves the annotatable page and a minimal read-side stub of the annotate
contract for local development. The production annotate service is a separate
tree — see docs/backend-requirements.md.
"""
from fastapi import FastAPI
from fastapi.responses import HTMLResponse, JSONResponse

app = FastAPI()

PAGE = """<!doctype html>
<html><head><meta charset="utf-8"><title>page-comments host</title>
<script type="module">
import "https://cdn.derobot.is/tobor-kit/latest/components/page-comments/page-comments.js";
</script></head>
<body>
<h1>Annotatable page</h1>
<p id="intro">Enable comments (launcher or Alt+C), then click to anchor.</p>
<noizu-page-comments site="demo-site" api-base="http://127.0.0.1:8000"></noizu-page-comments>
</body></html>"""


@app.get("/", response_class=HTMLResponse)
def index() -> str:
    return PAGE


@app.get("/api/v1/sites/{site}/threads")
def threads(site: str, page_key: str = "") -> JSONResponse:
    # Dev stub: empty list per page_key. Real storage lives in the annotate service.
    return JSONResponse({"threads": [], "site": site, "page_key": page_key})
