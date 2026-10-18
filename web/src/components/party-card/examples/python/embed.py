"""Host snippet: serve a page that mounts <tobor-agent-card> and <tobor-user-card>.

No party API. Run: `uvicorn embed:app --port 8080`
Host-owned: projection + routing. Never put secrets on the element.
"""

from fastapi import FastAPI
from fastapi.responses import HTMLResponse

PAGE = """<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <title>tobor-agent-card / tobor-user-card</title>
    <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/robot-avatar/robot-avatar.js"></script>
    <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/party-card/agent-card.js"></script>
    <script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/party-card/user-card.js"></script>
    <style>
      body { font-family: system-ui, sans-serif; max-width: 40rem; margin: 2rem auto; padding: 0 1rem; background: #12131a; color: #e8e9f0; display: grid; gap: 12px; }
    </style>
  </head>
  <body>
    <h1>Party cards</h1>
    <tobor-agent-card display-name="Nova" handle="@nova" presence="online" agent-id="nova" model-badge="gpt-4o">
      <tobor-robot-avatar slot="avatar" state="idle" label="Nova"></tobor-robot-avatar>
    </tobor-agent-card>
    <tobor-user-card display-name="Keith" handle="@keith" presence="away" user-id="keith" role="Owner" org="Noizu"></tobor-user-card>
    <pre id="log"></pre>
    <script type="module">
      const agent = document.querySelector('tobor-agent-card');
      const user = document.querySelector('tobor-user-card');
      const log = document.querySelector('#log');
      agent.capabilities = ['voice', 'tools', 'mcp'];
      agent.addEventListener('agent-chat', (event) => {
        log.textContent = 'agent-chat ' + JSON.stringify(event.detail);
      });
      user.addEventListener('user-profile', (event) => {
        log.textContent = 'user-profile ' + JSON.stringify(event.detail);
      });
    </script>
  </body>
</html>
"""

app = FastAPI()


@app.get("/", response_class=HTMLResponse)
def party_card_page() -> str:
    return PAGE
