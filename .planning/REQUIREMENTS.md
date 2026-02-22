# Requirements: ZoomBG

**Defined:** 2025-02-21
**Core Value:** Quickly create and set custom Zoom backgrounds using AI without leaving the terminal.

## v1.0 Requirements

Requirements for initial release. Each maps to roadmap phases.

### System Integration

- [ ] **ZOOM-01**: User is notified if Zoom app is not installed before proceeding
- [ ] **ZOOM-02**: User is notified if not logged into Zoom before proceeding
- [ ] **ZOOM-03**: Tool discovers Zoom backgrounds directory dynamically (not hardcoded)
- [ ] **ZOOM-04**: Tool saves approved image to Zoom backgrounds directory automatically

### AI Image Generation

- [ ] **AI-01**: Tool generates images using Hugging Face free tier (no API key required)
- [ ] **AI-02**: Tool supports DALL-E 3 generation with OpenAI API key
- [ ] **AI-03**: Tool supports Stability AI generation with Stability API key
- [ ] **AI-04**: Tool remembers last used AI service across sessions

### User Workflow

- [ ] **FLOW-01**: Tool displays generated image in browser for preview
- [ ] **FLOW-02**: User can approve image by typing "yes" or reject by typing "no"
- [ ] **FLOW-03**: User can modify prompt and regenerate when rejecting an image
- [ ] **FLOW-04**: Tool shows progress indicators during image generation (15-90s wait)

### Configuration

- [ ] **CONFIG-01**: Tool stores API keys securely with proper file permissions (0600)
- [ ] **CONFIG-02**: User can select which AI service to use for generation
- [ ] **CONFIG-03**: Tool persists service preference to configuration file
- [ ] **CONFIG-04**: Tool supports dry-run mode to test without saving to Zoom

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Enhancement

- **ENHANCE-01**: User can run tool in non-interactive mode for scripting
- **ENHANCE-02**: Tool provides verbose logging for debugging
- **ENHANCE-03**: Tool caps regeneration attempts to prevent quota exhaustion
- **ENHANCE-04**: Tool validates image format meets Zoom requirements

### Advanced Features

- **ADV-01**: User can use prompt templates for common backgrounds
- **ADV-02**: Tool displays history of previously generated images

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Multi-platform support (Windows, Linux) | macOS validation first; complexity of cross-platform Zoom integration |
| Real-time Zoom preview with background | Not technically feasible without Zoom API; file placement is sufficient |
| Complex image editing or manipulation | Generation tool, not editor; keeps scope focused |
| Integration with other video platforms (Teams, Meet) | Validate Zoom first before expanding; different directory structures |
| Background scheduling or automation | Unclear user demand; adds complexity without validation |
| Mid-session service switching | Simpler UX with one service per session; can quit and restart |
| Image gallery or management | Storage complexity, unclear value; focus on single workflow |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| ZOOM-01 | TBD | Pending |
| ZOOM-02 | TBD | Pending |
| ZOOM-03 | TBD | Pending |
| ZOOM-04 | TBD | Pending |
| AI-01 | TBD | Pending |
| AI-02 | TBD | Pending |
| AI-03 | TBD | Pending |
| AI-04 | TBD | Pending |
| FLOW-01 | TBD | Pending |
| FLOW-02 | TBD | Pending |
| FLOW-03 | TBD | Pending |
| FLOW-04 | TBD | Pending |
| CONFIG-01 | TBD | Pending |
| CONFIG-02 | TBD | Pending |
| CONFIG-03 | TBD | Pending |
| CONFIG-04 | TBD | Pending |

**Coverage:**
- v1.0 requirements: 16 total
- Mapped to phases: 0 (pending roadmap creation)
- Unmapped: 16 ⚠️

---
*Requirements defined: 2025-02-21*
*Last updated: 2025-02-21 after initial definition*
