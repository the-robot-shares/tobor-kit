defmodule ToborKit.UUID do
  @moduledoc false

  import Bitwise

  @doc "Random UUID v4 as a string."
  @spec generate() :: String.t()
  def generate do
    <<a::32, b::16, c::16, d::16, f::48>> = :crypto.strong_rand_bytes(16)
    c = 0x4000 ||| (c &&& 0x0FFF)
    d = 0x8000 ||| (d &&& 0x3FFF)

    :io_lib.format("~8.16.0b-~4.16.0b-~4.16.0b-~4.16.0b-~12.16.0b", [a, b, c, d, f])
    |> IO.iodata_to_binary()
    |> String.downcase()
  end
end
