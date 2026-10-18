defmodule ToborKit.Hologram.TestSupport.Layout do
  @moduledoc """
  Minimal test layout for the gallery fixture page. Hosts own their layouts;
  the mirror library never ships one — this exists only so the test-scope
  gallery page can render.
  """

  use Hologram.Component

  prop :page_title, :string, default: "tobor-kit Hologram gallery"

  def template do
    ~HOLO"""
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>{@page_title}</title>
        <link rel="stylesheet" href="/css/tobor-kit.css" />
      </head>
      <body>
        <slot />
      </body>
    </html>
    """
  end
end
