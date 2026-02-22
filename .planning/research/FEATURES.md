# Feature Research

**Domain:** AI-powered CLI image generation tools
**Researched:** 2026-02-21
**Confidence:** MEDIUM

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Text prompt input | Core function of AI image generation | LOW | Accept prompt as CLI argument or interactive input |
| Image generation from prompt | Primary value proposition | MEDIUM | Requires API integration with at least one service |
| Local image storage | Users need to access generated images | LOW | Save to predictable location with clear naming |
| Error handling & feedback | CLI tools must communicate failures clearly | MEDIUM | Network errors, API failures, invalid inputs |
| Help documentation | CLI convention (`-h`, `--help`) | LOW | Clear usage instructions and examples |
| API key management | Services require authentication | MEDIUM | Secure storage, env vars, or config file |
| Output location indication | Users need to know where files are saved | LOW | Print file path after generation |
| Progress feedback | Image generation takes time | MEDIUM | Spinner/progress indicator during API calls |
| Graceful degradation | Handle service unavailability | MEDIUM | Fallback or clear error messages |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Multi-service support with fallback | Reduces single point of failure, user flexibility | HIGH | Free default (Hugging Face) + paid options (DALL-E, Stability AI) |
| Browser-based preview & approval | Better visual quality assessment than terminal | MEDIUM | Generate HTML, open in browser, wait for user decision |
| Iterative prompt refinement | Improves image quality through iteration | MEDIUM | On rejection, prompt for modifications and regenerate |
| Zoom integration verification | Ensures tool works in target environment | LOW | Check if Zoom installed and user logged in |
| Automatic background installation | Seamless end-to-end workflow | MEDIUM | Save to Zoom backgrounds directory automatically |
| Service preference memory | Reduces friction on repeated use | LOW | Remember last used service in config |
| Free-tier default | Lower barrier to entry, try without API keys | MEDIUM | Hugging Face Inference API as default |
| Non-interactive mode | Enables scripting and automation | MEDIUM | `--no-input` flag bypasses all prompts |
| Dry-run mode | Preview actions without executing | LOW | `--dry-run` to show what would happen |
| Verbose logging | Helps with debugging and transparency | LOW | Optional `--verbose` flag for detailed output |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Mid-session service switching | Flexibility to try multiple services | Complicates state management, confusing UX | One service per session; restart with different `--service` flag |
| Image history/gallery | Users want to see past generations | Adds complexity (storage, UI, cleanup), scope creep | Single image workflow; users can browse file system |
| Real-time Zoom preview | See background applied in meeting | Requires Zoom API integration, significant complexity | File placement is sufficient; users can preview in Zoom settings |
| Complex image editing | Crop, resize, filters, adjustments | Out of scope, many tools already do this | Focus on generation only; users can edit with other tools |
| Batch generation | Generate multiple variations at once | Complicates approval flow, unclear which to use | Single image workflow is simpler; can run tool multiple times |
| Custom model training | Fine-tune models for specific styles | Extremely complex, requires ML expertise | Use existing models with good prompt engineering |
| Encrypted API key storage | Security concerns | Overkill for v1, adds dependencies | Plain text config with clear documentation about risks |
| Multi-platform support (v1) | Users on Windows/Linux | Multiplies testing/development complexity | macOS-only for v1; expand later if validated |

## Feature Dependencies

```
[API Key Management]
    └──requires──> [Service Selection]
                       └──requires──> [Image Generation]
                                          └──requires──> [Local Storage]
                                                             └──requires──> [Zoom Integration]

[Browser Preview] ──requires──> [Image Generation]
[Iterative Refinement] ──requires──> [Browser Preview]
[Service Preference Memory] ──requires──> [API Key Management]
[Zoom Verification] ──should precede──> [Image Generation]
[Non-Interactive Mode] ──conflicts with──> [Browser Preview]
[Non-Interactive Mode] ──conflicts with──> [Iterative Refinement]
```

### Dependency Notes

- **API Key Management requires Service Selection:** Must know which service to authenticate with
- **Service Selection requires Image Generation:** No point selecting service without generation capability
- **Image Generation requires Local Storage:** Generated images must be saved somewhere
- **Local Storage requires Zoom Integration:** Must save to Zoom's expected directory
- **Browser Preview requires Image Generation:** Can't preview what hasn't been generated
- **Iterative Refinement requires Browser Preview:** Need approval UI to enable iteration
- **Service Preference Memory requires API Key Management:** No point remembering service without keys configured
- **Zoom Verification should precede Image Generation:** Fail fast if Zoom not available
- **Non-Interactive Mode conflicts with Browser Preview:** Can't show browser and wait for input in script mode
- **Non-Interactive Mode conflicts with Iterative Refinement:** Can't iterate without user interaction

## MVP Definition

### Launch With (v1)

Minimum viable product — what's needed to validate the concept.

- [x] **Text prompt input** — Core functionality; accept as CLI argument
- [x] **Single AI service integration** — Start with Hugging Face free tier as default
- [x] **Image generation from prompt** — Primary value proposition
- [x] **Local image storage** — Save to temp directory initially
- [x] **Browser preview** — Open generated image in browser (HTML file)
- [x] **Approval flow** — Y/N prompt after preview
- [x] **Iterative refinement** — On rejection, prompt for modifications and regenerate
- [x] **Zoom verification** — Check if Zoom installed and logged in
- [x] **Zoom background installation** — Save approved image to Zoom directory
- [x] **Basic error handling** — Network errors, API failures, invalid inputs
- [x] **Help documentation** — `-h`, `--help` with examples
- [x] **Progress feedback** — Spinner during API calls

### Add After Validation (v1.x)

Features to add once core is working and validated with users.

- [ ] **Multi-service support** — Add DALL-E 3 and Stability AI options; trigger: users request more services
- [ ] **API key management** — Config file storage; trigger: adding paid services
- [ ] **Service preference memory** — Remember last used service; trigger: multi-service support
- [ ] **Non-interactive mode** — `--no-input` flag; trigger: users want to script it
- [ ] **Advanced prompt options** — Size, style, quality parameters; trigger: users want more control
- [ ] **Retry logic** — Auto-retry on transient failures; trigger: users report intermittent failures
- [ ] **Verbose logging** — `--verbose` flag; trigger: users need debugging help
- [ ] **Config file support** — Store preferences, defaults; trigger: users want persistent settings

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] **Multiple AI service support expansion** — Midjourney, Replicate, etc.; defer: focus on 2-3 core services first
- [ ] **Image parameter presets** — Saved configurations; defer: needs usage data to determine useful presets
- [ ] **Prompt templates** — Reusable prompt patterns; defer: unclear which templates are valuable
- [ ] **Background scheduling** — Generate new background daily; defer: unclear if users want this
- [ ] **Multi-platform support** — Windows, Linux; defer: validate on macOS first
- [ ] **Team/enterprise features** — Shared configs, templates; defer: target is individual users first
- [ ] **Image quality optimization** — Auto-enhance for Zoom; defer: unclear if needed
- [ ] **Integration with other video platforms** — Teams, Meet, etc.; defer: Zoom validation first

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Text prompt input | HIGH | LOW | P1 |
| Image generation (single service) | HIGH | MEDIUM | P1 |
| Browser preview | HIGH | LOW | P1 |
| Approval flow | HIGH | LOW | P1 |
| Zoom verification | HIGH | LOW | P1 |
| Zoom background installation | HIGH | MEDIUM | P1 |
| Progress feedback | MEDIUM | LOW | P1 |
| Error handling | HIGH | MEDIUM | P1 |
| Help documentation | MEDIUM | LOW | P1 |
| Iterative refinement | HIGH | MEDIUM | P1 |
| Multi-service support | HIGH | HIGH | P2 |
| API key management | MEDIUM | MEDIUM | P2 |
| Service preference memory | LOW | LOW | P2 |
| Non-interactive mode | MEDIUM | MEDIUM | P2 |
| Verbose logging | LOW | LOW | P2 |
| Config file support | MEDIUM | MEDIUM | P2 |
| Advanced prompt options | MEDIUM | MEDIUM | P2 |
| Retry logic | MEDIUM | MEDIUM | P2 |
| Prompt templates | LOW | MEDIUM | P3 |
| Background scheduling | LOW | HIGH | P3 |
| Multi-platform support | MEDIUM | HIGH | P3 |
| Image quality optimization | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for launch — validates core concept
- P2: Should have, add when possible — improves experience after validation
- P3: Nice to have, future consideration — defer until PMF established

## Competitor Feature Analysis

| Feature | HuggingFace CLI | Stable Diffusion WebUI | ComfyUI | Our Approach |
|---------|-----------------|------------------------|---------|--------------|
| Service selection | Single (HF models) | Single (Stable Diffusion) | Model-agnostic (any SD compatible) | Multi-service (HF default + DALL-E + Stability) |
| Prompt handling | API parameter | Web form with advanced syntax | Node-based workflow | Simple CLI argument + iteration |
| Image preview | None (CLI downloads file) | Web interface with gallery | Web interface with graph | Browser-based HTML preview |
| Approval flow | N/A (non-interactive) | Implicit (web UI) | Implicit (web UI) | Explicit Y/N prompt after preview |
| Output management | Download to path | Web gallery + disk | Output folder with metadata | Direct to Zoom backgrounds directory |
| Iteration | Manual re-run with new prompt | Web form editing | Modify graph nodes | Prompt for modifications on rejection |
| Configuration | Config file + env vars | Web settings + CLI flags | JSON workflows | Config file for API keys + preferences |
| Free tier | Yes (HF Inference API) | Self-hosted only | Self-hosted only | Yes (HF default) |
| Target use case | General AI tasks | Image generation workflows | Complex AI pipelines | Quick Zoom background creation |

### Key Differentiators from Competitors

1. **Purpose-built for Zoom backgrounds** — Competitors are general-purpose; we're specialized
2. **CLI-first with browser preview** — Best of both worlds (scriptable + visual)
3. **Free tier default** — Competitors require setup; we work out of the box
4. **Explicit approval workflow** — Competitors assume user wants all outputs; we confirm
5. **Iterative refinement built-in** — Competitors require manual re-running; we guide iteration
6. **Multi-service with single UX** — Switch backends without learning new interfaces

## UX Patterns from CLI Best Practices

Based on research from clig.dev, Commander.js, and Gum:

### Interactive Prompts
- ✅ Only prompt when stdin is TTY (terminal)
- ✅ Always provide non-interactive alternative (`--no-input`)
- ✅ Never require prompts; accept all inputs via flags

### Confirmation Levels
- **Mild actions** (preview): No confirmation needed
- **Moderate actions** (save to Zoom): Confirm with Y/N prompt
- **Severe actions** (N/A for this tool): Not applicable

### User Feedback
- ✅ Extensive help via `-h` and `--help`
- ✅ Lead with examples in documentation
- ✅ Suggest next steps after operations complete
- ✅ Provide constructive corrections for misuse

### Visual Feedback (Gum patterns)
- ✅ Spinner during long operations (API calls)
- ✅ Styled output for key information (file paths, success messages)
- ✅ Clear status indicators (✓ success, ✗ error, ⚠ warning)

## AI Image Generation Service Patterns

### Common API Integration Patterns

**Authentication:**
- API keys via environment variables (most secure for CLI)
- Config file storage (convenient but less secure)
- Token-based with refresh (enterprise services)

**Request Patterns:**
- POST with JSON payload containing prompt + parameters
- Async generation with polling for completion
- Webhook callbacks for long-running jobs (not suitable for CLI)

**Response Patterns:**
- Direct image binary in response
- URL to download image (expires after time period)
- Job ID for polling status + result retrieval

**Error Handling:**
- Rate limiting (429 responses)
- Quota exhaustion (402 payment required)
- Invalid prompts (400 bad request)
- Service unavailable (503)

### Service-Specific Notes

**Hugging Face Inference API:**
- Free tier available with rate limits
- Simple REST API, binary response
- Multiple model options (Stable Diffusion variants)
- Confidence: MEDIUM (based on official HF CLI documentation)

**DALL-E 3 (OpenAI):**
- Requires paid API key
- Returns URL to image (temporary)
- Strict content policy (rejects some prompts)
- Confidence: LOW (documentation access blocked, inferred from topic pages)

**Stability AI:**
- Multiple deployment options (API, self-hosted, cloud partners)
- Model variants for different use cases (Large, Turbo, Medium)
- Advanced editing capabilities beyond generation
- Confidence: MEDIUM (based on official Stability AI website)

## Zoom Integration Patterns

### macOS File System Patterns

**Standard Directories:**
- Application Support: `~/Library/Application Support/zoom.us/`
- Logs: `~/Library/Logs/zoom.us/`
- Preferences: `~/Library/Preferences/` (for plist files)

**Zoom Background Storage:**
- Exact location not documented in public sources
- Likely: `~/Library/Application Support/zoom.us/data/` or subdirectory
- Confidence: LOW (based on file system exploration, not official docs)

**Detection Patterns:**
- Check for app bundle at `/Applications/zoom.us.app`
- Verify user logged in by checking for data directory presence
- Alternative: Check for running Zoom process

### Verification Strategy

1. **Installation check**: Verify app bundle exists
2. **Login check**: Look for user data directory or config files
3. **Version check** (optional): Parse app Info.plist for version
4. **Fail fast**: Exit with clear error if Zoom not ready

## Configuration Management Patterns

Based on research from CLI tools and macOS conventions:

### API Key Storage

**Recommended Approach (v1):**
```
~/.config/zoombg/config.json
{
  "services": {
    "huggingface": { "api_key": "hf_..." },
    "openai": { "api_key": "sk-..." },
    "stability": { "api_key": "sk-..." }
  },
  "preferences": {
    "default_service": "huggingface",
    "last_used_service": "huggingface"
  }
}
```

**Permissions:**
- File should be `chmod 600` (user read/write only)
- Directory should be `chmod 700` (user access only)

**Environment Variable Override:**
- `ZOOMBG_HF_API_KEY`, `ZOOMBG_OPENAI_API_KEY`, etc.
- Takes precedence over config file
- Useful for CI/CD and scripting

### Preference Storage

**Settings to Persist:**
- Last used service
- Default prompt parameters (size, quality, etc.)
- Output directory preference (if user overrides default)
- Verbosity level
- Non-interactive mode preference

**Not Persisted (session-only):**
- Current prompt
- Current generation status
- Temporary file paths

## Sources

### Official Documentation (HIGH confidence)
- Hugging Face Hub CLI: https://huggingface.co/docs/huggingface_hub/guides/cli
- Stability AI: https://stability.ai/stable-image
- Electron macOS paths: https://www.electronjs.org/docs/latest/api/app

### CLI Design Guidelines (HIGH confidence)
- CLI Guidelines: https://clig.dev
- Gum (CLI interactions): https://github.com/charmbracelet/gum

### Community/Project Pages (MEDIUM confidence)
- Stable Diffusion WebUI: https://github.com/AUTOMATIC1111/stable-diffusion-webui
- ComfyUI: https://github.com/comfyanonymous/ComfyUI
- GitHub topics: AI image generation, DALL-E, Zoom API
- Commander.js patterns: https://github.com/tj/commander.js

### Inferred/Low Confidence (LOW confidence)
- Zoom background file locations (no official documentation found)
- DALL-E 3 specific patterns (documentation access blocked)
- Service-specific error patterns (inferred from general API practices)

---
*Feature research for: AI-powered Zoom background CLI tool*
*Researched: 2026-02-21*
