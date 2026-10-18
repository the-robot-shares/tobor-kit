defmodule ToborKit.Telemetry do
  @moduledoc """
  OpenTelemetry spans per exchange.

  Standard attributes (guide slug, session id, model, token usage, states)
  are always present. **Content attributes — prompt, response, tool_args,
  tool_results, per the guide's `telemetry.capture` — are attached only when
  consent resolves on**, and the guide's `telemetry.redact[]` regexes are
  applied on top of them even then. Consent off means the span exists but
  carries no user content, ever.

  The service name is a real identity for the deployment: the guide's
  `telemetry.service_name` when present, else the bundle slug, else
  `tobor-kit`. Never a generic placeholder.
  """

  require OpenTelemetry.Tracer, as: Tracer

  alias ToborKit.Completion
  alias ToborKit.Telemetry.Consent

  @doc """
  One-time SDK configuration hook, called from `ToborKit.Application`.

  The SDK itself is configured through application env (`config :opentelemetry`
  in `config/config.exs` — resource `service.name` + OTLP exporter pointed at
  the fleet collector). Hosts that run their own OTel setup can skip this
  (`config :tobor_kit, ToborKit.Telemetry, setup: false`); when the SDK
  exposes a runtime resource setter we re-stamp the service name from
  `config :tobor_kit, ToborKit.Telemetry, service_name:` so a deployment's
  real identity wins over the compiled default.
  """
  def setup do
    if Application.get_env(:tobor_kit, __MODULE__, [])[:setup] != false and
         function_exported?(:opentelemetry, :set_resource, 1) do
      service_name = Application.get_env(:tobor_kit, __MODULE__, [])[:service_name] || "tobor-kit"

      resource =
        :otel_resource.create([{~c"service.name", String.to_charlist(service_name)}])

      apply(:opentelemetry, :set_resource, [resource])
    end

    :ok
  end

  @doc """
  Run `fun` inside a `tobor_kit.exchange` span and attach standard +
  consent-gated content attributes.
  """
  @spec exchange(keyword(), (-> result)) :: result when result: var
  def exchange(attrs \\ [], fun) do
    Tracer.with_span "tobor_kit.exchange",
      kind: :server,
      attributes: attrs |> Keyword.delete(:input) |> base_attributes() do
      result = fun.()

      case result do
        {:ok, %{completion: %Completion{} = completion} = payload} ->
          consent = payload[:consent]

          content =
            [
              prompt: attrs[:input],
              response: completion.text,
              tool_args: tool_payload(completion.tool_calls, :args),
              tool_results: tool_payload(completion.tool_calls, :summary)
            ]

          Tracer.set_attributes(span_attributes(attrs ++ content, consent))
          Tracer.set_attributes(usage_attributes(completion, payload[:turn_id]))
          result

        {:error, _reason} = error ->
          OpenTelemetry.Span.set_status(current_span(), OpenTelemetry.status(:error, ""))
          error

        _ ->
          result
      end
    end
  end

  @doc """
  Span attributes for one exchange, consent-filtered and redacted. Pure —
  exposed so the gating rules are directly testable.
  """
  @spec span_attributes(keyword(), Consent.t() | nil) :: [{String.t(), term()}]
  def span_attributes(content, consent) do
    base =
      content
      |> Keyword.take([:session_id, :guide_slug, :model, :state])
      |> Enum.flat_map(fn
        {k, v} when not is_nil(v) -> [{attr_key(k), v}]
        _ -> []
      end)

    content_attrs =
      if consent && consent.enabled do
        capture = consent.capture

        [
          if(capture["prompt"],
            do: content_attr("tobor.content.prompt", content[:prompt], consent.redact)
          ),
          if(capture["response"],
            do: content_attr("tobor.content.response", content[:response], consent.redact)
          ),
          if(capture["tool_args"],
            do: content_attr("tobor.content.tool_args", content[:tool_args], consent.redact)
          ),
          if(capture["tool_results"],
            do: content_attr("tobor.content.tool_results", content[:tool_results], consent.redact)
          )
        ]
        |> Enum.reject(&is_nil/1)
        |> List.flatten()
      else
        []
      end

    base ++ content_attrs
  end

  @doc "Redact `value` with the guide's `telemetry.redact[]` regexes."
  @spec redact(term(), [term()]) :: term()
  def redact(value, patterns) when is_binary(value) do
    Enum.reduce(patterns, value, fn
      %Regex{} = re, acc -> Regex.replace(re, acc, "[REDACTED]")
      pattern, acc when is_binary(pattern) -> redact_pattern(pattern, acc)
      _, acc -> acc
    end)
  end

  def redact(value, _patterns), do: value

  # ── internals ─────────────────────────────────────────────────────────────

  defp content_attr(key, value, redact_patterns) do
    case value do
      nil ->
        []

      v ->
        encoded = if is_binary(v), do: v, else: inspect(v)
        [{key, redact(encoded, redact_patterns)}]
    end
  end

  defp redact_pattern(pattern, acc) do
    case Regex.compile(pattern) do
      {:ok, re} -> Regex.replace(re, acc, "[REDACTED]")
      _ -> acc
    end
  end

  defp base_attributes(attrs) do
    Enum.flat_map(attrs, fn
      {k, v} when is_binary(v) or is_integer(v) or is_float(v) or is_boolean(v) ->
        [{attr_key(k), v}]

      _ ->
        []
    end)
  end

  defp usage_attributes(completion, turn_id) do
    case completion.prompt_tokens do
      nil ->
        []

      _ ->
        [
          {"tobor.usage.input_tokens", completion.prompt_tokens || 0},
          {"tobor.usage.output_tokens", completion.completion_tokens || 0}
        ] ++ if(turn_id, do: [{"tobor.turn.id", turn_id}], else: [])
    end
  end

  defp tool_payload(tool_calls, key) when is_list(tool_calls) do
    if tool_calls == [] do
      nil
    else
      Enum.map(tool_calls, fn tc ->
        %{"id" => tc.id, "name" => tc.name, to_string(key) => Map.get(tc, key)}
      end)
    end
  end

  defp tool_payload(_, _), do: nil

  defp attr_key(k) when is_atom(k), do: "tobor." <> Atom.to_string(k)
  defp attr_key(k) when is_binary(k), do: "tobor." <> k

  defp current_span, do: OpenTelemetry.Tracer.current_span_ctx()
end
