defmodule ToborKit.Hologram.Support.Events do
  @moduledoc """
  Frozen event contract — documentation-as-code.

  Lit components notify hosts with bubbling `CustomEvent`s named in
  `web/registry.yaml`. The Hologram mirrors replace these with host-side
  action dispatch (see `docs/PORTING.md` §2):

    * the event name maps to an action atom — `"persona-select"` becomes
      `:persona_select` — and the host receives it through its `:target`
      binding, so the *name* a host integration point listens for is the
      atom, not the string;
    * the Lit `detail` payload maps to snake_case action params —
      `{personaId}` becomes `%{persona_id: ...}`.

  The `@event_*` attributes below record the registry names verbatim so the
  contract is greppable and drift between `web/registry.yaml` and the mirrors
  is visible in review. `events_for/1` is a convenience for docs/tests.

  Wave scope note: this module currently lists the events of the Phase 1
  presentational registry entries; family waves extend it as mirrors land.
  """

  # billing-status
  @event_portal_open "portal-open"

  # styleguide
  @event_sg_click "sg-click"
  @event_sg_card_select "sg-card-select"
  @event_sg_input "sg-input"

  # waitlist
  @event_waitlist_success "waitlist-success"
  @event_waitlist_error "waitlist-error"

  # cookie family
  @event_cookie_consent_change "cookie-consent-change"
  @event_cookie_settings_open "cookie-settings-open"

  # faq
  @event_faq_toggle "faq-toggle"

  # footer-brand — presentational island, registry events: [] (nothing to map)

  # mode-toggle
  @event_tobor_mode_change "tobor-mode-change"

  # persona family
  @event_persona_select "persona-select"

  # party-card family (wave 2)
  @event_agent_chat "agent-chat"
  @event_user_profile "user-profile"

  # phone-input
  @event_country_change "country-change"
  @event_phone_change "phone-change"
  @event_phone_invalid "phone-invalid"

  # model-config
  @event_model_change "model-change"
  @event_custom_endpoint_save "custom-endpoint-save"
  @event_budget_change "budget-change"

  # plan-compare
  @event_plan_select "plan-select"

  # task-menu
  @event_tobor_task_select "tobor-task-select"

  # tool-list
  @event_tobor_tool_select "tobor-tool-select"

  # mcp-clients
  @event_client_authorize "client-authorize"
  @event_client_revoke "client-revoke"

  # mcp-domain
  @event_tool_visibility_change "tool-visibility-change"

  # prompt
  @event_prompt_select "prompt-select"
  @event_prompt_star "prompt-star"
  @event_prompt_fork "prompt-fork"

  # content views
  @event_npl_copy "npl-copy"
  @event_tobor_transcript_clear "tobor-transcript-clear"
  @event_thread_send "thread-send"
  @event_asset_open "asset-open"
  @event_asset_save "asset-save"
  @event_review_start "review-start"
  @event_artifact_save "artifact-save"
  @event_wiki_space_select "wiki-space-select"
  @event_wiki_edit "wiki-edit"
  @event_wiki_save "wiki-save"
  @event_review_submit "review-submit"
  @event_review_resolve "review-resolve"
  @event_config_change "config-change"

  # telemetry-toggle (phase 2, group A)
  @event_tobor_telemetry_change "tobor-telemetry-change"

  # configurator (phase 2, group A)
  @event_configurator_change "configurator-change"
  @event_configurator_apply "configurator-apply"

  # subscription-gate (phase 2, group A)
  @event_gate_blocked "gate-blocked"

  # login-flow (phase 2, group B)
  @event_tobor_auth_redirect "tobor-auth-redirect"
  @event_tobor_auth_token "tobor-auth-token"
  @event_tobor_auth_error "tobor-auth-error"

  # guide-panel (phase 2, group B)
  @event_tobor_task_invoked "tobor-task-invoked"
  @event_tobor_turn_submitted "tobor-turn-submitted"
  @event_tobor_state_change "tobor-state-change"
  @event_tobor_turn_error "tobor-turn-error"
  @event_tobor_turn_message "tobor-turn-message"

  # llm-inference (phase 2, group B)
  @event_test_complete "test-complete"

  @doc "Lit registry event names, verbatim, grouped by family slug."
  @spec all :: %{optional(String.t()) => [String.t()]}
  def all do
    %{
      "styleguide" => [@event_sg_click, @event_sg_card_select, @event_sg_input],
      "billing-status" => [@event_portal_open],
      "waitlist" => [@event_waitlist_success, @event_waitlist_error],
      "cookie" => [@event_cookie_consent_change, @event_cookie_settings_open],
      "faq" => [@event_faq_toggle],
      "mode-toggle" => [@event_tobor_mode_change],
      "party-card" => [@event_agent_chat, @event_user_profile],
      "persona" => [@event_persona_select],
      "phone-input" => [@event_country_change, @event_phone_change, @event_phone_invalid],
      "model-config" => [@event_model_change, @event_custom_endpoint_save, @event_budget_change],
      "plan-compare" => [@event_plan_select],
      "task-menu" => [@event_tobor_task_select],
      "tool-list" => [@event_tobor_tool_select],
      "mcp-clients" => [@event_client_authorize, @event_client_revoke],
      "mcp-domain" => [@event_tool_visibility_change],
      "prompt" => [@event_prompt_select, @event_prompt_star, @event_prompt_fork],
      "npl-view" => [@event_npl_copy],
      "transcript-view" => [@event_tobor_transcript_clear],
      "chat-thread" => [@event_tobor_transcript_clear, @event_thread_send],
      "asset" => [@event_asset_open, @event_asset_save],
      "artifact" => [@event_review_start, @event_artifact_save],
      "wiki" => [@event_wiki_space_select, @event_wiki_edit, @event_wiki_save],
      "review-panel" => [@event_review_submit, @event_review_resolve],
      "mcp-config" => [@event_config_change],
      "telemetry-toggle" => [@event_tobor_telemetry_change],
      "configurator" => [@event_configurator_change, @event_configurator_apply],
      "subscription-gate" => [@event_gate_blocked],
      "login-flow" => [@event_tobor_auth_redirect, @event_tobor_auth_token, @event_tobor_auth_error],
      "guide-panel" => [
        @event_tobor_task_invoked,
        @event_tobor_turn_submitted,
        @event_tobor_state_change,
        @event_tobor_turn_error,
        @event_tobor_turn_message
      ],
      "llm-inference" => [@event_config_change, @event_test_complete]
    }
  end
end
