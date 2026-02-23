# Roadmap: ZoomBG

## Overview

ZoomBG progresses from foundation to polish in five phases. Phase 1 establishes core services (Zoom integration, config management, free-tier AI) with security patterns that can't be retrofitted. Phase 2 orchestrates these services into the generate→preview→approve→save workflow. Phase 3 wraps the orchestrator in a CLI interface. Phase 4 validates the service abstraction by adding paid AI providers. Phase 5 adds quality-of-life features based on a working tool.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation & Core Services** - Secure config, Zoom integration, free-tier AI (completed 2026-02-22)
- [x] **Phase 2: Workflow Orchestration** - Generate→preview→approve→save coordination (completed 2026-02-22)
- [x] **Phase 3: CLI Interface** - Command parsing, help docs, user-facing layer (completed 2026-02-22)
- [ ] **Phase 4: Multi-Service Support** - DALL-E and Stability AI integration
- [ ] **Phase 5: Enhancement & Polish** - Dry-run mode and quality-of-life features

## Phase Details

### Phase 1: Foundation & Core Services
**Goal**: Establish independently testable services with security and error handling patterns that enable later phases
**Depends on**: Nothing (first phase)
**Requirements**: ZOOM-01, ZOOM-02, ZOOM-03, CONFIG-01, AI-01
**Success Criteria** (what must be TRUE):
  1. Tool verifies Zoom is installed before proceeding
  2. Tool verifies user is logged into Zoom before proceeding
  3. Tool discovers Zoom backgrounds directory dynamically without hardcoded paths
  4. Tool stores API keys with 0600 file permissions
  5. Tool generates images using Hugging Face free tier without requiring API keys
**Plans**: 3 plans

Plans:
- [x] 01-01-PLAN.md — Project setup, config service with secure storage, error types
- [x] 01-02-PLAN.md — Zoom verifier with installation/login checks, dynamic directory discovery
- [x] 01-03-PLAN.md — AI service abstraction with Hugging Face implementation

### Phase 2: Workflow Orchestration
**Goal**: Coordinate services into complete generate→preview→approve→save workflow with iterative refinement
**Depends on**: Phase 1
**Requirements**: FLOW-01, FLOW-02, FLOW-03, FLOW-04, ZOOM-04
**Success Criteria** (what must be TRUE):
  1. Tool displays generated image in browser for user preview
  2. User can approve image by typing "yes" or reject by typing "no"
  3. User can modify prompt and regenerate when rejecting an image
  4. Tool shows progress indicators during 15-90 second image generation
  5. Tool saves approved image to Zoom backgrounds directory automatically
  6. Tool cleans up temporary files and browser processes after approval or rejection
**Plans**: 2 plans

Plans:
- [x] 02-01-PLAN.md — Browser preview with base64 data URLs, cleanup manager with signal handlers
- [x] 02-02-PLAN.md — Interactive workflow orchestration with Inquirer prompts, ora spinners, save to Zoom

### Phase 3: CLI Interface
**Goal**: Wrap orchestrator in command-line interface with argument parsing and help documentation
**Depends on**: Phase 2
**Requirements**: CONFIG-02
**Success Criteria** (what must be TRUE):
  1. User can invoke tool with text prompt via command-line argument
  2. User can select which AI service to use via command-line flag
  3. Tool displays help documentation with usage examples when requested
  4. Tool shows clear error messages for invalid arguments or missing dependencies
**Plans**: 1 plan

Plans:
- [x] 03-01-PLAN.md — CLI entry point with commander, service selection, help documentation

### Phase 4: Multi-Service Support
**Goal**: Add paid AI providers to validate service abstraction and enable quality upgrades
**Depends on**: Phase 3
**Requirements**: AI-02, AI-03, AI-04, CONFIG-03
**Success Criteria** (what must be TRUE):
  1. Tool generates images using DALL-E 3 when OpenAI API key is configured
  2. Tool generates images using Stability AI when Stability API key is configured
  3. Tool remembers last used AI service across sessions
  4. Tool persists service preference to configuration file
  5. Adding new AI service requires no changes to orchestration layer
**Plans**: 3 plans

Plans:
- [x] 04-01-PLAN.md — OpenAI DALL-E 3 integration with SDK, service adapter, factory registration
- [ ] 04-02-PLAN.md — Stability AI integration with SDK, service adapter, architecture validation
- [ ] 04-03-PLAN.md — Service preference persistence with sticky selection and CLI validation

### Phase 5: Enhancement & Polish
**Goal**: Add quality-of-life features that improve UX without changing core functionality
**Depends on**: Phase 4
**Requirements**: CONFIG-04
**Success Criteria** (what must be TRUE):
  1. User can run tool in dry-run mode to test without saving to Zoom
  2. Tool provides clear feedback about what would happen in dry-run mode
  3. Tool handles edge cases gracefully (network errors, rate limits, timeout)
**Plans**: TBD

Plans:
- [ ] TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Core Services | 3/3 | Complete    | 2026-02-22 |
| 2. Workflow Orchestration | 2/2 | Complete    | 2026-02-22 |
| 3. CLI Interface | 1/1 | Complete    | 2026-02-22 |
| 4. Multi-Service Support | 1/3 | In progress | - |
| 5. Enhancement & Polish | 0/TBD | Not started | - |
