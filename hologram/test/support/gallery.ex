defmodule ToborKit.Hologram.TestSupport.Gallery do
  @moduledoc """
  Test-scope gallery page: one section per planned family, appended by each
  wave. Wave 0 rendered the placeholder + transpiler-spike fixtures; wave 1
  adds the styleguide/billing/mode-toggle/robot-avatar/phone-input/cookie/faq
  mirrors; wave 2 adds the party-card and persona families; wave 3 adds the
  selection-list + config families (task-menu, tool-list, mcp, plan-compare,
  prompt); wave 4 adds the composed content views (npl, transcript,
  chat-thread, asset, artifact, wiki, review-panel, mcp-config).

  Wave-3 fixtures pass STRING-keyed map props on purpose — that is what
  template-passed literals look like (PORTING.md §6.2), so the sections
  double as normalization coverage.
  """

  use Hologram.Page

  alias ToborKit.Hologram.Artifact.Editor, as: ArtifactEditor
  alias ToborKit.Hologram.Artifact.View, as: ArtifactView
  alias ToborKit.Hologram.Asset.Editor, as: AssetEditor
  alias ToborKit.Hologram.Asset.View, as: AssetView
  alias ToborKit.Hologram.Billing.Status, as: BillingStatus
  alias ToborKit.Hologram.ChatThread.Thread
  alias ToborKit.Hologram.Configurator.Playground, as: Configurator
  alias ToborKit.Hologram.Cookie.CookieConsent
  alias ToborKit.Hologram.Cookie.CookieSettings
  alias ToborKit.Hologram.Faq.Faq
  alias ToborKit.Hologram.FooterBrand.Brand, as: FooterBrand
  alias ToborKit.Hologram.GuidePanel.Panel, as: GuidePanel
  alias ToborKit.Hologram.LoginFlow.Flow, as: LoginFlow
  alias ToborKit.Hologram.LlmInference.Settings, as: LlmInference
  alias ToborKit.Hologram.Mcp.Clients
  alias ToborKit.Hologram.Mcp.Config, as: McpConfig
  alias ToborKit.Hologram.Mcp.Domain
  alias ToborKit.Hologram.ModeToggle.Toggle, as: ModeToggle
  alias ToborKit.Hologram.ModelConfig.Config, as: ModelConfig
  alias ToborKit.Hologram.Npl.Tokenizer
  alias ToborKit.Hologram.Npl.View
  alias ToborKit.Hologram.PartyCard.AgentCard
  alias ToborKit.Hologram.PartyCard.Card
  alias ToborKit.Hologram.PartyCard.UserCard
  alias ToborKit.Hologram.Persona.Picker
  alias ToborKit.Hologram.Persona.PersonaCard
  alias ToborKit.Hologram.PhoneInput.Input, as: PhoneInput
  alias ToborKit.Hologram.PlanCompare.Compare
  alias ToborKit.Hologram.Prompt.History
  alias ToborKit.Hologram.Prompt.Library
  alias ToborKit.Hologram.Review.Panel, as: ReviewPanel
  alias ToborKit.Hologram.RobotAvatar.Avatar, as: RobotAvatar
  alias ToborKit.Hologram.Sg.Btn, as: SgBtn
  alias ToborKit.Hologram.Sg.Card, as: SgCard
  alias ToborKit.Hologram.Sg.CardGrid, as: SgCardGrid
  alias ToborKit.Hologram.Sg.Input, as: SgInput
  alias ToborKit.Hologram.Sg.SpecTable, as: SgSpecTable
  alias ToborKit.Hologram.Sg.Status, as: SgStatus
  alias ToborKit.Hologram.Sg.Steps, as: SgSteps
  alias ToborKit.Hologram.SubscriptionGate.Gate, as: SubscriptionGate
  alias ToborKit.Hologram.TaskMenu.Menu
  alias ToborKit.Hologram.TestSupport.Layout
  alias ToborKit.Hologram.TestSupport.Placeholder
  alias ToborKit.Hologram.TestSupport.Spike
  alias ToborKit.Hologram.ToolList.List
  alias ToborKit.Hologram.TranscriptView.View, as: TranscriptView
  alias ToborKit.Hologram.Telemetry.Toggle, as: Telemetry
  alias ToborKit.Hologram.Waitlist.Form, as: Waitlist
  alias ToborKit.Hologram.Wiki.Entry, as: WikiEntry
  alias ToborKit.Hologram.Wiki.EntryEditor, as: WikiEntryEditor
  alias ToborKit.Hologram.Wiki.Space, as: WikiSpace

  route "/gallery"
  layout Layout, page_title: "tobor-kit Hologram gallery"

  def init(_params, component, _server) do
    put_state(component,
      items: ["alpha", "42", "beta"],
      config: %{"item_cy_prefix" => "gallery.placeholder.item"},
      spike_value: " +1 (415) 555-0100 x99 ",
      spec_rows: [
        %{"key" => "Model", "value" => "guide-1"},
        %{"key" => "Escape", "value" => "<b>bold</b> & \"quoted\""},
        nil,
        "bare row"
      ],
      step_labels: ["Connect", "Configure", "Launch"],
      subscription: %{
        "status" => "past_due",
        "plan_name" => "Studio",
        "trial_ends_at" => "2026-01-02T03:04:05Z",
        "renews_at" => "2026-02-03T04:05:06Z"
      },
      consent: %{
        "version" => 1,
        "categories" => %{"necessary" => true, "analytics" => true, "marketing" => false}
      },
      faq_items: [
        %{"question" => "What is tobor-kit?", "answer" => "An agent-guide component kit."},
        %{"question" => "Second question?", "answer" => "The second answer."}
      ],
      sprite_avatar: %{
        "default" => %{"src" => "https://cdn.example.com/robot.png", "columns" => 2, "rows" => 1}
      },
      unsafe_avatar: %{"default" => %{"src" => "javascript:alert(1)"}},
      personas: [
        %{"id" => "sheggoth", "name" => "Sheggoth", "handle" => "@sheggoth"},
        %{"id" => "mask", "name" => "The Mask", "handle" => "@mask"},
        %{"id" => "weego", "name" => "Weego", "handle" => "@weego"}
      ],
      picker_query: "wee",
      tool_inventory: %{
        "groups" => [
          %{"id" => "github", "label" => "Github"},
          %{"id" => "files", "label" => "Filesystem"}
        ],
        "tools" => [
          %{"name" => "Github.PullCreate", "label" => "Open a PR", "group" => "github",
           "confirm" => true},
          %{"name" => "Github.IssueList", "label" => "List issues", "group" => "github",
           "read_only" => true, "description" => "List repository issues"},
          %{"name" => "Filesystem.Write", "label" => "Write a file", "group" => "files"}
        ],
        "degraded" => [%{"server" => "search", "error" => "timeout"}]
      },
      empty_inventory: %{"groups" => [], "tools" => [], "degraded" => []},
      mcp_clients: [
        %{"id" => "github", "name" => "GitHub", "status" => "disconnected", "auth" => "oauth"},
        %{"id" => "search", "name" => "Search", "status" => "Connected", "auth" => "api-key"}
      ],
      domain_tools: [
        %{"name" => "Github.PullCreate", "visibility" => "visible"},
        %{"name" => "Github.IssueList", "visibility" => "discoverable"},
        %{"name" => "Filesystem.Write", "visibility" => "disabled"}
      ],
      plans: [
        %{"id" => "free", "name" => "Free", "priceMonthly" => 0, "priceYearly" => 0,
         "features" => ["1 agent", "Community support"]},
        %{"id" => "pro", "name" => "Pro", "priceMonthly" => 20, "priceYearly" => "Two hundred dollars",
         "features" => ["10 agents", "Priority support", "Voice"], "ctaLabel" => "Go Pro",
         "highlighted" => true}
      ],
      prompts: [
        %{"id" => "sys", "title" => "System",
         "body" => "You are a helpful assistant.\n<section>stays source</section>",
         "starred" => true},
        %{"id" => "brief", "title" => "Brief", "body" => "Be concise.\nNo HTML."}
      ],
      history_entries: [
        %{"id" => "sys-v1", "title" => "System", "at" => "2026-01-01T12:00:00Z", "version" => 1},
        %{"id" => "sys-v2", "title" => "System", "at" => "2026-02-01T12:00:00Z", "version" => 2,
         "starred" => true}
      ],
      prompt_diff: %{
        "left" => %{"label" => "v1", "body" => "You are a helpful assistant."},
        "right" => %{"label" => "v2", "body" => "You are a concise assistant."}
      },
      checkout_template: "https://checkout.example.com/c/{planId}?src=gallery",
      # npl-view
      npl_source: Tokenizer.sample_source(),
      npl_empty: "   ",
      # transcript-view / chat-thread
      transcript_turns: [
        %{id: "t1", role: "user", content: "Hello guide", created_at: ""},
        %{
          id: "t2",
          role: "assistant",
          content: "Working on it",
          created_at: "",
          tool_calls: [%{id: "c1", name: "search", ok: true, summary: "3 hits"}]
        },
        %{id: "t3", role: "system", content: "session started", created_at: ""}
      ],
      transcript_load: %{"status" => "not_server_backed"},
      thread_messages: [
        %{id: "m1", role: "user", text: "first message", at: "2026-09-15T10:30:00Z", participant: "u1"},
        %{id: "m2", role: "assistant", text: "<b>not</b> html", at: "bogus", participant: "u2"}
      ],
      thread_participants: [
        %{id: "u1", name: "Keith"},
        %{id: "u2", name: "Guide"}
      ],
      # asset
      asset_image: %{id: "a1", name: "logo.png", mime: "image/png", src: "https://example.test/logo.png"},
      asset_text: %{id: "a2", name: "notes.txt", mime: "text/plain", body: "keep\nthis text"},
      asset_other: %{id: "a3", name: "blob.bin", mime: "application/octet-stream", src: "https://example.test/blob.bin"},
      asset_none: nil,
      asset_edit: %{id: "a2", name: "notes.txt", mime: "text/plain", body: "editable body"},
      # artifact
      artifact: %{id: "demo", title: "Release notes", version: 1, body: "Ship the island.\nDo not render HTML.", mime: "text/plain"},
      artifact_none: nil,
      # wiki
      wiki_spaces: [%{id: "eng", title: "Engineering", slug: "eng"}, %{id: "ops", title: "Ops"}],
      wiki_selected: "eng",
      wiki_entry: %{id: "eng-readme", title: "README", body: "Ship the island.\n<section>stays source</section>", spaceId: "eng"},
      # review panel
      reviews: [
        %{id: "r1", author: "Keith", body: "first pass", at: "2026-09-15T10:30:00Z", status: "open"},
        %{id: "r2", author: "Guide", body: "done", at: "bogus-stamp", status: "resolved"}
      ],
      # mcp config
      mcp_url: "https://mcp.example.test/mcp",
      mcp_transport: "http",
      mcp_extras: %{"timeoutMs" => 5_000},
      # == BEGIN p2 group A (telemetry/model-config/configurator/waitlist/gate) ==
      telemetry_consent: %{
        "enabled" => true,
        "source" => "user",
        "user_overridable" => true
      },
      model_catalog: [
        %{"provider" => "openai", "model" => "gpt-5", "label" => "GPT-5"},
        %{"provider" => "noizu", "model" => "fable", "spec" => "noizu:fable"}
      ],
      cfg_schema: %{
        "tag" => "noizu-widget",
        "fields" => [
          %{"attr" => "name", "type" => "string", "required" => true,
           "placeholder" => "Widget name"},
          %{"attr" => "enabled", "type" => "boolean", "default" => true},
          %{"attr" => "size", "type" => "number"},
          %{"attr" => "variant", "type" => "select", "options" => ["cards", "rows"]},
          %{"attr" => "tags", "type" => "tag-list"},
          %{"attr" => "notes", "type" => "text"},
          %{"attr" => "meta", "type" => "json", "propertyOnly" => true}
        ],
        "slots" => ["header"]
      },
      gate_redirect: "/pricing",
      # == END p2 group A ==

      # p2 group B: login-flow / guide-panel / llm-inference
      login_auth: %{
        "provider" => "oidc",
        "issuer" => "https://auth.example.test",
        "client_id" => "gallery-client",
        "scopes" => ["openid", "email", "profile"],
        "redirect_path" => "/auth/oidc/callback"
      },
      login_auth_off: %{"provider" => "none"},
      guide_projection: %{
        "slug" => "gallery",
        "name" => "Gallery Guide",
        "title" => "Phase 2 flow mirror",
        "greeting" => "Ask me about the gallery.",
        "modes" => ["voice", "text", "transcript"],
        "default_mode" => "text",
        "ui" => %{
          "panel" => %{"start_expanded" => true},
          "robot" => %{"renderer" => "glyph"}
        }
      },
      guide_projection_voice: %{
        "slug" => "gallery-voice",
        "name" => "Voice Guide",
        "modes" => ["voice", "text"],
        "default_mode" => "voice",
        "ui" => %{"panel" => %{"start_expanded" => true}}
      },
      llm_config: %{"providerID" => "zai", "model" => "glm-5.3-flash", "baseURL" => "https://api.z.ai/api/coding/paas/v4"},
      llm_transport: "Elixir.ToborKit.Hologram.TestSupport.LlmTransportStub",
      llm_media_catalog: [
        %{
          id: "openai",
          label: "OpenAI",
          group: "cloud",
          api_shape: "openai",
          default_base_url: "https://api.openai.com/v1",
          base_url_placeholder: nil,
          env_var_name: "OPENAI_API_KEY",
          requires_key: true,
          default_model: "gpt-4o",
          modalities: ["text", "image"]
        },
        %{
          id: "suno",
          label: "Suno",
          group: "cloud",
          api_shape: "openai",
          default_base_url: "https://api.suno.ai/v1",
          base_url_placeholder: nil,
          env_var_name: "SUNO_API_KEY",
          requires_key: true,
          default_model: "v6",
          modalities: ["audio"]
        },
        %{
          id: "runway",
          label: "Runway",
          group: "advanced",
          api_shape: "openai",
          default_base_url: nil,
          base_url_placeholder: "https://api.runwayml.com/v1",
          env_var_name: nil,
          requires_key: true,
          default_model: "gen-4",
          modalities: ["video"]
        }
      ]
    )
  end

  def template do
    ~HOLO"""
    <main class="gallery">
      <h1>tobor-kit Hologram gallery</h1>

      <section data-cy="gallery.section.placeholder" aria-label="Wave 0 placeholder">
        <Placeholder title="Wave 0 fixture" items={@items} config={@config} />
      </section>

      <section data-cy="gallery.section.spike" aria-label="Transpiler spike">
        <Spike cid="gallery-spike" value={@spike_value} target="page" />
      </section>

      <section data-cy="gallery.section.sg" aria-label="Styleguide mirrors">
        <SgBtn>Primary</SgBtn>
        <SgBtn variant="secondary" size="lg">Secondary lg</SgBtn>
        <SgBtn variant="danger" type="submit" disabled={true}>Danger submit</SgBtn>
        <SgBtn variant="bogus">Clamps to primary</SgBtn>
        <SgCard href="https://example.com/card" header="Card header" footer="Card footer">
          Card body slot
        </SgCard>
        <SgCard header="Plain card" footer="No href" />
        <SgCardGrid columns={2}>
          <SgCard header="Grid card 1" />
          <SgCard header="Grid card 2" />
        </SgCardGrid>
        <SgStatus status="ok" label="Operational" description="All systems nominal" />
        <SgStatus status="bogus" label="Clamps to idle" />
        <SgInput name="email" type="email" value="a@b.c" error={true} />
        <SgInput name="bio" type="textarea" value="Line one" />
        <SgSpecTable rows={@spec_rows} />
        <SgSteps steps={@step_labels} current={1} />
      </section>

      <section data-cy="gallery.section.billing-status" aria-label="Billing status mirror">
        <BillingStatus subscription={@subscription} />
        <BillingStatus />
      </section>

      <section data-cy="gallery.section.mode-toggle" aria-label="Mode toggle mirror">
        <ModeToggle cid="gallery-mode-toggle" modes={["voice", "text", "transcript"]} mode="text" target="page" />
      </section>

      <section data-cy="gallery.section.robot-avatar" aria-label="Robot avatar mirror">
        <RobotAvatar cid="gallery-robot-idle" state="idle" />
        <RobotAvatar cid="gallery-robot-thinking" state="thinking" />
        <RobotAvatar cid="gallery-robot-error" state="error" />
        <RobotAvatar cid="gallery-robot-tool" state="tool_running" />
        <RobotAvatar cid="gallery-robot-clamped" state="dancing" reduced_motion="force_static" />
        <RobotAvatar cid="gallery-robot-sprite" renderer="sprite" avatar={@sprite_avatar} />
        <RobotAvatar cid="gallery-robot-sprite-unsafe" renderer="sprite" avatar={@unsafe_avatar} />
      </section>

      <section data-cy="gallery.section.phone-input" aria-label="Phone input mirror">
        <PhoneInput cid="gallery-phone-input" name="phone" value="+12125550123" />
      </section>

      <section data-cy="gallery.section.cookie" aria-label="Cookie mirrors">
        <CookieConsent cid="gallery-cookie-consent" />
        <CookieConsent cid="gallery-cookie-essential" mode="essential-all" consent={@consent} />
        <CookieConsent cid="gallery-cookie-settings-open" consent={@consent} settings_open={true} />
        <CookieSettings />
      </section>

      <section data-cy="gallery.section.footer-brand" aria-label="Footer brand mirror">
        <FooterBrand />
        <FooterBrand theme="light" palette="accent" prefix="Built by" suffix="Labs" href="https://noizu.com" target="_blank" />
        <FooterBrand palette="mono" align="start" />
      </section>

      <section data-cy="gallery.section.faq" aria-label="FAQ mirror">
        <Faq cid="gallery-faq" items={@faq_items} mode="one" />
        <Faq cid="gallery-faq-slot">
          <details>
            <summary>Slotted question</summary>
            Slotted answer
          </details>
        </Faq>
      </section>

      <section data-cy="gallery.section.party-card" aria-label="Wave 2 party-card family">
        <h2>party-card</h2>

        <h3>Card — presence variants</h3>
        <Card display_name="Ada Lovelace" handle="@ada" presence="online" />
        <Card display_name="Grace Hopper" handle="@grace" presence="away" />
        <Card display_name="Alan Turing" handle="@alan" presence="offline" />
        <Card display_name="Hidden Party" handle="@hidden" presence="hidden" />
        <Card display_name="Bogus Presence" handle="@bogus" presence="nonsense" />
        <Card display_name="Badge Host" handle="@badges" presence="online" badges={["admin", "beta"]} />

        <h3>AgentCard — model badge + capabilities on/off</h3>
        <AgentCard
          display_name="Tobor Guide"
          handle="@tobor"
          presence="online"
          agent_id="agent-123"
          model_badge="fable-5"
          capabilities={["search", "summarize", " translate "]}
        />
        <AgentCard
          display_name="Bare Agent"
          handle="@bare"
          presence="away"
          agent_id=""
          show_capabilities={false}
        >
          <span class="muted">host chip (default slot)</span>
        </AgentCard>

        <h3>UserCard — role/org badges</h3>
        <UserCard
          display_name="Kit ops"
          handle="@kit"
          presence="online"
          user_id="user-42"
          role="foreman"
          org="noizu"
        />
        <UserCard display_name="No badges" handle="@plain" presence="offline" user_id="" />

        <h3>PersonaCard — selectable persona</h3>
        <PersonaCard
          display_name="Weego"
          handle="@weego"
          presence="online"
          persona_id="weego"
        />
        <PersonaCard display_name="Unselectable" handle="@void" persona_id="" />
      </section>

      <section data-cy="gallery.section.persona" aria-label="Wave 2 persona family">
        <h2>persona</h2>

        <h3>Picker — stateful (cid), default roster</h3>
        <Picker cid="gallery-persona-picker" personas={@personas} />

        <h3>Picker — seeded query ("wee" filters to Weego)</h3>
        <Picker cid="gallery-persona-picker-query" personas={@personas} query={@picker_query} />

        <h3>Picker — empty roster</h3>
        <Picker cid="gallery-persona-picker-empty" personas={[]} />
      </section>

      <section data-cy="gallery.section.task-menu" aria-label="Task menu">
        <Menu cid="gallery-task-menu-closed" inventory={@tool_inventory} target="page" />
        <Menu cid="gallery-task-menu-open" inventory={@tool_inventory} open={true} target="page" />
      </section>

      <section data-cy="gallery.section.tool-list" aria-label="Tool list">
        <List cid="gallery-tool-list" inventory={@tool_inventory} target="page" />
        <List cid="gallery-tool-list-empty" inventory={@empty_inventory} target="page" />
      </section>

      <section data-cy="gallery.section.mcp-clients" aria-label="MCP clients">
        <Clients cid="gallery-mcp-clients" clients={@mcp_clients} target="page" />
      </section>

      <section data-cy="gallery.section.mcp-domain" aria-label="MCP domain visibility">
        <Domain
          cid="gallery-mcp-domain"
          tools={@domain_tools}
          inventory={@tool_inventory}
          preview_cid="gallery-mcp-domain-preview"
          target="page"
        />
      </section>

      <section data-cy="gallery.section.plan-compare" aria-label="Plan compare">
        <Compare
          cid="gallery-plan-cards"
          plans={@plans}
          billing_toggle={true}
          checkout_url_template={@checkout_template}
          target="page"
        />
        <Compare cid="gallery-plan-table" plans={@plans} layout="table" target="page" />
      </section>

      <section data-cy="gallery.section.prompt-library" aria-label="Prompt library">
        <Library cid="gallery-prompt-library" prompts={@prompts} target="page" />
      </section>

      <section data-cy="gallery.section.prompt-history" aria-label="Prompt history">
        <History
          cid="gallery-prompt-history"
          entries={@history_entries}
          diff={@prompt_diff}
          target="page"
        />
      </section>

      <section data-cy="gallery.section.npl-view" aria-label="NPL viewer">
        <View cid="gallery-npl" source={@npl_source} target="page" />
        <View cid="gallery-npl-empty" source={@npl_empty} target="page" />
      </section>

      <section data-cy="gallery.section.transcript-view" aria-label="Transcript views">
        <TranscriptView turns={@transcript_turns} pending="streaming chunk…" clearable={true} />
        <TranscriptView turns={[]} pending="" />
        <TranscriptView turns={[]} pending="" load={@transcript_load} />
      </section>

      <section data-cy="gallery.section.chat-thread" aria-label="Chat thread">
        <Thread
          cid="gallery-thread"
          messages={@thread_messages}
          participants={@thread_participants}
          pending="pending text…"
          show_composer={true}
          clearable={true}
          target="page"
        />
        <Thread cid="gallery-thread-plain" turns={@transcript_turns} />
      </section>

      <section data-cy="gallery.section.asset" aria-label="Assets">
        <AssetView asset={@asset_image} />
        <AssetView asset={@asset_text} />
        <AssetView asset={@asset_other} />
        <AssetView asset={@asset_none} />
        <AssetEditor cid="gallery-asset-editor" asset={@asset_edit} target="page" />
      </section>

      <section data-cy="gallery.section.artifact" aria-label="Artifacts">
        <ArtifactView artifact={@artifact} />
        <ArtifactView artifact={@artifact_none} />
        <ArtifactEditor cid="gallery-artifact-editor" artifact={@artifact} target="page" />
      </section>

      <section data-cy="gallery.section.wiki" aria-label="Wiki">
        <WikiSpace spaces={@wiki_spaces} selected_id={@wiki_selected} target="page" />
        <WikiEntry entry={@wiki_entry} />
        <WikiEntry entry={@artifact_none} />
        <WikiEntryEditor cid="gallery-wiki-editor" entry={@wiki_entry} target="page" />
      </section>

      <section data-cy="gallery.section.review-panel" aria-label="Review panel">
        <ReviewPanel cid="gallery-review-panel" reviews={@reviews} artifact_id="demo" target="page" />
        <ReviewPanel cid="gallery-review-panel-empty" reviews={[]} show_composer={false} target="page" />
      </section>

      <section data-cy="gallery.section.mcp-config" aria-label="MCP config">
        <McpConfig cid="gallery-mcp-config" url={@mcp_url} transport={@mcp_transport} extras={@mcp_extras} target="page" />
        <McpConfig cid="gallery-mcp-config-defaults" transport="weird" />
      </section>

      <!-- == BEGIN p2 group A (telemetry/model-config/configurator/waitlist/gate) == -->

      <section data-cy="gallery.section.telemetry-toggle" aria-label="Telemetry toggle">
        <Telemetry cid="gallery-telemetry" consent={@telemetry_consent} target="page" />
      </section>

      <section data-cy="gallery.section.model-config" aria-label="Model config">
        <ModelConfig
          cid="gallery-model-config"
          catalog={@model_catalog}
          value="openai:gpt-5"
          inherit={true}
          allow_custom={true}
          allow_budget={true}
          budget={25.0}
          target="page"
        />
      </section>

      <section data-cy="gallery.section.configurator" aria-label="Configurator">
        <Configurator cid="gallery-configurator" schema={@cfg_schema} target="page" />
      </section>

      <section data-cy="gallery.section.waitlist" aria-label="Waitlist">
        <Waitlist cid="gallery-waitlist" slug="gallery-demo" target="page" />
      </section>

      <section data-cy="gallery.section.subscription-gate" aria-label="Subscription gate">
        <SubscriptionGate cid="gallery-gate-open" entitled={true} target="page">
          <p>Entitled content (default slot)</p>
        </SubscriptionGate>
        <SubscriptionGate cid="gallery-gate-blocked" entitled={false} redirect_to={@gate_redirect} target="page" />
      </section>

      <!-- == END p2 group A == -->

      <section data-cy="gallery.section.login-flow" aria-label="Login flow (p2 group B)">
        <LoginFlow cid="gallery-login-flow" auth={@login_auth} auto_redirect={false} target="page" />
        <LoginFlow cid="gallery-login-flow-off" auth={@login_auth_off} />
      </section>

      <section data-cy="gallery.section.guide-panel" aria-label="Guide panel (p2 group B)">
        <GuidePanel cid="gallery-guide-panel" guide={@guide_projection} placement="inline" target="page" />
        <GuidePanel cid="gallery-guide-panel-voice" guide={@guide_projection_voice} placement="inline" target="page" />
        <GuidePanel cid="gallery-guide-panel-loading" />
      </section>

      <section data-cy="gallery.section.llm-inference" aria-label="LLM inference (p2 group B)">
        <LlmInference
          cid="gallery-llm-inference"
          config={@llm_config}
          transport={@llm_transport}
          target="page"
        />
        <LlmInference cid="gallery-llm-inference-none" />
        <LlmInference
          cid="gallery-llm-inference-media"
          providers={@llm_media_catalog}
          section_by="modality"
        />
      </section>
    </main>
    """
  end
end
