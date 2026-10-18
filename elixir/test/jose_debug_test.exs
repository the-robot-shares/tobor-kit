defmodule JoseDebugTest do
  use ExUnit.Case

  test "probe" do
    tok = JWKSFixture.id_token([])
    jwk_map = Enum.find(JWKSFixture.jwks()["keys"], &(&1["kid"] == "test-key"))

    jwk =
      case JOSE.JWK.from_map(jwk_map) do
        {_, j} -> j
        j -> j
      end

    IO.inspect(JOSE.JWT.verify_strict(jwk, ["RS256"], tok), label: "result")
  end
end
