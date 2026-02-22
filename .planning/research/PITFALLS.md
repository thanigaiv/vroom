# Pitfalls Research

**Domain:** AI-powered CLI tool for Zoom backgrounds (macOS)
**Researched:** 2025-02-21
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: Plain Text API Key Storage Without User Warning

**What goes wrong:**
API keys stored in unencrypted configuration files (`~/.zoombg/config.json`) can be easily extracted by malicious software, other users with file access, or accidentally committed to version control. Users expect credentials to be handled securely.

**Why it happens:**
- Developers prioritize "getting it working" over security in v1
- Encryption seems complex, plain text seems "good enough" initially
- PROJECT.md explicitly states: "API keys stored in plain text config initially (can encrypt later)"
- Seems acceptable since it's a local tool, not a web service

**How to avoid:**
1. Store API keys in environment variables (`HUGGINGFACE_API_KEY`, `OPENAI_API_KEY`, `STABILITY_API_KEY`) as the 12-factor methodology recommends
2. If file-based storage is required, set strict file permissions (0600) immediately on creation
3. Add prominent warning in CLI output: "Warning: API keys stored in ~/.zoombg/config.json. Protect this file."
4. Never use `process.cwd()` or relative paths for config storage—always use system-standard config directories
5. Add `.zoombg` to common `.gitignore` templates in documentation

**Warning signs:**
- Config file permissions are 644 or 666 (world-readable)
- No permission validation on config file read
- Users can easily find keys with `cat ~/.zoombg/config.json`
- Documentation doesn't mention security implications

**Phase to address:**
Phase 1 (Foundation/Setup) — Implement secure config storage from day one. Technical debt here compounds because changing storage location breaks existing users' configs.

**Sources:**
- 12 Factor App Config: https://12factor.net/config (HIGH confidence)
- GitHub Token Security Guide (MEDIUM confidence - focused on tokens but principles apply)

---

### Pitfall 2: Ignoring AI Service Rate Limits and Quotas

**What goes wrong:**
Free tier APIs (Hugging Face) have aggressive rate limits. Users hit 429 errors, see cryptic failures, and blame your tool. Paid APIs (OpenAI, Stability) can rack up unexpected costs if regeneration loops aren't controlled.

**Why it happens:**
- Free service as default (PROJECT.md goal) means most users hit rate limits
- Approval/rejection flow creates regeneration loops without backoff
- Developers test with paid APIs or haven't hit quota limits
- Error messages from APIs are technical and not translated to user context

**How to avoid:**
1. Implement exponential backoff for 429 RateLimitError responses (start with 2s, max 32s)
2. Track regeneration attempts per session (cap at 5-10 before forcing exit)
3. Parse and display human-readable error messages:
   - 429: "Rate limit exceeded. Please wait 30 seconds and try again."
   - 401: "Invalid API key for [service]. Run 'zoombg config --set-key [service]'"
   - 402/403: "Insufficient credits/quota for [service]. Consider using a different service."
4. Show estimated wait time for rate limits based on response headers
5. Warn users when approaching free tier quotas if API provides usage info
6. Add `--max-retries` flag for user control

**Warning signs:**
- No retry logic in API client code
- No error code differentiation (all errors treated the same)
- No user guidance when errors occur
- Testing only with paid accounts that never hit limits

**Phase to address:**
Phase 1 (Foundation/Setup) — Core error handling must exist before users encounter it. Phase 2+ can enhance with usage tracking and smarter retry strategies.

**Sources:**
- OpenAI Node.js SDK error types (HIGH confidence)
- Hugging Face Inference Providers docs (HIGH confidence)

---

### Pitfall 3: Zoom Directory Structure Assumptions Break Across Versions

**What goes wrong:**
Hardcoding paths like `~/Library/Application Support/zoom.us/data/VirtualBkgnd_Custom` works today but breaks when Zoom updates directory structure, renames folders, or changes permission requirements. Tool fails silently or crashes.

**Why it happens:**
- No official Zoom API for background management—reverse engineering required
- Directory structure discovered through manual inspection seems "stable enough"
- Testing on single Zoom version doesn't reveal version differences
- Zoom updates can change paths without notice

**How to avoid:**
1. Never hardcode full paths—search for directory dynamically:
   ```javascript
   const zoomBase = path.join(os.homedir(), 'Library/Application Support/zoom.us');
   const bgDirs = await findDirs(zoomBase, ['VirtualBkgnd_Custom', 'VirtualBkgnd', 'CustomBackground']);
   ```
2. Check multiple possible directory names (version variants)
3. Verify directory exists and is writable before attempting file operations
4. Fail gracefully with actionable error: "Could not locate Zoom backgrounds directory. Ensure Zoom is installed and has been opened at least once."
5. Log detected path for debugging: `debug: Using Zoom backgrounds directory: /path/found`
6. Check Zoom process is NOT running before writing (avoid file locks)
7. Validate Zoom is actually installed: check for `/Applications/zoom.us.app`

**Warning signs:**
- Single hardcoded path string for Zoom directory
- No directory existence validation before file operations
- No version detection or fallback paths
- Testing only on one developer's machine
- No check for write permissions before attempting save

**Phase to address:**
Phase 1 (Foundation/Setup) — Zoom integration is core functionality; must be resilient from start. Add Phase 2+ feature: detect Zoom version and log it for debugging.

**Sources:**
- Manual inspection of macOS Zoom directory structure (HIGH confidence - verified on actual system)
- Zoom official docs on background requirements (MEDIUM confidence - formats only, not paths)
- Apple File System Programming Guide on directory access patterns (HIGH confidence)

---

### Pitfall 4: Browser Process Zombie Proliferation

**What goes wrong:**
Opening browser for preview but not properly cleaning up processes leads to orphaned browser windows, memory leaks, and eventually system resource exhaustion. Users end up with dozens of hung browser tabs.

**Why it happens:**
- Using `open` command or `child_process.exec` to launch browser is fire-and-forget
- No tracking of browser process IDs
- No cleanup on CLI interruption (SIGINT/SIGTERM)
- Preview approval flow hangs waiting for user input while browser stays open
- Users close browser manually without CLI cleanup

**How to avoid:**
1. Create temporary HTML file with UUID in name for process tracking
2. Track opened processes and register cleanup handlers:
   ```javascript
   process.on('SIGINT', cleanup);
   process.on('SIGTERM', cleanup);
   process.on('exit', cleanup);
   ```
3. For browser automation, use Playwright/Puppeteer with explicit `browser.close()`
4. Set timeout for user approval (e.g., 5 minutes) then auto-cleanup
5. Delete temporary HTML files after approval/rejection
6. Detect if browser is still open before starting new preview
7. Provide CLI command to cleanup orphaned resources: `zoombg cleanup`

**Warning signs:**
- Using `open` or `xdg-open` without process management
- No signal handlers for cleanup
- Temporary files accumulate in `/tmp`
- No timeout on user input prompts
- Browser windows remain after CLI exits

**Phase to address:**
Phase 1 (Foundation/Setup) — Process management must be built into approval flow architecture. Can't retrofit cleanup after launch without breaking UX.

**Sources:**
- Node.js fs documentation on FileHandle leaks (HIGH confidence)
- Playwright documentation on browser lifecycle (MEDIUM confidence - didn't find specific CLI cleanup guidance)
- Common CLI tool patterns (MEDIUM confidence - based on known issues with browser launchers)

---

### Pitfall 5: Race Condition Between File Write and Zoom Read

**What goes wrong:**
Writing background image to Zoom directory while Zoom is scanning for changes causes corrupted files, partial reads, or Zoom not detecting the new background. File appears in folder but not in Zoom UI.

**Why it happens:**
- Writing file in chunks/streams without atomic completion
- Zoom watches directory and reads files as soon as they appear
- No file locking or write verification
- Network delays on image download can cause partial writes

**How to avoid:**
1. Write to temporary location first, then atomic rename into Zoom directory:
   ```javascript
   const tempPath = path.join(os.tmpdir(), `${uuid()}.png`);
   await writeFile(tempPath, imageData);
   await fs.rename(tempPath, finalZoomPath); // atomic operation
   ```
2. Verify file integrity after write (check file size matches expected)
3. Use file descriptors with exclusive write mode
4. Wait for Zoom to be closed/idle before writing (optional enhancement)
5. Add delay after write before prompting Zoom to check backgrounds (100-500ms)
6. Set proper file permissions (0644) so Zoom can read

**Warning signs:**
- Direct streaming to final destination
- No write completion verification
- Users report backgrounds "don't show up" in Zoom
- Intermittent file corruption
- Files appear in directory but Zoom doesn't list them

**Phase to address:**
Phase 1 (Foundation/Setup) — Core file writing logic must be atomic from start. Phase 2+ can add Zoom process detection for enhanced reliability.

**Sources:**
- Apple File System Programming Guide on file descriptors and atomic operations (HIGH confidence)
- Node.js fs documentation on unsafe concurrent operations (HIGH confidence)

---

### Pitfall 6: Image Generation Timeout Assumptions

**What goes wrong:**
AI image generation can take 15-90 seconds depending on service, model, and queue load. Hardcoded 30-second timeouts cause failures during peak usage. Users see "request timeout" without understanding why.

**Why it happens:**
- Default HTTP client timeouts (30s) too short for image generation
- Free tier services (Hugging Face) queue requests, adding unpredictable delays
- Developers test during off-peak times with fast responses
- No progress indication makes waits feel longer
- Different services have vastly different performance characteristics

**How to avoid:**
1. Set service-specific timeouts:
   - Hugging Face free: 120s (can queue)
   - DALL-E 3: 60s (usually fast)
   - Stability AI: 90s (model dependent)
2. Show progress indicators: "Generating image... (this may take up to 2 minutes)"
3. Implement streaming progress updates if API supports it
4. Add `--timeout` flag for user override
5. Catch timeout errors specifically and suggest solutions:
   - "Image generation timed out. Try again or use a different service with --service flag"
6. Warn users about expected wait times upfront: "Using free tier - generation may take 1-2 minutes"

**Warning signs:**
- Single timeout value for all services
- No progress indication during generation
- Timeout errors not distinguished from other failures
- Users report "sometimes works, sometimes doesn't"
- No documentation about expected generation times

**Phase to address:**
Phase 1 (Foundation/Setup) — Timeout configuration is part of API client setup. Phase 2+ can add progress streaming and adaptive timeouts based on historical data.

**Sources:**
- Hugging Face provider documentation on free tier behavior (MEDIUM confidence - mentions queuing but not specific timeouts)
- OpenAI API integration patterns (MEDIUM confidence - inferred from common issues)

---

### Pitfall 7: Prompt Injection and Content Policy Violations

**What goes wrong:**
Users enter prompts that violate AI service content policies ("generate violent/NSFW/copyrighted content"), causing API rejections. Tool crashes or shows raw error without explanation. Users blame the tool for "not working."

**Why it happens:**
- No client-side prompt validation before API call
- Content policy errors are HTTP 400/403 with technical messages
- Each service has different content policies and keywords
- Developers don't anticipate adversarial use cases

**How to avoid:**
1. Pre-screen prompts for obvious policy violations (keywords: violence, explicit, trademarked brands)
2. Translate content policy errors to user-friendly messages:
   ```
   "Your prompt violated [Service] content policy. Try rephrasing to avoid:
   - Violent or explicit content
   - Copyrighted characters/brands
   - Hate speech or harassment"
   ```
3. Provide prompt guidelines in help text: `zoombg generate --help`
4. Log rejected prompts for pattern analysis (privacy-preserving, user opt-in)
5. Suggest alternatives: "Try 'fantasy landscape' instead of '[brand] character'"
6. Add `--force-submit` flag to bypass client-side checks (with warning)

**Warning signs:**
- No prompt validation before API submission
- Content policy errors shown as raw JSON
- No documentation about prompt requirements
- Testing only with "safe" prompts
- No guidance when prompts are rejected

**Phase to address:**
Phase 1 (Foundation/Setup) — Basic error message translation is essential UX. Phase 2+ can add sophisticated prompt validation and suggestions.

**Sources:**
- OpenAI error handling documentation (MEDIUM confidence - error types confirmed but not content policy specifics)
- Common AI API integration issues (LOW confidence - based on general knowledge of content policies)

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Plain text API key storage | Simple implementation, no crypto dependencies | Security risk, user trust issues, hard to migrate later | Never for production; only for Phase 0 prototype |
| Hardcoded Zoom directory path | Works immediately, no discovery logic | Breaks across Zoom versions, brittle, hard to debug | Never — directory search is 10 lines of code |
| Single global timeout for all APIs | One config value, simple | Fails on slow services, no service-specific tuning | Only if timeout is conservatively high (120s+) |
| No retry logic for rate limits | Simpler code flow | Poor UX on free tiers, users blame tool | Never for tools using free APIs |
| File write without atomic rename | Fewer file operations | Race conditions, corrupted files in Zoom | Never — atomic operations are same complexity |
| Browser opened with `open` command | One line of code | Process leaks, no cleanup, resource exhaustion | Only for Phase 0 prototype |
| No signal handlers (SIGINT/SIGTERM) | Less boilerplate | Orphaned processes, temp files not cleaned | Never for CLI tools that create resources |
| No prompt validation | Users can submit anything | Content policy violations crash tool | Only if API error translation is excellent |

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| AI APIs (OpenAI, Stability, HuggingFace) | Treating all errors as generic failures | Parse error.status and error.code; handle 429, 401, 403, 400 distinctly |
| AI APIs | Not capturing request IDs for debugging | Always log `x-request-id` header on failures |
| AI APIs | Assuming consistent response times | Set service-specific timeouts; show progress for long operations |
| Zoom file system | Directly writing to final destination | Write to temp location, atomic rename into Zoom directory |
| Zoom file system | Assuming directory exists | Check existence and writability before operations |
| Zoom file system | Ignoring file format requirements | Validate 24-bit PNG/JPG, minimum 1280x720, before saving |
| Browser automation | Using `open` command without tracking | Use Puppeteer/Playwright or track processes for cleanup |
| Browser automation | No timeout on user approval | Set 5-minute timeout, auto-cleanup on expiry |
| Config file storage | Using `process.cwd()` for config path | Use OS-appropriate config directory (e.g., `~/.config` on Linux, `~/Library/Application Support` on macOS) |
| Config file storage | Creating config files with default permissions | Explicitly set 0600 permissions for files with credentials |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| No request caching for identical prompts | Slow regeneration of same prompt, wasted API quota | Cache generated images by prompt hash (opt-in, size-limited) | After 50+ generations in a session |
| Downloading full image to memory | High memory usage, crashes on large images | Stream directly to file with `createWriteStream()` | Images over 10MB |
| Keeping browser instance open | Memory grows over time, system slowdown | Close browser after each preview, or reuse with timeout | After 10+ previews in session |
| No cleanup of temp files | Disk space exhaustion | Delete temp HTML/image files immediately after use | After 100+ generations |
| Synchronous file operations | CLI hangs during I/O | Use async fs promises (fs.promises) for all file operations | Never immediate, but poor UX always |
| No progress indication | Users think tool is frozen | Add spinners/progress for operations over 3 seconds | Immediate UX issue, not scale-dependent |

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| World-readable config file with API keys | API key theft, unauthorized usage charges | Set file permissions to 0600 on creation; verify on read |
| Storing API keys in source code or env examples | Accidental git commits, public exposure | Use environment variables; provide `.env.example` with placeholders |
| No validation of image source before saving | Malicious image files could exploit Zoom vulnerabilities | Validate image format, dimensions, file size before save |
| Executing user input in shell commands | Command injection attacks | Never pass user prompts to shell; use proper API libraries |
| No rate limiting on regenerations | API quota exhaustion, unexpected charges | Cap regenerations per session (e.g., 10 max) |
| Temp files with predictable names | Race condition attacks, information disclosure | Use UUID/cryptographic random names for temp files |
| No Zoom installation verification | Directory traversal if path detection fails | Validate Zoom is installed before constructing paths |
| Following symbolic links in Zoom directory | Access to unintended files | Use `lstat()` instead of `stat()` to detect symlinks |

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Raw API errors shown to users | Confusion, users think tool is broken | Translate errors: "Rate limit exceeded" not "HTTP 429" |
| No indication of progress during generation | Users think CLI is frozen, kill process | Show spinner + message: "Generating image (up to 2 min)..." |
| Approval flow without timeout | Browser window forgotten, CLI hangs forever | 5-minute timeout with auto-reject and cleanup |
| No default service | Every first run requires config, friction | Use Hugging Face free tier as default (no API key required) |
| Unclear rejection flow | Users reject but don't know how to modify prompt | Prompt: "Image rejected. Enter modified prompt (or 'cancel'):" |
| No feedback when file is saved | Users wonder if it worked | Confirm: "Background saved to Zoom. Open Zoom to apply." |
| Generic error on Zoom not found | Users don't know what to install | Specific: "Zoom not found. Install from https://zoom.us/download" |
| No validation of image quality | Low-quality generations waste user time | Show dimensions/size in preview; allow quality adjustment flag |
| Regeneration loop without cost warning | Users unknowingly rack up API charges | After 3 regens: "Warning: Each generation costs ~$0.02. Continue? (y/n)" |
| No way to cancel generation | Users stuck waiting, must kill process | Detect Ctrl+C during generation, cancel request, cleanup |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **API Integration:** Often missing error code handling (401, 403, 429) — verify each error type has user-friendly message
- [ ] **File Writing:** Often missing atomic rename pattern — verify temp file + rename, not direct write
- [ ] **File Writing:** Often missing permission setting (0600 for config, 0644 for images) — verify explicit chmod
- [ ] **Browser Preview:** Often missing process cleanup — verify signal handlers (SIGINT, SIGTERM, exit) registered
- [ ] **Browser Preview:** Often missing timeout — verify auto-cleanup after 5 minutes
- [ ] **Zoom Integration:** Often missing directory validation — verify existence check before write
- [ ] **Zoom Integration:** Often missing write permission check — verify fs.access(W_OK) before operations
- [ ] **Zoom Integration:** Often missing format validation — verify 24-bit PNG/JPG and minimum dimensions
- [ ] **Config Storage:** Often missing directory creation — verify config dir exists with recursive: true
- [ ] **Config Storage:** Often missing permission validation on read — verify file isn't world-readable, warn if so
- [ ] **API Calls:** Often missing timeout configuration — verify service-specific timeouts (60-120s)
- [ ] **API Calls:** Often missing retry logic for 429 — verify exponential backoff implemented
- [ ] **API Calls:** Often missing request ID logging — verify x-request-id captured on errors
- [ ] **Error Messages:** Often missing context translation — verify raw API errors converted to user actions
- [ ] **Progress Indication:** Often missing for long operations — verify spinners/messages for operations over 5s
- [ ] **Resource Cleanup:** Often missing temp file deletion — verify all temp files deleted in finally blocks
- [ ] **Graceful Exit:** Often missing Ctrl+C handling — verify cleanup runs on SIGINT before exit

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| API keys leaked in public repo | HIGH | 1. Revoke all keys immediately 2. Generate new keys 3. Add secrets scanning to CI 4. Audit git history for other secrets |
| Zoom directory structure changed | LOW | 1. Add fallback directory search 2. Update known paths list 3. Add version detection logging 4. Release patch version |
| Orphaned browser processes | LOW | 1. Provide `zoombg cleanup` command 2. Document manual process cleanup (Activity Monitor) 3. Add process tracking in next version |
| Rate limit violations | LOW | 1. Add exponential backoff 2. Display wait time to user 3. Suggest alternative service 4. Cache requests if possible |
| Corrupted Zoom backgrounds | MEDIUM | 1. Validate file before write 2. Keep backup of last successful file 3. Provide manual file removal instructions 4. Add integrity check on read |
| Accidental API quota exhaustion | MEDIUM | 1. Add per-session usage tracking 2. Warn at 80% of known limits 3. Add --dry-run flag for testing 4. Implement request cap |
| Config file permission too open | LOW | 1. Detect on next run 2. Auto-fix with chmod 600 3. Warn user about previous exposure 4. Suggest key rotation |
| Infinite regeneration loop | LOW | 1. Add session regeneration counter 2. Cap at 10 attempts 3. Force user to exit and restart 4. Log for abuse detection |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Plain text API key storage | Phase 1 (Foundation) | Config file has 0600 permissions; warning shown on first setup |
| Ignoring rate limits | Phase 1 (Foundation) | 429 errors trigger exponential backoff; user sees wait time message |
| Zoom directory assumptions | Phase 1 (Foundation) | Tool searches multiple directory paths; validates existence before write |
| Browser process zombies | Phase 1 (Foundation) | Signal handlers cleanup processes; temp files deleted on exit |
| File write race conditions | Phase 1 (Foundation) | Atomic rename pattern used; file integrity verified post-write |
| Image generation timeouts | Phase 1 (Foundation) | Service-specific timeouts configured; progress shown during wait |
| Prompt policy violations | Phase 1 (Foundation) | Content policy errors translated to user-friendly messages |
| No Zoom installation check | Phase 1 (Foundation) | Tool validates Zoom installed before proceeding |
| Raw error messages | Phase 1 (Foundation) | All API errors mapped to actionable user guidance |
| Missing progress indication | Phase 1 (Foundation) | Spinners shown for operations over 3 seconds |
| No approval timeout | Phase 1 (Foundation) | 5-minute timeout on user approval; auto-cleanup afterward |
| Synchronous file operations | Phase 1 (Foundation) | All fs operations use async/await promises |
| No temp file cleanup | Phase 1 (Foundation) | Finally blocks ensure cleanup; signal handlers call cleanup |
| Missing SIGINT handling | Phase 1 (Foundation) | Ctrl+C gracefully cancels operation and cleans up |
| No validation of Zoom formats | Phase 2 (Enhancement) | Pre-flight check ensures image meets Zoom requirements |
| No regeneration limit | Phase 2 (Enhancement) | Session counter caps regenerations; warns about costs |
| No request caching | Phase 3 (Optimization) | Identical prompts retrieve cached images (opt-in) |
| No usage tracking | Phase 3 (Optimization) | Track API usage; warn at 80% of known limits |
| No Zoom process detection | Phase 3 (Optimization) | Detect if Zoom running; warn about potential conflicts |

## Sources

**HIGH Confidence (Official Documentation & Verified):**
- OpenAI Node.js SDK error handling: https://github.com/openai/openai-node (error types confirmed)
- Hugging Face Inference Providers: https://huggingface.co/docs/api-inference/quicktour (provider patterns, rate considerations)
- 12 Factor App Config: https://12factor.net/config (environment variable best practices)
- Node.js fs documentation: https://nodejs.org/docs/latest/api/fs.html (atomic operations, permissions, FileHandle cleanup)
- Apple File System Programming Guide: https://developer.apple.com/library/archive/documentation/FileManagement/Conceptual/FileSystemProgrammingGuide/ (macOS directory access, security)
- Zoom Virtual Background Requirements: https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0060387 (format specs: 24-bit PNG/JPG, 1280x720 min)
- Manual inspection of Zoom directory structure on macOS: `/Users/tvellore/Library/Application Support/zoom.us/data/VirtualBkgnd_Custom` (verified path)

**MEDIUM Confidence (Partial Information or Inferred):**
- conf library for CLI config: https://github.com/sindresorhus/conf (patterns demonstrated but security limitations acknowledged)
- Yargs CLI framework: https://github.com/yargs/yargs (UX patterns demonstrated)
- Playwright browser automation: https://playwright.dev/docs/intro (setup shown but CLI-specific cleanup guidance not in excerpt)
- Prettier configuration patterns: https://github.com/prettier/prettier (config file patterns observed)

**LOW Confidence (General Knowledge, Needs Verification):**
- AI API content policy violations (known issue but specific implementations vary)
- Stability AI rate limits (not accessible in documentation)
- Specific timeout values for different AI services (estimated based on general experience)

---
*Pitfalls research for: ZoomBG — AI-powered Zoom background CLI tool*
*Researched: 2025-02-21*
*Confidence: HIGH overall (core pitfalls verified through documentation and manual inspection)*
