defmodule ToborKit.Hologram.Npl.View do
  @moduledoc """
  `<tobor-npl-view>` mirror — foldable NPL / prompt-lingua source viewer
  (contract class B).

  Ported from `web/src/components/npl-view/npl-view.ts`. Highlighting is CSS
  classes on **escaped** text spans — never raw HTML interpolation.

  Mount-only contract: the full NPL source must be passed at mount
  (`source` prop); `init/3` tokenizes once and the client only toggles folds.
  Source changing after mount does not re-tokenize (a stateful component's
  `init/3` runs once per `cid`) — re-mount with a new `cid` to show a new
  document.

  Copy: the mirror emits `:npl_copy` (Lit `npl-copy {text}`) to the `:target`
  component with `%{text: source}`; the clipboard write stays host-side.
  """

  use Hologram.Component

  alias ToborKit.Hologram.Npl.Tokenizer
  alias ToborKit.Hologram.Support.Classes

  # Lit `source` attribute.
  prop :source, :string, default: ""

  # Host-notification target: "parent" | "layout" | "page".
  prop :target, :string, default: "parent"

  prop :class, :string, default: ""

  def init(props, component, _server) do
    source = props.source || ""

    sections =
      source
      |> Tokenizer.split_sections()
      |> Enum.with_index()
      |> Enum.map(fn {section, index} ->
        %{
          key: "fold-#{index}",
          heading: section.heading,
          heading_tokens: heading_tokens(section.heading),
          body_tokens: tokenize_tokens(section.body),
          has_body: String.trim(section.body) != ""
        }
      end)

    open = Map.new(sections, fn section -> {section.key, true} end)

    put_state(component,
      source: source,
      sections: sections,
      open: open,
      empty?: String.trim(source) == ""
    )
  end

  # Token maps carry a precomputed CSS class so the template (which
  # re-evaluates on the client during patches) never has to build strings.
  defp heading_tokens(nil), do: []
  defp heading_tokens(heading), do: with_classes(Tokenizer.tokenize(heading))

  defp tokenize_tokens(body), do: with_classes(Tokenizer.tokenize(body))

  defp with_classes(tokens) do
    Enum.map(tokens, fn tok -> %{class: Tokenizer.token_class(tok), text: tok.text} end)
  end

  def template do
    ~HOLO"""
    <article class={Classes.classes("tk tk-npl-view", @class)} data-cy="npl.view">
      <header class="tk-npl-view__toolbar">
        <button
          type="button"
          class="tk-npl-view__copy"
          data-cy="npl.copy"
          disabled={@empty?}
          aria-label="Copy NPL source"
          $click={action: :npl_copy, params: %{text: @source}, target: @target}
        >
          Copy
        </button>
      </header>
      {%if @empty?}
        <p class="muted">No source.</p>
      {%else}
        <div class="tk-npl-view__source">
          {%for section <- @sections}
            {%if section.heading}
              <details class="tk-npl-view__section" open={section_open?(@open, section.key)}>
                <summary
                  class="tk-npl-view__fold"
                  data-cy="npl.fold"
                  $click={action: :toggle_fold, params: %{key: section.key}}
                >
                  {%for tok <- section.heading_tokens}
                    <span class={tok.class}>{tok.text}</span>
                  {/for}
                </summary>
                {%if section.has_body}
                  <pre class="npl-block tk-npl-view__body">{%for tok <- section.body_tokens}<span class={tok.class}>{tok.text}</span>{/for}</pre>
                {/if}
              </details>
            {%else}
              <pre class="npl-block tk-npl-view__body">{%for tok <- section.body_tokens}<span class={tok.class}>{tok.text}</span>{/for}</pre>
            {/if}
          {/for}
        </div>
      {/if}
    </article>
    """
  end

  @doc "Fold state lookup — public (templates call public functions), regex-free."
  def section_open?(open, key) do
    Map.get(open, key, false)
  end

  @doc """
  Local fold toggle — set membership only (regex-free client contract,
  `docs/PORTING.md` §6.1).
  """
  def action(:toggle_fold, params, component) do
    open = component.state.open
    key = params.key
    put_state(component, :open, Map.put(open, key, not Map.get(open, key, false)))
  end
end
