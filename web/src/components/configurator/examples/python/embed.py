"""Serve a page that mounts <tobor-configurator> with an inline JSON schema.

No backend is required. Host-owned: insert {tag, attributes, slots} on
configurator-apply. Never put secrets on this island.
"""

from fastapi import FastAPI
from fastapi.responses import HTMLResponse

app = FastAPI()

PAGE = """<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>tobor-configurator</title>
    <script type="importmap">
      {
        "imports": {
          "lit": "https://cdn.derobot.is/tobor-kit/latest/vendor/lit.js",
          "lit/decorators.js": "https://cdn.derobot.is/tobor-kit/latest/vendor/lit-decorators.js"
        }
      }
    </script>
  </head>
  <body>
    <tobor-configurator id="cfg">
      <script type="application/json">
        {"tag":"demo-widget","group":"display","importPath":"demo-widget.js","demoHtml":"<demo-widget label=\\"Hello\\"></demo-widget>","backend":"none","fields":[{"attr":"label","type":"string","required":true,"default":"Hello"},{"attr":"enabled","type":"boolean","default":false},{"attr":"id","type":"string","uneditable":true,"default":"demo-1"}]}
      </script>
    </tobor-configurator>
    <pre id="log"></pre>
    <script type="module">
      import 'https://cdn.derobot.is/tobor-kit/latest/components/configurator/tobor-configurator.js';
      const el = document.querySelector('#cfg');
      el.addEventListener('configurator-apply', (event) => {
        document.querySelector('#log').textContent = JSON.stringify(event.detail);
      });
    </script>
  </body>
</html>
"""


@app.get("/", response_class=HTMLResponse)
def configurator() -> HTMLResponse:
    return HTMLResponse(PAGE)
