defmodule ToborKit.TestSupport.OIDCRecorder do
  @moduledoc """
  In-memory fake IdP HTTP layer for `ToborKit.Auth.OIDC` tests.

  `start/1` returns `{http_fn, holder}`. The holder's keyword options can be
  updated between the authorization and the callback (e.g. to mint the id
  token for the session's random nonce). Every call is also sent to the
  calling test process as `{:http, call}` for assertions.
  """

  def start(opts \\ []) do
    parent = self()
    {:ok, holder} = Agent.start_link(fn -> opts end)

    http = fn
      {:get, url} ->
        send(parent, {:http, {:get, url}})

        cond do
          String.ends_with?(url, "openid-configuration") ->
            {:ok,
             Jason.encode!(%{
               "issuer" =>
                 Keyword.get(
                   Agent.get(holder, & &1),
                   :discovery_issuer,
                   "https://auth.derobot.is/application/o/tobor-kit"
                 ),
               "authorization_endpoint" =>
                 "https://auth.derobot.is/application/o/tobor-kit/authorize",
               "token_endpoint" => "https://auth.derobot.is/application/o/tobor-kit/token",
               "jwks_uri" => "https://auth.derobot.is/application/o/tobor-kit/jwks"
             })}

          String.ends_with?(url, "jwks") ->
            {:ok, Jason.encode!(JWKSFixture.jwks())}

          true ->
            {:error, :unexpected_get}
        end

      {:post_form, url, form} ->
        send(parent, {:http, {:post_form, url, form}})

        {:ok,
         Jason.encode!(%{
           "access_token" => "at",
           "token_type" => "Bearer",
           "id_token" => JWKSFixture.id_token(Agent.get(holder, & &1))
         })}
    end

    {http, holder}
  end

  def set(holder, kw), do: Agent.update(holder, &Keyword.merge(&1, kw))

  def calls(parent), do: do_calls(parent, [])

  defp do_calls(parent, acc) do
    receive do
      {:http, call} -> do_calls(parent, [call | acc])
    after
      0 -> Enum.reverse(acc)
    end
  end
end

defmodule JWKSFixture do
  @moduledoc """
  A tiny fake IdP token mint. The primary key signs legitimate id tokens;
  the secondary key is published in the JWKS (key-discovery variety); the
  rogue key signs tokens that must fail strict verification (its public half
  is NOT published). JWK maps are built by hand from :public_key keys so the
  private material stays available for signing.
  """

  @primary :public_key.generate_key({:rsa, 2048, 65_537})
  @other :public_key.generate_key({:rsa, 2048, 65_537})
  @rogue :public_key.generate_key({:rsa, 2048, 65_537})

  def jwks do
    %{"keys" => [public(@primary, "test-key"), public(@other, "other-key")]}
  end

  def id_token(opts) do
    now = System.system_time(:second)

    claims = %{
      "iss" => Keyword.get(opts, :issuer, "https://auth.derobot.is/application/o/tobor-kit"),
      "aud" => "tobor-kit",
      "sub" => "user-123",
      "email" => "testing@therobotlives.com",
      "exp" => now + Keyword.get(opts, :exp_offset, 300),
      "nonce" => Keyword.get(opts, :nonce, "the-session-nonce")
    }

    {key, kid} =
      case opts[:sign_with] do
        :other_key -> {@other, "other-key"}
        # rogue key reuses the published kid: the failure must be signature
        # verification, not key discovery.
        :rogue -> {@rogue, "test-key"}
        _ -> {@primary, "test-key"}
      end

    jwk = Map.merge(private_jwk(key), %{"kid" => kid})

    {_, compact} =
      JOSE.JWT.sign(jwk, %{"alg" => "RS256", "typ" => "JWT", "kid" => kid}, claims)
      |> JOSE.JWS.compact()

    compact
  end

  defp public(rsa_key, kid) do
    {:RSAPublicKey, n, e} = rsa_public(rsa_key)
    %{"kty" => "RSA", "n" => b64(n), "e" => b64(e), "kid" => kid}
  end

  defp private_jwk(key) do
    [_tag, _v, n, e, d, p, q, dp, dq, qi | _] = Tuple.to_list(key)

    %{
      "kty" => "RSA",
      "n" => b64(n),
      "e" => b64(e),
      "d" => b64(d),
      "p" => b64(p),
      "q" => b64(q),
      "dp" => b64(dp),
      "dq" => b64(dq),
      "qi" => b64(qi)
    }
  end

  defp rsa_public(key) do
    [_tag, _v, n, e | _] = Tuple.to_list(key)
    {:RSAPublicKey, n, e}
  end

  defp b64(int) when is_integer(int),
    do: int |> :binary.encode_unsigned() |> Base.url_encode64(padding: false)
end
