"""Host page + POST /voice/token proxy for <tobor-voice-session>.

Production Guide API: elixir/ (reference) and go/ (port). This file serves the
mount page and proxies POST /api/tobor-kit/voice/token. It does not mint
credentials. native → 409, none → 503, realtime/backend → 201.
"""

from __future__ import annotations

import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

CDN_CLIENT = "https://cdn.derobot.is/tobor-kit/latest/client.js"
CDN_EL = "https://cdn.derobot.is/tobor-kit/latest/components/voice-session/voice-session.js"
UPSTREAM = os.environ.get("TOBOR_KIT_UPSTREAM", "http://127.0.0.1:8080").rstrip("/")
PAGE = f"""<!doctype html>
<meta charset="utf-8"/>
<title>tobor-voice-session</title>
<tobor-voice-session id="voice"></tobor-voice-session>
<script type="module">
  import {{ToborKitClient}} from "{CDN_CLIENT}";
  import "{CDN_EL}";
  const el = document.getElementById("voice");
  el.client = new ToborKitClient({{baseUrl: "/api/tobor-kit"}});
  el.voice = {{adapter: "native", locale: "en-US"}};
</script>
"""


class Handler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        if self.path == "/":
            body = PAGE.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        self.send_error(501, "GET / or POST /api/tobor-kit/voice/token. Run elixir/ or go/.")

    def do_POST(self) -> None:
        if self.path.split("?", 1)[0] == "/api/tobor-kit/voice/token":
            self._proxy_token()
            return
        self.send_error(501, "Proxy POST /voice/token only.")

    def _proxy_token(self) -> None:
        url = f"{UPSTREAM}/api/tobor-kit/voice/token"
        length = int(self.headers.get("Content-Length") or 0)
        payload = self.rfile.read(length) if length else b""
        req = Request(url, data=payload or None, method="POST")
        req.add_header("Accept", "application/json")
        token = self.headers.get("Authorization")
        if token:
            req.add_header("Authorization", token)
        try:
            with urlopen(req, timeout=10) as resp:
                body = resp.read()
                self.send_response(resp.status)
                self.send_header("Content-Type", resp.headers.get("Content-Type", "application/json"))
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
        except HTTPError as exc:
            body = exc.read()
            self.send_response(exc.code)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(body)
        except URLError as exc:
            msg = b'{"code":"upstream_unavailable","message":"start elixir/ or go/ Guide API"}'
            self.send_response(502)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(msg)
            self.log_error("upstream %s: %s", url, exc)


if __name__ == "__main__":
    addr = os.environ.get("TOBOR_KIT_HOST_ADDR", "127.0.0.1:8090")
    host, port = addr.rsplit(":", 1)
    print(f"host page http://{addr}  POST /voice/token -> {UPSTREAM}/api/tobor-kit/voice/token")
    ThreadingHTTPServer((host, int(port)), Handler).serve_forever()
