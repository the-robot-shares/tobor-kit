// Command tobor-kit-go serves the tobor-kit Guide API from a frozen bundle
// and a guide-definition YAML.
package main

import (
	"context"
	"errors"
	"flag"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.26.0"
	"go.opentelemetry.io/otel/trace"
	"gopkg.in/yaml.v3"

	"github.com/the-robot-lives/tobor-kit/go/internal/bundle"
	"github.com/the-robot-lives/tobor-kit/go/internal/guide"
	"github.com/the-robot-lives/tobor-kit/go/internal/mcp"
	"github.com/the-robot-lives/tobor-kit/go/internal/server"
	"github.com/the-robot-lives/tobor-kit/go/internal/session"
	"github.com/the-robot-lives/tobor-kit/go/internal/telemetry"
	"github.com/the-robot-lives/tobor-kit/go/internal/turn"
)

func main() {
	policyPath := flag.String("policy", "config/policy.example.yaml", "runtime policy YAML")
	addr := flag.String("addr", "", "listen address (overrides policy)")
	guidePath := flag.String("guide", "", "guide-definition YAML (overrides policy)")
	bundlePath := flag.String("bundle", "", "frozen bundle JSON (overrides policy)")
	otelEndpoint := flag.String("otel-endpoint", os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT"), "OTLP trace endpoint (empty = noop tracer)")
	flag.Parse()

	pol, err := loadPolicy(*policyPath)
	if err != nil {
		log.Fatalf("policy: %v", err)
	}
	if *addr != "" {
		pol.Server.Addr = *addr
	}
	if *guidePath != "" {
		pol.Guide.GuidePath = *guidePath
	}
	if *bundlePath != "" {
		pol.Guide.BundlePath = *bundlePath
	}
	if *otelEndpoint == "" {
		*otelEndpoint = pol.Telemetry.OTLPEndpoint
	}

	g, err := guide.LoadFile(pol.Guide.GuidePath)
	if err != nil {
		log.Fatalf("guide: %v", err)
	}
	b, err := bundle.LoadFile(pol.Guide.BundlePath)
	if err != nil {
		log.Fatalf("bundle: %v", err)
	}

	var tracer trace.Tracer // nil = noop
	if *otelEndpoint != "" {
		tp, err := newTracerProvider(*otelEndpoint, g.Telemetry.ServiceName)
		if err != nil {
			log.Fatalf("otel: %v", err)
		}
		defer func() { _ = tp.Shutdown(context.Background()) }()
		tracer = tp.Tracer(g.Telemetry.ServiceName)
	}

	// Real MCP transport is the Elixir lane's integration job this pass; the
	// fake client serves an empty inventory for local runs.
	mcpClient := mcp.NewFake(map[string][]mcp.RawTool{}, nil)

	svc := server.New(server.Config{
		Guide:     g,
		Bundle:    b,
		Tracer:    tracer,
		Sessions:  session.NewStore(pol.Sessions.ReplayRetain),
		Runner:    turn.ScriptedRunner{},
		Inventory: &mcp.Builder{Guide: g, Client: mcpClient, Cache: mcp.NewCache(pol.MCP.CacheTTL)},
		Telemetry: telemetry.New(g, telemetry.NewMemoryPreferences()),
	})

	log.Printf("tobor-kit-go listening on %s (guide %q bundle %s)", pol.Server.Addr, g.Slug(), b.Hash)
	log.Fatal(http.ListenAndServe(pol.Server.Addr, svc))
}

// policy mirrors config/policy.example.yaml.
type policy struct {
	Server struct {
		Addr string `yaml:"addr"`
	} `yaml:"server"`
	Guide struct {
		GuidePath  string `yaml:"guide_path"`
		BundlePath string `yaml:"bundle_path"`
	} `yaml:"guide"`
	Telemetry struct {
		OTLPEndpoint string `yaml:"otlp_endpoint"`
	} `yaml:"telemetry"`
	MCP struct {
		CacheTTL time.Duration `yaml:"cache_ttl"`
	} `yaml:"mcp"`
	Voice struct {
		TokenTTL time.Duration `yaml:"token_ttl"`
	} `yaml:"voice"`
	Sessions struct {
		ReplayRetain int `yaml:"replay_retain"`
	} `yaml:"sessions"`
}

func loadPolicy(path string) (*policy, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var p policy
	if err := yaml.Unmarshal(raw, &p); err != nil {
		return nil, err
	}
	if p.Server.Addr == "" {
		p.Server.Addr = ":8080"
	}
	if p.Guide.GuidePath == "" || p.Guide.BundlePath == "" {
		return nil, errors.New("guide.guide_path and guide.bundle_path are required")
	}
	if p.MCP.CacheTTL == 0 {
		p.MCP.CacheTTL = time.Minute
	}
	if p.Voice.TokenTTL == 0 {
		p.Voice.TokenTTL = 5 * time.Minute
	}
	return &p, nil
}

func newTracerProvider(endpoint, serviceName string) (*sdktrace.TracerProvider, error) {
	opts := []otlptracegrpc.Option{otlptracegrpc.WithEndpoint(endpoint)}
	if !strings.Contains(endpoint, "443") && !strings.HasPrefix(endpoint, "https") {
		opts = append(opts, otlptracegrpc.WithInsecure())
	}
	exp, err := otlptracegrpc.New(context.Background(), opts...)
	if err != nil {
		return nil, err
	}
	res, err := resource.New(context.Background(), resource.WithAttributes(semconv.ServiceName(serviceName)))
	if err != nil {
		return nil, err
	}
	tp := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exp),
		sdktrace.WithResource(res),
	)
	otel.SetTracerProvider(tp)
	return tp, nil
}
