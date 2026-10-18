defmodule ToborKit.Hologram.Support.Classes do
  @moduledoc """
  Shared class-string builder for mirror components.

  Mirrors the `Btn.classes/3` shape from the hologram-start-app scaffold:
  merge parts, drop `nil`/`false`/`""`, join with single spaces. Written with
  client-transpilable primitives only (`Enum.reject/2`, `Enum.join/2`) so
  stateful components may call it from `action/3` too.
  """

  @spec classes(String.t() | nil, [String.t() | nil | boolean] | String.t() | nil | boolean) ::
          String.t()
  def classes(base, extras) when is_list(extras) do
    [base | extras]
    |> Enum.reject(&(is_nil(&1) or &1 == false or &1 == ""))
    |> Enum.join(" ")
  end

  def classes(base, extra), do: classes(base, [extra])
end
