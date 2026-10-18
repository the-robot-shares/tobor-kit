defmodule ToborKit.Hologram.Asset.View do
  @moduledoc """
  `<tobor-asset-view>` mirror — mime-aware preview (contract class A).

  Ported from `web/src/components/asset/asset-view.ts`. Host supplies the
  `asset` snapshot; text is escaped interpolation in `<pre>` — never raw
  HTML.

  Class A: the mirror binds no explicit target; the click-to-open binding
  relies on the render-tree default target (nearest stateful component), so
  `asset-open` maps to the `:asset_open` action with `%{id}` there.

  Backend: None. Host owns data flow.
  """

  use Hologram.Component

  alias ToborKit.Hologram.Asset.Assets
  alias ToborKit.Hologram.Support.Classes

  # Host-owned snapshot: `{id, name, mime, src?, body?, meta?}`.
  prop :asset, :any, default: nil

  prop :class, :string, default: ""

  def template do
    ~HOLO"""
    <div class={Classes.classes("tk tk-asset-view", @class)}>
      {%if @asset}
        <article class="tk-asset-view__frame" data-cy="asset.view" $click={action: :asset_open, params: %{id: asset_id(@asset)}}>
          <span class="tk-asset-view__name">{asset_name(@asset)}</span>
          {%if image_mime?(asset_mime(@asset))}
            {%if has_preview_src?(asset_src(@asset))}
              <img class="tk-asset-view__preview" data-cy="asset.preview" data-kind="image" alt={asset_name(@asset)} src={preview_src(asset_src(@asset))} />
            {%else}
              <div class="tk-asset-view__fallback" data-cy="asset.preview" data-kind="image">{asset_name(@asset)}</div>
            {/if}
          {%else}
            {%if text_mime?(asset_mime(@asset))}
              <pre class="tk-asset-view__preview" data-cy="asset.preview" data-kind="text">{text_body(@asset)}</pre>
            {%else}
              <div class="tk-asset-view__fallback" data-cy="asset.preview" data-kind="other">
                {%if has_preview_src?(asset_src(@asset))}
                  <a class="tk-asset-view__download" href={preview_src(asset_src(@asset))} download={asset_name(@asset)}>{download_label(@asset)}</a>
                {%else}
                  {asset_name(@asset)}
                {/if}
              </div>
            {/if}
          {/if}
        </article>
      {%else}
        <article class="tk-asset-view__frame" data-cy="asset.view">
          <p class="muted">No asset</p>
        </article>
      {/if}
    </div>
    """
  end

  # -- public template helpers ------------------------------------------

  def image_mime?(mime), do: Assets.image_mime?(mime)
  def text_mime?(mime), do: Assets.text_mime?(mime)
  def preview_src(src), do: Assets.preview_src(src)
  def text_body(asset), do: Assets.text_body(asset)
  def asset_id(asset), do: Assets.get(asset, :id)
  def asset_name(asset), do: Assets.get(asset, :name)
  def asset_mime(asset), do: Assets.get(asset, :mime) || ""
  def asset_src(asset), do: Assets.get(asset, :src)

  @doc "Safe-src check for the template branches."
  def has_preview_src?(src) do
    not is_nil(Assets.preview_src(src))
  end

  @doc "Lit `Download {name}` link text."
  def download_label(asset) do
    "Download " <> (asset_name(asset) || "")
  end
end
