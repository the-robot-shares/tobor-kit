defmodule ToborKit.CompilerTest do
  use ExUnit.Case, async: false

  alias ToborKit.Compiler
  alias ToborKit.Compiler.Error
  alias ToborKit.Compiler.Json

  @fixture Path.expand("../../../schema/examples/deploy-guide.guide.yaml", __DIR__)
  @golden Path.expand("golden/deploy-guide.bundle.json", __DIR__)

  defp minimal_guide(npl) do
    %{
      "schema" => "tobor.guide-definition",
      "version" => 1,
      "core" => %{
        "slug" => "closure-probe",
        "name" => "Closure Probe",
        "organization" => "noizu-labs"
      },
      "agent" => %{
        "purpose" => "Probe the require closure.",
        "biography" => "A minimal guide used to test transitive dependency closure."
      },
      "npl" => npl
    }
  end

  defp compile_ok(source, opts \\ []) do
    case Compiler.compile(source, opts) do
      {:ok, bundle} -> bundle
      {:error, err} -> flunk("compile failed: " <> Error.format(err))
    end
  end

  describe "golden file" do
    test "the example guide compiles byte-identically across runs and matches the golden bundle" do
      {:ok, first} = Compiler.compile_file(@fixture)
      {:ok, second} = Compiler.compile_file(@fixture)

      # Byte-stability: same input, same process, two compiles -> identical bytes.
      assert Json.pretty(first) == Json.pretty(second)

      golden =
        if File.exists?(@golden) do
          File.read!(@golden)
        else
          json = Json.pretty(first)
          File.mkdir_p!(Path.dirname(@golden))
          File.write!(@golden, json)
          json
        end

      assert Json.pretty(first) == golden,
             "bundle drifted from the golden file; if the drift is intended, " <>
               "regenerate with: mix run -e '…' (see README)"
    end
  end

  describe "require closure" do
    test "a component three require-hops from a seed is fully rendered" do
      # Chain proven from the convention set:
      #   prompt-sections#format-prompt-section (seed)
      #     -> require syntax.omission          (hop 1)
      #     -> require syntax.qualifier         (hop 2)
      #     -> require syntax.size-indicator    (hop 3)
      # None of the three syntax components is named by the guide.
      bundle =
        compile_ok(
          minimal_guide(%{
            "prompt_sections" => ["format"],
            "preamble" => %{"example_priority" => 1}
          })
        )

      expression = bundle["expression"]
      derived = bundle["derived_components"]

      assert expression =~ "syntax#omission"
      assert expression =~ "syntax#qualifier"
      assert expression =~ "syntax#size-indicator"

      assert "syntax.omission" in derived
      assert "syntax.qualifier" in derived
      assert "syntax.size-indicator" in derived

      # The preamble body actually renders the 3-hop component.
      assert bundle["preamble"] =~ "Size Indicator"
    end
  end

  describe "bundle_hash" do
    test "stable across runs, changes when the guide changes" do
      guide = minimal_guide(%{"pumps" => ["chain-of-thought"]})

      bundle_a = compile_ok(guide)
      bundle_b = compile_ok(guide)
      assert bundle_a["bundle_hash"] == bundle_b["bundle_hash"]
      assert bundle_a["bundle_hash"] =~ ~r/^sha256:[0-9a-f]{64}$/

      changed =
        put_in(guide, ["agent", "purpose"], "A different purpose changes the hash.")

      refute compile_ok(changed)["bundle_hash"] == bundle_a["bundle_hash"]
    end
  end

  describe "validation" do
    test "malformed guides fail with key-path-scoped issues, not raises" do
      bad = minimal_guide(%{}) |> Map.merge(%{"core" => %{"slug" => "Bad_Slug", "name" => "x"}})

      assert {:error, %Error{kind: :validation} = err} = Compiler.compile(bad)

      paths = Enum.map(err.issues, & &1.path)
      assert "core.slug" in paths
      assert "core.organization" in paths

      rendered = Error.format(err)
      assert rendered =~ "core.slug"
    end

    test "enum violations and negative priority knobs are reported" do
      base =
        minimal_guide(%{
          "preamble" => %{"example_priority" => 0, "layout" => "yaml_order"}
        })

      bad =
        base
        |> put_in(["core", "status"], "published")
        |> put_in(["npl", "declaration_kind"], "swarm")
        |> put_in(["npl", "preamble", "example_priority"], -1)
        |> put_in(["npl", "preamble", "layout"], "spiral")

      assert {:error, %Error{} = err} = Compiler.compile(bad)
      paths = Enum.map(err.issues, & &1.path)

      assert "core.status" in paths
      assert "npl.declaration_kind" in paths
      assert "npl.preamble.example_priority" in paths
      assert "npl.preamble.layout" in paths
    end

    test "defaults are filled for absent optional blocks" do
      bundle = compile_ok(minimal_guide(%{}))
      assert bundle["npl"]["declaration_kind"] == "agent"
      assert bundle["npl"]["layout"] == "yaml_order"
      assert bundle["npl"]["component_priority"] == 0
      assert bundle["npl"]["example_priority"] == 0
    end
  end

  describe "priority knobs" do
    test "example_priority 0 omits worked examples; 1 includes them" do
      without = compile_ok(minimal_guide(%{"prompt_sections" => ["format"]}))
      assert without["preamble"] =~ "## NPL Syntax Overview"

      with_examples =
        compile_ok(minimal_guide(%{"prompt_sections" => ["format"], "preamble" => %{"example_priority" => 1}}))

      assert with_examples["preamble"] =~ "```example"
      assert byte_size(with_examples["preamble"]) > byte_size(without["preamble"])
    end
  end

  describe "skip" do
    test "skipped components are excluded from the bundle; their dependents still resolve" do
      bundle =
        compile_ok(
          minimal_guide(%{
            "prompt_sections" => ["format"],
            "preamble" => %{"skip" => ["syntax#qualifier"]}
          })
        )

      # qualifier's body belongs to the consuming system's bundle now
      refute bundle["preamble"] =~ "##### Qualifier"
      refute bundle["expression"] =~ "syntax#qualifier"

      # format-prompt-section still resolves through omission despite the hole
      assert bundle["expression"] =~ "syntax#omission"
      assert bundle["preamble"] =~ "Format Prompt Section"
      assert bundle["warnings"] == []
    end
  end
end
