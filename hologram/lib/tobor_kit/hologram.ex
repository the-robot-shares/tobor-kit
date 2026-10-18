defmodule ToborKit.Hologram do
  @moduledoc """
  Native Elixir Hologram mirrors of the tobor-kit Lit web components
  (`web/src/components/`).

  Phase 1 covers the 38 presentational components; phase 2 adds 8
  server-coupled mirrors (commands + HostConfig scopes). Every mirror renders
  a light-DOM root `<div class="tk tk-<name>">`
  and styles itself exclusively through `assets/css/tobor-kit.css` tokens.

  See `docs/PORTING.md` for the frozen Lit-to-Hologram interface contract and
  `docs/THEMING.md` for the token translation table.
  """

  alias ToborKit.Hologram.Artifact
  alias ToborKit.Hologram.Asset
  alias ToborKit.Hologram.Billing
  alias ToborKit.Hologram.ChatThread
  alias ToborKit.Hologram.Configurator.Playground, as: Configurator
  alias ToborKit.Hologram.Cookie
  alias ToborKit.Hologram.Faq
  alias ToborKit.Hologram.FooterBrand
  alias ToborKit.Hologram.GuidePanel.Panel, as: GuidePanel
  alias ToborKit.Hologram.LoginFlow.Flow, as: LoginFlow
  alias ToborKit.Hologram.LlmInference.Settings, as: LlmInferenceSettings
  alias ToborKit.Hologram.Mcp
  alias ToborKit.Hologram.ModeToggle
  alias ToborKit.Hologram.ModelConfig.Config, as: ModelConfig
  alias ToborKit.Hologram.Npl
  alias ToborKit.Hologram.PartyCard
  alias ToborKit.Hologram.Persona
  alias ToborKit.Hologram.PhoneInput
  alias ToborKit.Hologram.PlanCompare
  alias ToborKit.Hologram.Prompt
  alias ToborKit.Hologram.Review
  alias ToborKit.Hologram.RobotAvatar
  alias ToborKit.Hologram.Sg
  alias ToborKit.Hologram.SubscriptionGate.Gate, as: SubscriptionGate
  alias ToborKit.Hologram.Support.Classes
  alias ToborKit.Hologram.Support.Theme
  alias ToborKit.Hologram.TaskMenu
  alias ToborKit.Hologram.Telemetry.Toggle, as: Telemetry
  alias ToborKit.Hologram.ToolList
  alias ToborKit.Hologram.TranscriptView
  alias ToborKit.Hologram.Waitlist.Form, as: Waitlist
  alias ToborKit.Hologram.Wiki

  @doc """
  Tag index: Lit custom-element tag (keys of `web/registry.yaml`) to mirror
  module. All 38 presentational tags (phase 1) plus 8 server-coupled tags
  (phase 2) plus the footer-brand island across 31 families.
  """
  @tag_index %{
    "noizu-footer-brand" => FooterBrand.Brand,
    "noizu-sg-btn" => Sg.Btn,
    "noizu-sg-card" => Sg.Card,
    "noizu-sg-card-grid" => Sg.CardGrid,
    "noizu-sg-status" => Sg.Status,
    "noizu-sg-input" => Sg.Input,
    "noizu-sg-spec-table" => Sg.SpecTable,
    "noizu-sg-steps" => Sg.Steps,
    "noizu-billing-status" => Billing.Status,
    "tobor-mode-toggle" => ModeToggle.Toggle,
    "tobor-robot-avatar" => RobotAvatar.Avatar,
    "noizu-phone-input" => PhoneInput.Input,
    "noizu-cookie-consent" => Cookie.CookieConsent,
    "noizu-cookie-settings" => Cookie.CookieSettings,
    "noizu-faq" => Faq.Faq,
    "tobor-party-card" => PartyCard.Card,
    "tobor-agent-card" => PartyCard.AgentCard,
    "tobor-user-card" => PartyCard.UserCard,
    "tobor-persona-card" => Persona.PersonaCard,
    "tobor-persona-picker" => Persona.Picker,
    "tobor-task-menu" => TaskMenu.Menu,
    "tobor-tool-list" => ToolList.List,
    "tobor-mcp-clients" => Mcp.Clients,
    "tobor-mcp-domain" => Mcp.Domain,
    "noizu-plan-compare" => PlanCompare.Compare,
    "tobor-prompt-library" => Prompt.Library,
    "tobor-prompt-history" => Prompt.History,
    "tobor-npl-view" => Npl.View,
    "tobor-transcript-view" => TranscriptView.View,
    "tobor-chat-thread" => ChatThread.Thread,
    "tobor-asset-view" => Asset.View,
    "tobor-asset-editor" => Asset.Editor,
    "tobor-artifact-view" => Artifact.View,
    "tobor-artifact-editor" => Artifact.Editor,
    "tobor-wiki-space" => Wiki.Space,
    "tobor-wiki-entry" => Wiki.Entry,
    "tobor-wiki-entry-editor" => Wiki.EntryEditor,
    "tobor-review-panel" => Review.Panel,
    "tobor-mcp-config" => Mcp.Config,
    "tobor-telemetry-toggle" => Telemetry,
    "noizu-model-config" => ModelConfig,
    "tobor-configurator" => Configurator,
    "noizu-waitlist" => Waitlist,
    "noizu-subscription-gate" => SubscriptionGate,
    "tobor-guide-panel" => GuidePanel,
    "tobor-login-flow" => LoginFlow,
    "tobor-llm-inference" => LlmInferenceSettings
  }

  @spec tag_index :: %{optional(String.t()) => module}
  def tag_index, do: @tag_index

  @doc "Shared class-string builder (`ToborKit.Hologram.Support.Classes`)."
  defdelegate classes(base, extras), to: Classes

  @doc "Guide-projection `ui.theme` map to inline style-attr string (`ToborKit.Hologram.Support.Theme`)."
  defdelegate apply_theme_vars(theme, defaults), to: Theme

  @doc "See `ToborKit.Hologram.Support.Theme.apply_theme_vars/2`."
  defdelegate apply_theme_vars(theme), to: Theme
end
