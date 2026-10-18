# Wave-0 test run. `Hologram.Test.setup/0` sets HOLOGRAM_START=1, forces a
# Hologram compile (so the test-scope gallery page + fixtures register their
# routes) and restarts the app with the Hologram supervision tree up.
Hologram.Test.setup()

ExUnit.start()
