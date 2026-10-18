defmodule ToborKit.Telemetry.ConsentTest do
  use ExUnit.Case, async: false

  @on_cfg %{
    "default" => "on",
    "user_overridable" => true,
    "capture" => %{
      "prompt" => true,
      "response" => true,
      "tool_args" => false,
      "tool_results" => false
    }
  }

  setup do
    :ets.delete_all_objects(:tobor_kit_consent)
    :ok
  end

  test "no record → guide default, source default" do
    consent = ToborKit.Telemetry.Consent.resolve("user-1", @on_cfg)
    assert %{enabled: true, source: "default", user_overridable: true} = consent
  end

  test "off default → disabled unless a user record overrides" do
    off = Map.put(@on_cfg, "default", "off")

    assert %{enabled: false, source: "default"} =
             ToborKit.Telemetry.Consent.resolve("user-1", off)

    ToborKit.Telemetry.Consent.put("user-1", true, off)
    assert %{enabled: true, source: "user"} = ToborKit.Telemetry.Consent.resolve("user-1", off)
  end

  test "explicit user record wins over the default when overridable" do
    ToborKit.Telemetry.Consent.put("user-1", false, @on_cfg)

    assert %{enabled: false, source: "user"} =
             ToborKit.Telemetry.Consent.resolve("user-1", @on_cfg)
  end

  test "user_overridable false forces the default and rejects writes" do
    forced = Map.put(@on_cfg, "user_overridable", false)

    assert %{enabled: true, source: "forced", user_overridable: false} =
             ToborKit.Telemetry.Consent.resolve("user-1", forced)

    # The user's preference is ignored even when a record exists.
    ToborKit.Telemetry.Consent.Store.put("user-1", false)

    assert %{enabled: true, source: "forced"} =
             ToborKit.Telemetry.Consent.resolve("user-1", forced)

    assert {:error, :not_overridable} = ToborKit.Telemetry.Consent.put("user-1", false, forced)
  end

  test "master enabled: false is a hard forced-off" do
    master_off = Map.put(@on_cfg, "enabled", false)

    assert %{enabled: false, source: "forced"} =
             ToborKit.Telemetry.Consent.resolve("user-1", master_off)

    assert {:error, :not_overridable} = ToborKit.Telemetry.Consent.put("user-1", true, master_off)
  end
end

defmodule ToborKit.TelemetryTest do
  use ExUnit.Case, async: false

  alias ToborKit.TestSupport.OtelCollector

  @capture_all %{
    "prompt" => true,
    "response" => true,
    "tool_args" => true,
    "tool_results" => true
  }

  setup do
    OtelCollector.clear()
    :ok
  end

  defp exchange(consent) do
    ToborKit.Telemetry.exchange(
      [
        session_id: "sess-1",
        guide_slug: "deploy-guide",
        model: "tobor-fake-1",
        input: "my prompt says bearer sk-abc123def456ghi789jkl",
        consent: consent
      ],
      fn ->
        {:ok,
         %{
           completion:
             ToborKit.Completion.new(
               text: "the response",
               prompt_tokens: 10,
               completion_tokens: 5
             ),
           consent: consent
         }}
      end
    )
  end

  defp span_attrs do
    spans = OtelCollector.spans()
    assert [span] = spans
    assert :span = elem(span, 0)

    # attributes live at index 10 of the :span record (otel_span.hrl)
    elem(span, 10)
    |> :otel_attributes.map()
    |> Map.new(fn {k, v} -> {to_string(k), v} end)
  end

  test "consent OFF: span carries standard attributes and NO content attributes" do
    consent = %ToborKit.Telemetry.Consent{
      enabled: false,
      source: "default",
      user_overridable: true,
      capture: @capture_all
    }

    exchange(consent)
    attrs = span_attrs()

    assert attrs["tobor.session_id"] == "sess-1"
    assert attrs["tobor.guide_slug"] == "deploy-guide"
    assert attrs["tobor.usage.input_tokens"] == 10

    # The gate is absolute: capture flags being on does not matter.
    refute Map.has_key?(attrs, "tobor.content.prompt")
    refute Map.has_key?(attrs, "tobor.content.response")
    refute Map.has_key?(attrs, "tobor.content.tool_args")
    refute Map.has_key?(attrs, "tobor.content.tool_results")

    # No user content anywhere on the span.
    encoded = inspect(span_attrs())
    refute encoded =~ "my prompt"
    refute encoded =~ "the response"
  end

  test "consent ON: content attributes present per capture flags, redaction applied even then" do
    consent = %ToborKit.Telemetry.Consent{
      enabled: true,
      source: "user",
      user_overridable: true,
      capture: %{
        "prompt" => true,
        "response" => true,
        "tool_args" => false,
        "tool_results" => false
      },
      redact: ["(?i)bearer\\s+[a-z0-9._-]+", "(?i)\\bsk-[a-z0-9]{16,}\\b"]
    }

    exchange(consent)
    attrs = span_attrs()

    # Captured + redacted: key material never lands on the span.
    assert attrs["tobor.content.prompt"] == "my prompt says [REDACTED]"
    assert attrs["tobor.content.response"] == "the response"

    # Not captured per flags → absent.
    refute Map.has_key?(attrs, "tobor.content.tool_args")
    refute Map.has_key?(attrs, "tobor.content.tool_results")
  end

  test "redaction applies to tool content too when capture is on" do
    consent = %ToborKit.Telemetry.Consent{
      enabled: true,
      source: "user",
      user_overridable: true,
      capture: @capture_all,
      redact: ["(?i)\\bsk-[a-z0-9]{16,}\\b"]
    }

    ToborKit.Telemetry.exchange(
      [input: "go", consent: consent],
      fn ->
        {:ok,
         %{
           completion:
             ToborKit.Completion.new(
               text: "ok",
               tool_calls: [
                 %{
                   id: "t1",
                   name: "Tool.Do",
                   args: %{"key" => "sk-abcdefghijklmnopq"},
                   ok: true,
                   summary: "did it"
                 }
               ]
             ),
           consent: consent
         }}
      end
    )

    attrs = span_attrs()
    assert attrs["tobor.content.tool_args"] =~ "[REDACTED]"
    refute attrs["tobor.content.tool_args"] =~ "sk-abc"
    assert attrs["tobor.content.tool_results"] =~ "did it"
  end

  test "span_attributes/2 is a pure function of consent" do
    on = %ToborKit.Telemetry.Consent{
      enabled: true,
      source: "user",
      user_overridable: true,
      capture: %{"prompt" => true}
    }

    off = %{on | enabled: false}

    content = [prompt: "hello", response: "world"]

    assert [{"tobor.content.prompt", "hello"}] =
             ToborKit.Telemetry.span_attributes(content, on)
             |> Enum.filter(fn {k, _} -> String.starts_with?(k, "tobor.content.") end)

    assert [] =
             ToborKit.Telemetry.span_attributes(content, off)
             |> Enum.filter(fn {k, _} -> String.starts_with?(k, "tobor.content.") end)
  end
end
