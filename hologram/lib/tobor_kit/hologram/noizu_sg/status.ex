defmodule ToborKit.Hologram.Sg.Status do
  @moduledoc """
  Mirror of `<noizu-sg-status>` (contract class A — stateless render-only).

  `status` clamps to `ok | warn | error | idle` (default `idle`). The
  description line only renders when non-empty.

  Backend: None.
  """

  use Hologram.Component

  alias ToborKit.Hologram.Support.Classes

  prop :status, :string, default: "idle"
  prop :label, :string, default: ""
  prop :description, :string, default: ""
  prop :class, :string, default: ""

  def template do
    ~HOLO"""
    <div class={Classes.classes("tk tk-sg-status", @class)}>
      <div class="tk-sg-status__status" data-cy="sg.status" data-status={resolved_status(@status)} role="status">
        <span class="tk-sg-status__dot" aria-hidden="true"></span>
        <div class="tk-sg-status__copy">
          <span class="tk-sg-status__label">{@label}</span>
          {%if @description != ""}
            <span class="tk-sg-status__description">{@description}</span>
          {/if}
        </div>
      </div>
    </div>
    """
  end

  @doc "Status clamp — invalid input falls back to `idle` (Lit `STATUSES`)."
  def resolved_status(status) when status in ["ok", "warn", "error", "idle"], do: status
  def resolved_status(_), do: "idle"
end
