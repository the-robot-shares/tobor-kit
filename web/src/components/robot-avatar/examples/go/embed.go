package main

import (
	"log"
	"net/http"
)

// RobotAvatarHandler serves a page that mounts <tobor-robot-avatar>.
//
// None required. Host tells it the state; it never infers.
// Never put secrets on this island.
func RobotAvatarHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, _ = w.Write([]byte(robotAvatarPage))
}

const robotAvatarPage = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>tobor-robot-avatar</title>
    <script type="importmap">
      {
        "imports": {
          "lit": "https://cdn.derobot.is/tobor-kit/latest/vendor/lit.js",
          "lit/decorators.js": "https://cdn.derobot.is/tobor-kit/latest/vendor/lit-decorators.js"
        }
      }
    </script>
    <style>
      tobor-robot-avatar {
        --tobor-kit-robot-size: 96px;
        --tobor-kit-robot-shell: #1b1d27;
        --tobor-kit-robot-edge: #2c2f3d;
        --tobor-kit-robot-visor: #0d0f16;
        --tobor-kit-robot-accent: #6ee7c7;
      }
    </style>
  </head>
  <body>
    <label>State
      <select id="state">
        <option value="idle" selected>idle</option>
        <option value="listening">listening</option>
        <option value="thinking">thinking</option>
        <option value="speaking">speaking</option>
        <option value="tool_running">tool_running</option>
        <option value="error">error</option>
        <option value="offline">offline</option>
      </select>
    </label>
    <tobor-robot-avatar id="avatar" state="idle" label="Guide" renderer="glyph" reduced-motion="respect"></tobor-robot-avatar>
    <script type="module">
      import 'https://cdn.derobot.is/tobor-kit/latest/components/robot-avatar/robot-avatar.js';
      const avatar = document.querySelector('#avatar');
      document.querySelector('#state').addEventListener('change', (event) => {
        avatar.setAttribute('state', event.target.value);
      });
    </script>
  </body>
</html>
`

func main() {
	http.HandleFunc("/", RobotAvatarHandler)
	log.Fatal(http.ListenAndServe(":8090", nil))
}
