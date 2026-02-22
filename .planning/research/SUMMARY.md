# Project Research Summary

**Project:** ZoomBG - AI-Powered Zoom Background Generator
**Domain:** CLI tool with AI service integration and macOS system integration
**Researched:** 2026-02-21
**Confidence:** HIGH

## Executive Summary

This is a purpose-built macOS CLI tool that generates Zoom virtual backgrounds using AI image services. Expert implementations of similar tools follow a service abstraction pattern with multiple AI providers (free and paid), a browser-based preview/approval workflow, and direct file system integration with the target application. The recommended approach uses Node.js with TypeScript for strong API typing, Commander.js for CLI structure, and a multi-service architecture starting with Hugging Face's free tier as the default.

The core technical challenge is coordinating asynchronous operations across multiple domains: AI API calls with variable response times (15-90s), browser-based user interaction with approval flow, and atomic file operations in Zoom's undocumented directory structure. Success requires robust error handling for API rate limits, careful file write patterns to avoid race conditions, and thorough process cleanup to prevent resource leaks from browser instances.

Key risks include API key security (plain text storage requires strict file permissions), Zoom directory structure changes breaking hardcoded paths (mitigated with dynamic path discovery), and rate limit exhaustion on free tier services (requires exponential backoff and user feedback). Early architecture decisions around service abstraction and orchestration patterns are critical - retrofitting these after launch creates breaking changes for users.

## Key Findings

### Recommended Stack

Node.js 18+ with TypeScript provides the ideal foundation, offering native async support for API calls, excellent CLI tooling ecosystem, and strong typing for complex AI SDK integrations. The stack requires ESM modules due to modern CLI libraries (chalk, ora) which simplifies the codebase but requires `"type": "module"` in package.json.

**Core technologies:**
- **Node.js 18+ with TypeScript**: Runtime with native async, excellent ecosystem for CLI tools, strong typing catches API errors at compile time
- **Commander.js v14**: Industry standard CLI framework with 28k+ stars, simple declarative API, built-in help generation
- **@inquirer/prompts v8**: Modern interactive prompt library with tree-shaking support for approval flow and iterative refinement
- **conf v15**: Configuration management with atomic writes, JSON schema validation, platform-aware storage paths
- **@huggingface/inference v4**: Hugging Face API client supporting free tier text-to-image, no API key required for basic models
- **openai v6**: OpenAI DALL-E 3 integration with excellent TypeScript types, premium option for quality generations
- **axios v1**: HTTP client for Stability AI REST API (no official SDK), robust error handling for API integration

### Expected Features

The feature research identifies a clear MVP focused on the core generate-preview-approve-save workflow, with multi-service support and advanced options deferred to post-launch.

**Must have (table stakes):**
- Text prompt input via CLI argument
- Image generation from at least one AI service
- Browser-based preview with HTML rendering
- Explicit approval flow (Y/N prompt)
- Iterative refinement on rejection
- Zoom verification before generation
- Automatic installation to Zoom backgrounds directory
- Progress feedback during generation
- Clear error handling and help documentation

**Should have (competitive advantages):**
- Multi-service support with free tier default (Hugging Face free, DALL-E/Stability paid)
- Service preference memory in config
- Non-interactive mode for scripting
- Dry-run mode for testing
- Verbose logging for debugging

**Defer (v2+):**
- Prompt templates and presets (unclear which are valuable until usage data)
- Image history/gallery (scope creep, storage complexity)
- Multi-platform support (validate macOS first)
- Integration with other video platforms (validate Zoom first)
- Background scheduling (unclear user demand)

### Architecture Approach

The architecture follows a layered service-oriented pattern with clear separation between CLI interface, business logic services, workflow orchestration, and platform adapters. This enables independent testing of each component and easy addition of new AI providers without touching orchestration logic.

**Major components:**
1. **CLI Interface Layer** - Command parsing and user interaction via Commander.js, thin wrapper over orchestrator
2. **Service Layer** - Independent modules for AI services (factory pattern), Zoom integration (verifier + background manager), browser preview (HTML generator + launcher), config management (atomic storage)
3. **Service Orchestrator** - Coordinates the generate→preview→approve→save workflow with state transitions, handles iterative refinement loops
4. **Platform Adapters** - Abstract macOS-specific operations (file paths, process spawning), enables future cross-platform support
5. **Persistence Layer** - File I/O with atomic operations, temporary file management, config storage with proper permissions

**Critical patterns:**
- Service Adapter (Strategy Pattern) for multiple AI providers behind unified interface
- Atomic Configuration with schema validation to prevent corruption
- Error Wrapping with Context for user-friendly messages from API failures
- Orchestrator delegates to specialized services, stays under 100 lines

### Critical Pitfalls

Research identified 7 critical pitfalls that must be addressed in Phase 1 architecture - these cannot be retrofitted without breaking changes.

1. **Plain Text API Key Storage Without Warnings** - Config files must be created with 0600 permissions immediately, display security warnings on setup, support environment variable overrides. Never acceptable to defer this.

2. **Ignoring AI Service Rate Limits** - Implement exponential backoff for 429 errors (start 2s, max 32s), translate rate limit responses to user-friendly wait times, cap regeneration attempts per session to prevent quota exhaustion.

3. **Zoom Directory Structure Assumptions** - Never hardcode `~/Library/Application Support/zoom.us/data/VirtualBkgnd_Custom` - search dynamically for multiple possible directory names, validate existence and writability before operations, check Zoom app bundle exists.

4. **Browser Process Zombie Proliferation** - Register cleanup handlers for SIGINT/SIGTERM/exit immediately, delete temporary HTML files after approval/rejection, set 5-minute timeout on user approval with auto-cleanup.

5. **Race Condition Between File Write and Zoom Read** - Always write to temp location first, then atomic rename into Zoom directory, verify file integrity after write, never stream directly to final destination.

6. **Image Generation Timeout Assumptions** - Set service-specific timeouts (HuggingFace free: 120s, DALL-E: 60s, Stability: 90s), show progress indicators with expected wait times, catch timeout errors specifically with actionable guidance.

7. **Prompt Injection and Content Policy Violations** - Translate content policy errors (400/403) to user-friendly messages explaining violation categories, provide prompt guidelines in help text, suggest alternative phrasing on rejections.

## Implications for Roadmap

Based on research, suggested phase structure follows dependency order: foundation first (services can fail independently), orchestration second (requires completed services), polish third (enhances working tool).

### Phase 1: Foundation & Core Services
**Rationale:** All services must exist before orchestration can coordinate them. Build independently testable components that don't depend on each other. This phase establishes security patterns (config permissions), error handling patterns (API error translation), and file operation patterns (atomic writes) that would be breaking changes to add later.

**Delivers:**
- Config store with secure API key storage (0600 permissions, schema validation)
- AI service abstraction with Hugging Face implementation (free tier, no API key required)
- Zoom verifier with dynamic path discovery (checks multiple directory names)
- Error wrapper classes for user-friendly messages
- Platform utilities for macOS-specific operations

**Addresses:**
- FEATURES: API key management, error handling, help documentation
- STACK: conf, @huggingface/inference, Node.js fs promises for async operations
- ARCHITECTURE: Platform Adapters Layer, Service Layer foundations

**Avoids:**
- PITFALL 1: Secure config file creation from day one
- PITFALL 3: Dynamic Zoom path discovery, not hardcoded
- PITFALL 7: Error translation patterns established

### Phase 2: Workflow Orchestration
**Rationale:** With services complete, build the coordinator that strings them together. This phase implements the core user journey: generate→preview→approve→save. The orchestrator pattern keeps this logic in one testable place while services remain decoupled.

**Delivers:**
- Workflow orchestrator coordinating service calls
- Browser preview generator with HTML templates
- Browser launcher with process tracking and cleanup
- Approval flow with user prompts (Y/N and modification prompts)
- Iterative refinement loop on rejection
- Signal handlers for graceful cleanup (SIGINT/SIGTERM/exit)

**Addresses:**
- FEATURES: Browser preview, approval flow, iterative refinement, progress feedback
- STACK: @inquirer/prompts for interactive input, open for browser launching, ora for spinners
- ARCHITECTURE: Service Orchestrator, Browser Preview components

**Avoids:**
- PITFALL 4: Process cleanup handlers registered at orchestrator level
- PITFALL 5: Atomic file write pattern in Zoom background save
- PITFALL 6: Service-specific timeouts configured, progress indicators shown

### Phase 3: CLI Interface
**Rationale:** With working orchestration, wrap it in a command-line interface. CLI is deliberately last because it's a thin layer - most testing happens at orchestrator level. This phase focuses on argument parsing, validation, and user-facing help documentation.

**Delivers:**
- Commander.js command structure (`generate`, `config` commands)
- Argument validation and sanitization
- Help documentation with examples
- Version information and usage instructions
- Entry point script with shebang for global installation

**Addresses:**
- FEATURES: Text prompt input, help documentation, output location indication
- STACK: commander, chalk for styled output
- ARCHITECTURE: CLI Interface Layer

**Avoids:**
- PITFALL 2: Rate limit feedback surfaced to user via CLI messages
- PITFALL 6: Timeout guidance in help text
- PITFALL 7: Prompt guidelines in help text

### Phase 4: Multi-Service Support
**Rationale:** With working single-service tool, add paid AI providers. This validates the service abstraction pattern - if adding DALL-E and Stability is easy, the architecture is sound. Deferred from Phase 1 because Hugging Face free tier proves the concept without requiring API keys.

**Delivers:**
- DALL-E 3 service implementation (OpenAI SDK)
- Stability AI service implementation (REST API via axios)
- Service factory with provider selection logic
- Service preference memory in config
- `--service` flag for provider selection

**Addresses:**
- FEATURES: Multi-service support, service preference memory
- STACK: openai SDK, axios for REST calls
- ARCHITECTURE: AI Service Factory, Strategy Pattern validation

**Avoids:**
- PITFALL 2: Rate limit handling extended to paid services
- PITFALL 6: Service-specific timeouts for each provider

### Phase 5: Enhancement & Polish
**Rationale:** Tool works end-to-end; now add quality-of-life features that weren't essential for MVP. These features improve UX but aren't required to validate the core concept.

**Delivers:**
- Non-interactive mode (`--no-input` flag for scripting)
- Dry-run mode (`--dry-run` to preview without executing)
- Verbose logging (`--verbose` for debugging)
- Regeneration limit warning (cap at 10, warn about costs)
- Zoom format validation (24-bit PNG/JPG, 1280x720 minimum)
- Cleanup command for orphaned resources

**Addresses:**
- FEATURES: Non-interactive mode, dry-run mode, verbose logging, graceful degradation
- ARCHITECTURE: Enhanced error handling, validation layers

**Avoids:**
- PITFALL 2: Regeneration limits prevent quota exhaustion
- PITFALL 7: Format validation catches issues before submission

### Phase Ordering Rationale

- **Foundation first (Phase 1)**: Services are independently testable and don't depend on each other. Security patterns (config permissions), error handling patterns (API translation), and file patterns (atomic writes) must be built correctly from the start - retrofitting breaks users' existing configs and workflows.

- **Orchestration second (Phase 2)**: Requires completed services to coordinate. This is where the "looks done but isn't" pitfalls manifest - signal handlers, process cleanup, atomic file operations must be architected in, not bolted on.

- **CLI third (Phase 3)**: Thin wrapper over orchestrator, mostly argument parsing and help text. Most complexity already handled by orchestrator, so this phase is quick.

- **Multi-service fourth (Phase 4)**: Validates architecture extensibility. If service abstraction is sound, adding providers is easy. Deferred from Phase 1 because free tier proves concept without API key friction.

- **Enhancement last (Phase 5)**: Quality-of-life features that improve but aren't essential. Can be prioritized based on user feedback after Phase 3 launches.

**Dependency analysis:**
- Phase 1 components have no inter-dependencies (can build in parallel: config store, AI interface, Zoom verifier, error classes, platform utils)
- Phase 2 requires Phase 1 complete (orchestrator needs services to coordinate)
- Phase 3 requires Phase 2 complete (CLI needs orchestrator to invoke)
- Phase 4 requires Phase 1-3 complete (validates service abstraction with new providers)
- Phase 5 can enhance any previous phase (independent improvements)

### Research Flags

**Phases likely needing deeper research:**
- **Phase 4 (Multi-Service)**: Stability AI has no official Node.js SDK and documentation was inaccessible during research (Cloudflare blocked). Will need `/gsd:research-phase` for Stability API integration patterns, authentication flow, and error handling specifics.

**Phases with standard patterns (skip research-phase):**
- **Phase 1 (Foundation)**: Config storage, file system operations, basic API integration - well-documented standard patterns
- **Phase 2 (Orchestration)**: Workflow coordination, browser launching, signal handlers - established patterns from CLI tool domain
- **Phase 3 (CLI)**: Commander.js usage, argument parsing - extremely well-documented with extensive examples
- **Phase 5 (Enhancement)**: Quality-of-life features building on existing foundation

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All package versions verified on npm, official SDK documentation accessed for OpenAI and Hugging Face, active maintenance confirmed for core libraries. Only gap: Stability AI docs were inaccessible (Cloudflare), but REST API approach is sound. |
| Features | MEDIUM-HIGH | Table stakes and differentiators well-researched from CLI tool best practices and AI image generation domain. MVP definition clear. Some uncertainty around which v2 features users will actually want (templates, history) - needs usage data to validate. |
| Architecture | HIGH | Component structure based on established CLI patterns, service abstraction validated through official framework docs, build order follows dependency analysis. Anti-patterns identified from common mistakes. Only gap: exact Zoom directory behavior across versions needs validation. |
| Pitfalls | HIGH | Critical pitfalls verified through official documentation (Node.js fs, OpenAI SDK, Zoom requirements), macOS Zoom directory manually inspected and confirmed. Recovery strategies practical. Some timeout values estimated but conservative. |

**Overall confidence:** HIGH

Research sources are strong (official documentation, verified npm packages, manual system inspection). Architecture patterns are established and well-documented. Main gaps are around services with poor documentation (Stability AI) and undocumented integrations (Zoom file system behavior across versions), but mitigation strategies are clear.

### Gaps to Address

**Gap 1: Stability AI REST API specifics**
- **Issue**: Documentation was inaccessible during research (Cloudflare block), integration approach based on general REST API patterns and community knowledge
- **Confidence**: LOW for Stability specifics
- **Resolution**: During Phase 4 planning, run `/gsd:research-phase` focused on Stability AI to get authentication flow, error codes, rate limits, and response format. Worst case: defer Stability to v1.1 if API is too complex, ship with Hugging Face + DALL-E only.

**Gap 2: Zoom directory structure across versions**
- **Issue**: Path `~/Library/Application Support/zoom.us/data/VirtualBkgnd_Custom` verified on current version but Zoom has no official API or documentation about this directory
- **Confidence**: MEDIUM (manually verified but no official source)
- **Resolution**: Phase 1 must implement dynamic path discovery with fallbacks (search for multiple possible directory names). During Phase 1 testing, validate on multiple Zoom versions if possible. Accept that breaking changes from Zoom require reactive patches.

**Gap 3: Exact timeout values for AI services**
- **Issue**: Research provided estimates (Hugging Face: 120s, DALL-E: 60s, Stability: 90s) based on general knowledge, not verified through load testing
- **Confidence**: MEDIUM (conservative estimates but not empirically validated)
- **Resolution**: Phase 1 should use conservative high timeouts (120s across the board) to avoid false failures. Phase 5 can tune based on telemetry if users opt into usage tracking. Add `--timeout` flag early for user override.

**Gap 4: Zoom image format validation requirements**
- **Issue**: Research found that Zoom requires "24-bit PNG/JPG, minimum 1280x720" from official support docs, but unclear if Zoom enforces this or just recommends it
- **Confidence**: MEDIUM (official requirement but enforcement unclear)
- **Resolution**: Phase 5 adds pre-flight validation (read image headers, check dimensions) but don't block saves if validation fails - warn user and let them decide. This handles case where Zoom requirements change or are more lenient than documented.

## Sources

### Primary (HIGH confidence)
- **NPM Registry**: Current versions verified for all recommended packages (2026-02-21)
- **Hugging Face JS Documentation** (https://huggingface.co/docs/huggingface.js/inference/README): Confirmed text-to-image support, Inference API capabilities, free tier availability
- **OpenAI Node.js SDK GitHub** (https://github.com/openai/openai-node): v6.22.0 confirmed, DALL-E 3 support verified, error types documented
- **OpenAI Cookbook** (https://developers.openai.com/cookbook/examples/dalle/): DALL-E 3 capabilities, quality/style parameters
- **Commander.js GitHub** (https://github.com/tj/commander.js): Command structure patterns, 28k+ stars, active maintenance
- **Inquirer.js GitHub** (https://github.com/SBoudrias/Inquirer.js): Modern @inquirer/prompts rewrite confirmed
- **conf GitHub** (https://github.com/sindresorhus/conf): Configuration management patterns, atomic writes, platform paths
- **Node.js fs Documentation** (https://nodejs.org/docs/latest/api/fs.html): Async operations, atomic rename, permissions
- **Apple File System Programming Guide**: macOS directory access patterns, security, atomic operations
- **Zoom Virtual Background Requirements** (https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0060387): Format specs (24-bit PNG/JPG, 1280x720 min)
- **Manual inspection**: Zoom directory `/Users/tvellore/Library/Application Support/zoom.us/data/VirtualBkgnd_Custom` verified on actual macOS system
- **12 Factor App Config** (https://12factor.net/config): Environment variable best practices

### Secondary (MEDIUM confidence)
- **CLI Guidelines** (https://clig.dev): CLI UX patterns, prompt best practices
- **Gum** (https://github.com/charmbracelet/gum): Interactive CLI patterns
- **oclif CLI Framework** (https://github.com/oclif/oclif): Architecture patterns for complex CLIs
- **Stable Diffusion WebUI** (https://github.com/AUTOMATIC1111/stable-diffusion-webui): Competitor feature analysis
- **ComfyUI** (https://github.com/comfyanonymous/ComfyUI): Competitor feature analysis
- **Hugging Face Inference Providers**: Rate limit patterns (mentioned but not detailed)
- **Playwright Documentation** (https://playwright.dev/docs/intro): Browser automation patterns

### Tertiary (LOW confidence - needs verification)
- **Stability AI Platform** (https://platform.stability.ai): Documentation blocked by Cloudflare, REST API approach based on community knowledge
- **AI Service Timeout Values**: Estimates based on general experience, not empirically validated
- **Content Policy Error Patterns**: Inferred from general API practices, specific implementations vary

---
*Research completed: 2026-02-21*
*Ready for roadmap: yes*
