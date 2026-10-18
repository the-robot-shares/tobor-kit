defmodule ToborKit.Hologram.TestSupport.HttpStub do
  @moduledoc """
  Server-side `Support.Http` test seam (Application env
  `:tobor_kit_hologram, :http_module`). Routes canned outcomes off the
  URL so command-path tests never touch the network:

    * `stub-guide.test`   → `GET /guide` returns a minimal projection
    * `stub-401.test`     → 401 error outcome
    * `stub-down.test`    → transport failure outcome
    * `stub-turn.test`    → `POST …/turn` returns an SSE body whose
      terminal frame is a `message` turn
    * `stub-turn-err.test` → SSE body whose terminal frame is an `error`
    * `stub-incomplete.test` → SSE body with no terminal frame
    * anything else       → `{"ok" => true}`
  """

  @guide %{
    "slug" => "stub-guide",
    "name" => "Stub Guide",
    "title" => "Stubbed projection",
    "greeting" => "Hello from the stub",
    "modes" => ["text", "transcript"],
    "default_mode" => "text"
  }

  @turn %{
    "id" => "t1",
    "role" => "assistant",
    "content" => "Stub turn content",
    "created_at" => "2026-09-15T00:00:00Z",
    "tool_calls" => []
  }

  def request(:get, url, _req_opts, _opts) do
    cond do
      String.contains?(url, "stub-guide.test") and String.contains?(url, "/guide") -> {:ok, @guide}
      String.contains?(url, "stub-guide.test") and String.contains?(url, "/mcp/tools") -> {:ok, %{"groups" => [], "tools" => [], "degraded" => []}}
      String.contains?(url, "stub-401.test") -> {:error, %{status: 401, body: %{"message" => "unauthorized"}}}
      String.contains?(url, "stub-down.test") -> {:error, %{reason: "econnrefused"}}
      true -> {:ok, %{"ok" => true}}
    end
  end

  def request(:post, url, req_opts, _opts) do
    cond do
      String.contains?(url, "/turn") and String.contains?(url, "stub-turn-err.test") ->
        {:ok, sse_error()}

      String.contains?(url, "/turn") and String.contains?(url, "stub-incomplete.test") ->
        {:ok, sse_incomplete()}

      String.contains?(url, "/turn") ->
        {:ok, sse_message()}

      String.contains?(url, "/sessions") ->
        {:ok, %{"id" => "sess-1", "created_at" => "2026-09-15T00:00:00Z", "state" => "idle"}}

      String.contains?(url, "stub-401.test") ->
        {:error, %{status: 401, body: %{"message" => "unauthorized"}}}

      true ->
        {:ok, %{"ok" => true, "json_sent" => req_opts[:json]}}
    end
  end

  def request(_method, _url, _req_opts, _opts), do: {:ok, %{"ok" => true}}

  def guide, do: @guide
  def turn, do: @turn

  def sse_message do
    "event: state\ndata: {\"state\":\"thinking\"}\n\nevent: message\ndata: " <>
      Jason.encode!(@turn) <> "\n\n"
  end

  def sse_error do
    "event: error\ndata: {\"code\":\"turn_failed\",\"message\":\"stub boom\"}\n\n"
  end

  def sse_incomplete, do: "event: state\ndata: {\"state\":\"thinking\"}\n\n"
end
