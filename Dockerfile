# syntax=docker/dockerfile:1.7
#
# tobor-kit service image. The mix project root is `elixir/` — every build
# step below runs with /app/elixir as the working directory.
#
# Cache policy (house rule, see therobotplans backend Dockerfile):
# - ONLY re-downloadable data lives on BuildKit cache mounts (hex, rebar3),
#   with ${TARGETARCH}-suffixed ids so cross-arch builds never share state.
# - deps/ and _build/ are build OUTPUTS -> they live in image layers.
#
ARG BASE_IMAGE="elixir:1.20.1-otp-29-slim"

FROM ${BASE_IMAGE} AS build
ARG TARGETARCH

RUN apt-get update -y && \
    apt-get install -y build-essential git curl ca-certificates && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app/elixir

# Cross-arch emulation (QEMU / Rosetta) breaks BEAM's double-mapped RWX JIT
# pages. `+JMsingle true` is the correct mitigation — `+J false` is NOT a
# valid flag on modern OTP and exits 1.
ENV ERL_AFLAGS="+JMsingle true"

# Keep emulated builds below the scheduler/RSS cliff.
ENV ERL_FLAGS="+S 2:2"
ENV ELIXIR_ERL_OPTIONS="+S 2:2"

RUN mix local.hex --force && mix local.rebar --force

ENV MIX_ENV=prod
ENV HEX_HTTP_TIMEOUT=300
ENV HEX_HTTP_CONCURRENCY=1

COPY elixir/mix.exs elixir/mix.lock ./

RUN --mount=type=cache,id=toborkit-hex-${TARGETARCH},target=/root/.hex,sharing=locked \
    --mount=type=cache,id=toborkit-rebar3-${TARGETARCH},target=/root/.cache/rebar3,sharing=locked \
    mix deps.get --only $MIX_ENV

COPY elixir/config config
COPY elixir/lib lib

RUN --mount=type=cache,id=toborkit-hex-${TARGETARCH},target=/root/.hex,sharing=locked \
    --mount=type=cache,id=toborkit-rebar3-${TARGETARCH},target=/root/.cache/rebar3,sharing=locked \
    MIX_OS_DEPS_COMPILE_PARTITION_COUNT=1 mix compile

RUN --mount=type=cache,id=toborkit-hex-${TARGETARCH},target=/root/.hex,sharing=locked \
    --mount=type=cache,id=toborkit-rebar3-${TARGETARCH},target=/root/.cache/rebar3,sharing=locked \
    mix release --overwrite && \
    rm -rf /app/release && \
    cp -a /app/elixir/_build/${MIX_ENV}/rel/tobor_kit /app/release

FROM ${BASE_IMAGE} AS production

WORKDIR /app
RUN chown nobody /app

ENV MIX_ENV=prod

COPY --from=build --chown=nobody:root /app/release ./

USER nobody

EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:8080/api/tobor-kit/healthz || exit 1

CMD ["bin/tobor_kit", "start"]
