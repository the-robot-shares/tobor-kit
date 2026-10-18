defmodule ToborKit.Hologram.TestSupport.LlmTransportStub do
  @moduledoc """
  Transport seam stub for the `llm-inference` command path — the mirror of
  Lit's injectable `fetch`. `Settings` receives the module NAME as the
  `:transport` prop and calls `call/4`, which mirrors `Support.Http`
  outcomes:

    * URL contains `stub-401`   → `{:error, %{status: 401, body: ...}}`
    * URL contains `stub-down`  → `{:error, %{reason: ...}}`
    * URL contains `/models`    → OpenAI-shaped `{"data" => [...]}` listing
    * otherwise                 → OpenAI-shaped completion echo
  """

  def call(:get, url, _headers, _body) do
    cond do
      String.contains?(url, "stub-401") -> {:error, %{status: 401, body: %{"error" => %{"message" => "bad key"}}}}
      String.contains?(url, "stub-down") -> {:error, %{reason: "econnrefused"}}
      true ->
        {:ok, %{"data" => [%{"id" => "stub-mini"}, %{"id" => "stub-large"}, %{"id" => nil}]}}
    end
  end

  def call(:post, url, headers, body) do
    cond do
      String.contains?(url, "stub-401") ->
        {:error, %{status: 401, body: %{"error" => %{"message" => "bad key"}}}}

      String.contains?(url, "stub-down") ->
        {:error, %{reason: "econnrefused"}}

      String.contains?(url, "/messages") ->
        {:ok, %{"content" => [%{"type" => "text", "text" => "anthropic stub reply"}], "model" => "stub-anthropic"}}

      true ->
        {:ok, %{"choices" => [%{"message" => %{"content" => "stub hello"}}],
                "model" => inspect(Enum.count(headers)) <> ":" <> (body[:model] || "")}}
    end
  end
end
