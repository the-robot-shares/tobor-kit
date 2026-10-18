defmodule ToborKit.Hologram.Asset.Editor do
  @moduledoc """
  `<tobor-asset-editor>` mirror — name + text body editor (contract class B).

  Ported from `web/src/components/asset/asset-editor.ts`. Textarea only for
  `text/*`; save emits `:asset_save` (Lit `asset-save {id, name, body?}`) to
  the `:target` component — the host persists.

  Mount-only contract: drafts seed from the `asset` prop once in `init/3`;
  a new asset after mount does not reseed (re-mount with a new `cid`), and
  the raw name/body draft is emitted — the host trims and falls back to the
  current name (the Lit trim happens host-side here).

  Backend: None. Host owns data flow.
  """

  use Hologram.Component

  alias ToborKit.Hologram.Asset.Assets
  alias ToborKit.Hologram.Support.Classes

  # Host-owned snapshot: `{id, name, mime, src?, body?, meta?}`.
  prop :asset, :any, default: nil

  # Host-notification target.
  prop :target, :string, default: "parent"

  prop :class, :string, default: ""

  def init(props, component, _server) do
    asset = props.asset

    put_state(component,
      asset: asset,
      target: props.target || "parent",
      draft_name: Assets.get(asset, :name) || "",
      draft_body: Assets.text_body(asset)
    )
  end

  def template do
    ~HOLO"""
    <div class={Classes.classes("tk tk-asset-editor", @class)}>
      <form class="tk-asset-editor__form" data-cy="asset.editor" $submit={:save}>
        <label class="tk-asset-editor__field">
          <span>Name</span>
          <input
            class="tk-asset-editor__name"
            name="name"
            type="text"
            autocomplete="off"
            value={@draft_name}
            disabled={no_asset?(@asset)}
            $input={:set_name}
          />
        </label>
        {%if text_mime?(asset_mime(@asset))}
          <label class="tk-asset-editor__field">
            <span>Body</span>
            <textarea
              class="tk-asset-editor__body"
              name="body"
              value={@draft_body}
              $input={:set_body}
            ></textarea>
          </label>
        {/if}
        <button class="tk-asset-editor__save" type="button" data-cy="asset.save" disabled={no_id?(@asset)} $click={:save}>
          Save
        </button>
      </form>
    </div>
    """
  end

  # -- public template helpers ------------------------------------------

  def text_mime?(mime), do: Assets.text_mime?(mime)
  def asset_mime(asset), do: Assets.get(asset, :mime) || ""

  @doc "Lit `?disabled=${!asset}`."
  def no_asset?(asset), do: is_nil(asset)

  @doc "Lit `?disabled=${!asset?.id}`."
  def no_id?(asset), do: is_nil(asset) or is_nil(Assets.get(asset, :id))

  # -- actions (client-side; regex-free) ---------------------------------

  def action(:set_name, params, component) do
    put_state(component, :draft_name, params.event.value)
  end

  def action(:set_body, params, component) do
    put_state(component, :draft_body, params.event.value)
  end

  def action(:save, _params, component) do
    save(component)
  end

  # Host-forwarded actions loop back onto this component when no explicit
  # target resolves — Lit CustomEvents with no listener drop silently.
  def action(_name, _params, component) do
    component
  end

  @doc "Lit `#save`: guard on id, build `{id, name, body?}`, emit, host persists."
  def save(component) do
    asset = component.state.asset

    if no_id?(asset) do
      component
    else
      params =
        %{
          id: Assets.get(asset, :id),
          name: saved_name(component.state.draft_name, Assets.get(asset, :name))
        }
        |> maybe_add_body(Assets.text_mime?(asset_mime(asset)), component.state.draft_body)

      put_action(component,
        name: :asset_save,
        target: component.state.target,
        params: params
      )
    end
  end

  @doc "Lit `draftName.trim() || asset.name` (trim ported; empty falls back)."
  def saved_name(draft_name, current_name) do
    trimmed = String.trim(draft_name || "")

    if trimmed == "" do
      current_name || ""
    else
      trimmed
    end
  end

  defp maybe_add_body(params, true, body), do: Map.put(params, :body, body)
  defp maybe_add_body(params, false, _body), do: params
end
