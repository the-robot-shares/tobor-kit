defmodule ToborKit.Hologram.Support.Http do
  @moduledoc """
  Thin Req wrapper for the JSON POST/GET shape every server-coupled
  mirror command performs. Server-only — called from `command/3`
  handlers, so nothing here ever reaches the client bundle.

  All functions return the typed outcome:

      {:ok, body}                 # 2xx, body = decoded JSON map or raw binary
      {:error, %{status, body}}   # non-2xx response (body decoded when JSON)
      {:error, %{reason}}         # transport failure (timeout, conn refused, …)
  """

  @doc """
  JSON POST: `post(base_url <> path, payload, headers: [...] | nil)`.

  `opts[:headers]` — extra request headers (e.g. authorization), never
  client-supplied.
  """
  @spec post(String.t(), map, keyword) :: {:ok, map | binary} | {:error, map}
  def post(url, payload, opts \\ []) when is_binary(url) and is_map(payload) do
    request(:post, url, [json: payload], opts)
  end

  @doc """
  JSON PUT: `put(base_url <> path, payload, headers: [...] | nil)` — same
  shape as `post/3` (telemetry-consent writes use PUT).
  """
  @spec put(String.t(), map, keyword) :: {:ok, map | binary} | {:error, map}
  def put(url, payload, opts \\ []) when is_binary(url) and is_map(payload) do
    request(:put, url, [json: payload], opts)
  end

  @doc """
  GET with optional query params: `get(base_url <> path, params: %{...} | nil)`.
  """
  @spec get(String.t(), keyword) :: {:ok, map | binary} | {:error, map}
  def get(url, opts \\ []) when is_binary(url) do
    request(:get, url, [params: opts[:params]], Keyword.delete(opts, :params))
  end

  @doc """
  Form-encoded POST (`application/x-www-form-urlencoded`) — the OAuth token
  endpoint shape the login-flow exchange performs.

  `opts[:headers]` — extra request headers, never client-supplied.
  """
  @spec post_form(String.t(), map, keyword) :: {:ok, map | binary} | {:error, map}
  def post_form(url, params, opts \\ []) when is_binary(url) and is_map(params) do
    request(:post, url, [form: params], opts)
  end

  @doc """
  Test seam + single choke point for every outgoing mirror request.

  Production callers go through `post/3`, `post_form/3`, `get/2`, which land
  here. When
  `Application.get_env(:tobor_kit_hologram, :http_module)` names a module,
  its `request/4` is invoked instead of Req — command-path tests stub it to
  return canned `{:ok, body} | {:error, map}` outcomes without network I/O
  (see `ToborKit.Hologram.TestSupport.HttpStub`).
  """
  def request(method, url, req_opts, opts) do
    case Application.get_env(:tobor_kit_hologram, :http_module) do
      nil -> do_request(method, url, req_opts, opts)
      module -> module.request(method, url, req_opts, opts)
    end
  end

  defp do_request(method, url, req_opts, opts) do
    headers = opts[:headers] || []

    req_opts =
      req_opts
      |> Enum.reject(fn {_k, v} -> is_nil(v) end)
      |> Keyword.merge(headers: headers, retry: false)

    case Req.request([method: method, url: url] ++ req_opts) do
      {:ok, %Req.Response{status: status, body: body}} when status in 200..299 ->
        {:ok, body}

      {:ok, %Req.Response{status: status, body: body}} ->
        {:error, %{status: status, body: body}}

      {:error, exception} ->
        {:error, %{reason: format_exception(exception)}}
    end
  end

  defp format_exception(%{__exception__: true, __struct__: mod} = e) do
    if Code.ensure_loaded?(mod) and function_exported?(mod, :message, 1) do
      Exception.message(e)
    else
      Exception.format(:error, e)
    end
  end

  defp format_exception(other), do: inspect(other)
end
