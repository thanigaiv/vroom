# Phase 5: Enhancement & Polish - Research

**Researched:** 2026-02-22
**Domain:** CLI quality-of-life enhancements (dry-run mode, graceful error handling, timeout/retry patterns, user feedback)
**Confidence:** MEDIUM-HIGH

## Summary

Phase 5 adds quality-of-life features that improve user experience without changing core functionality. The three success criteria require: (1) dry-run mode for testing without saving to Zoom, (2) clear feedback about dry-run operations, and (3) graceful handling of edge cases (network errors, rate limits, timeouts).

Dry-run mode is a standard CLI pattern where operations are simulated and results are logged without persisting changes. Implementation requires adding a `--dry-run` boolean flag via Commander, passing it through the workflow, and conditionally skipping the save-to-Zoom step while showing "would save to [path]" messages. The existing architecture already separates generation from persistence, making this straightforward.

Graceful error handling requires catching network errors (ETIMEDOUT, ECONNREFUSED, ENOTFOUND), translating them to user-actionable messages, and optionally implementing retry logic for transient failures. Node.js provides standard error codes via `error.code` that should be checked instead of parsing messages. The existing `ZoomBGError` pattern with `userMessage` fields already supports this approach.

Timeout and rate limiting require wrapping AI service calls with timeout enforcement and detecting 429 rate limit responses. The OpenAI SDK includes built-in retry logic, but we should add explicit timeout wrappers for all services and implement exponential backoff retry logic for 429 errors and network failures. Status codes 429, 500, and 503 are candidates for automatic retry with backoff.

User feedback improvements include conditional spinner display (silent in dry-run), verbose logging mode for debugging, and clearer progress messages. The ora spinner library supports `isEnabled` and `isSilent` options to control output, enabling dry-run and verbose modes without code duplication.

**Primary recommendation:** Add `--dry-run` and `--verbose` flags to CLI, wrap AI service calls with timeout enforcement, implement retry logic for transient errors (429, 500, 503, ETIMEDOUT, ECONNREFUSED), enhance error messages with network error translations, and conditionally disable persistence and adjust spinner output in dry-run mode.

<phase_requirements>
## Phase Requirements

This phase MUST address the following requirements:

| ID | Description | Research Support |
|----|-------------|-----------------|
| CONFIG-04 | Tool supports dry-run mode to test without saving to Zoom | Add `--dry-run` boolean flag via Commander.js `.option()`, pass through workflow options, skip `writeFile()` call in generate workflow when flag is true, show "Would save to [path]" message using ora spinner or console.log |
</phase_requirements>

## Standard Stack

### Core Libraries (Already in Stack)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| commander | 14.0.3 | CLI argument parsing for dry-run flag | Already used in Phase 3, supports boolean flags via `.option()`, automatic camelCase conversion (--dry-run becomes options.dryRun) |
| ora | 9.3.0 | Terminal spinners with conditional display | Already used in Phase 2, supports `isEnabled` and `isSilent` options for dry-run and verbose modes |
| picocolors | 1.1.1 | Terminal styling for enhanced messages | Already used in Phase 3, lightweight (14x smaller than chalk), consistent error formatting |

### Supporting (Consider Adding)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| p-timeout | ^6.1.2 | Promise timeout wrapper | Enforce service-specific timeouts for AI calls, throw TimeoutError when exceeded |
| p-retry | ^6.2.1 | Retry logic with exponential backoff | Automatically retry on 429, 500, 503, ETIMEDOUT, ECONNREFUSED with configurable delays |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| p-timeout/p-retry | Custom timeout/retry implementation | Libraries handle edge cases (cleanup, abort signals, jitter), well-tested, smaller bundle than rolling custom logic |
| p-retry | axios-retry (specific to axios) | p-retry works with any promise-returning function, not coupled to HTTP library, stability-ai uses axios but openai doesn't |
| Separate verbose flag | Use DEBUG environment variable pattern | Explicit --verbose flag is more discoverable for users, NODE_ENV or DEBUG variables are developer-focused |

**Installation (if adding timeout/retry):**
```bash
npm install p-timeout@^6.1.2 p-retry@^6.2.1
```

## Architecture Patterns

### Pattern 1: Dry-Run Mode with Conditional Persistence

**What:** Skip write operations and show "would do X" messages when dry-run flag is enabled
**When to use:** Testing workflows without side effects, validating configurations, debugging
**Example:**
```typescript
// Source: Derived from Commander.js boolean flag patterns and existing workflow structure
// src/cli.ts - Add dry-run flag
program
  .option('--dry-run', 'simulate operation without saving to Zoom')
  .option('-v, --verbose', 'show detailed progress information')
  .action(async (prompt, options) => {
    await generateWorkflow({
      initialPrompt: prompt,
      service: options.service,
      dryRun: options.dryRun,  // Pass through to workflow
      verbose: options.verbose
    });
  });

// src/workflows/generate.ts - Conditional persistence
export interface WorkflowOptions {
  initialPrompt?: string;
  service?: string;
  interactive?: boolean;
  dryRun?: boolean;    // NEW
  verbose?: boolean;   // NEW
}

export async function generateWorkflow(options: WorkflowOptions = {}): Promise<void> {
  const { dryRun = false, verbose = false } = options;

  // ... generate and preview image ...

  if (approved) {
    const bgManager = new BackgroundManager();
    const bgDir = await bgManager.findBackgroundsDirectory();
    const filename = `zoombg-${Date.now()}.png`;
    const savePath = join(bgDir, filename);

    if (dryRun) {
      // Dry-run: show what would happen
      console.log(pc.cyan('\n[DRY-RUN] Would save image:'));
      console.log(pc.dim(`  Path: ${savePath}`));
      console.log(pc.dim(`  Size: ${result.buffer.length} bytes`));
      console.log(pc.dim(`  Service: ${service}`));
    } else {
      // Normal mode: actually save
      const saveSpinner = ora('Saving to Zoom backgrounds...').start();
      await writeFile(savePath, result.buffer);
      await configService.setLastUsedService(service as AIService);
      saveSpinner.succeed(`Saved as ${filename}`);
    }
  }
}
```

### Pattern 2: Network Error Translation

**What:** Catch Node.js system errors and translate to user-actionable messages
**When to use:** Any network operation (API calls, file system access)
**Example:**
```typescript
// Source: Node.js error handling documentation, existing ZoomBGError pattern
// src/services/errors.ts - New error class for network errors
export class NetworkError extends ZoomBGError {
  code: string;

  constructor(code: string, operation: string, originalError?: Error) {
    const userMessages: Record<string, string> = {
      'ETIMEDOUT': `Network timeout while ${operation}. Check your internet connection and try again.`,
      'ECONNREFUSED': `Connection refused while ${operation}. The service may be temporarily unavailable.`,
      'ENOTFOUND': `DNS lookup failed while ${operation}. Check your internet connection.`,
      'ECONNRESET': `Connection reset while ${operation}. The service may be experiencing issues.`,
      'EAI_AGAIN': `DNS lookup timeout while ${operation}. Check your DNS settings.`
    };

    const userMessage = userMessages[code] ||
      `Network error (${code}) while ${operation}. Please try again.`;

    super(`Network error ${code}: ${originalError?.message}`, userMessage);
    this.code = code;
  }
}

// Usage in AI service error handling
try {
  const result = await aiService.generateImage(prompt);
} catch (error: any) {
  // Check for network errors before other error types
  if (error.code && ['ETIMEDOUT', 'ECONNREFUSED', 'ENOTFOUND'].includes(error.code)) {
    throw new NetworkError(error.code, 'generating image', error);
  }

  // ... existing error handling ...
}
```

### Pattern 3: Timeout Wrapper for AI Service Calls

**What:** Enforce service-specific timeouts with clear timeout errors
**When to use:** Any long-running async operation (AI generation, file uploads)
**Example:**
```typescript
// Source: p-timeout documentation and existing AIServiceAdapter pattern
import pTimeout, { TimeoutError } from 'p-timeout';

// src/services/ai/factory.ts - Wrap service calls with timeout
export async function generateWithTimeout(
  service: AIServiceAdapter,
  prompt: string
): Promise<GenerationResult> {
  const timeout = service.getTimeout(); // Service-specific timeout

  try {
    return await pTimeout(
      service.generateImage(prompt),
      {
        milliseconds: timeout,
        message: `Image generation timed out after ${timeout / 1000} seconds`
      }
    );
  } catch (error) {
    if (error instanceof TimeoutError) {
      throw new AIServiceError(
        service.getServiceName(),
        error.message,
        `Image generation took longer than ${timeout / 1000} seconds. Try a simpler prompt or switch services.`
      );
    }
    throw error; // Re-throw other errors
  }
}

// Usage in workflow
const result = await generateWithTimeout(aiService, currentPrompt);
```

### Pattern 4: Retry Logic with Exponential Backoff

**What:** Automatically retry transient failures with increasing delays
**When to use:** Rate limits (429), server errors (500, 503), network timeouts
**Example:**
```typescript
// Source: p-retry documentation and HTTP status code standards
import pRetry, { AbortError } from 'p-retry';

// src/services/ai/factory.ts - Retry wrapper for transient errors
export async function generateWithRetry(
  service: AIServiceAdapter,
  prompt: string
): Promise<GenerationResult> {
  return await pRetry(
    async () => {
      try {
        return await service.generateImage(prompt);
      } catch (error: any) {
        const statusCode = error?.status || error?.response?.status;

        // Permanent errors - don't retry
        if (statusCode === 401 || statusCode === 400) {
          throw new AbortError(error); // p-retry stops immediately
        }

        // Transient errors - retry with backoff
        if (
          statusCode === 429 ||  // Rate limit
          statusCode === 500 ||  // Server error
          statusCode === 503 ||  // Service unavailable
          ['ETIMEDOUT', 'ECONNREFUSED'].includes(error.code)
        ) {
          console.log(pc.yellow(`Retrying after ${error.message}...`));
          throw error; // p-retry will retry
        }

        // Unknown error - don't retry by default
        throw new AbortError(error);
      }
    },
    {
      retries: 3,           // Try up to 3 times
      minTimeout: 1000,     // Start with 1 second delay
      factor: 2,            // Double delay each time (1s, 2s, 4s)
      maxTimeout: 10000,    // Cap at 10 seconds
      randomize: true,      // Add jitter to avoid thundering herd
      onFailedAttempt: (error) => {
        console.log(
          pc.yellow(
            `Attempt ${error.attemptNumber} failed. ${error.retriesLeft} retries left.`
          )
        );
      }
    }
  );
}
```

### Pattern 5: Conditional Spinner Display

**What:** Control spinner visibility based on mode (dry-run, verbose, CI)
**When to use:** Any progress indication that should adapt to execution context
**Example:**
```typescript
// Source: ora documentation for isEnabled and isSilent options
// src/workflows/generate.ts - Conditional spinner
function createSpinner(text: string, options: WorkflowOptions): any {
  const { dryRun, verbose } = options;

  return ora({
    text,
    // Dry-run mode: no spinner animation, just text
    isEnabled: !dryRun,
    // Silent mode for programmatic usage (future enhancement)
    isSilent: false
  });
}

// Usage
const spinner = createSpinner('Generating image...', options);
spinner.start();

// In dry-run mode, shows plain text without spinner animation
// In normal mode, shows animated spinner
```

### Pattern 6: Verbose Logging Mode

**What:** Conditionally show detailed progress information
**When to use:** Debugging, understanding what tool is doing, troubleshooting issues
**Example:**
```typescript
// src/workflows/generate.ts - Verbose logging
function verboseLog(message: string, options: WorkflowOptions): void {
  if (options.verbose) {
    console.log(pc.dim(`[VERBOSE] ${message}`));
  }
}

export async function generateWorkflow(options: WorkflowOptions = {}): Promise<void> {
  verboseLog(`Service: ${service}`, options);
  verboseLog(`Timeout: ${aiService.getTimeout()}ms`, options);
  verboseLog(`API key configured: ${!!configService.getApiKey(service)}`, options);

  const result = await aiService.generateImage(currentPrompt);

  verboseLog(`Generated ${result.buffer.length} bytes`, options);
  verboseLog(`Content type: ${result.contentType}`, options);

  // ... rest of workflow ...
}
```

### Anti-Patterns to Avoid

- **Persisting data in dry-run mode:** Never write files, update configs, or make API calls with side effects when --dry-run is enabled
- **Silent failures in retry logic:** Always log retry attempts so users understand delays
- **Retrying permanent errors:** Don't retry 400 Bad Request or 401 Unauthorized - these won't succeed on retry
- **Hardcoded timeouts:** Use service-specific timeouts from `getTimeout()` method, services have different performance characteristics
- **Ignoring error.code for network errors:** Always check `error.code` property, not `error.message`, for reliable error type detection
- **process.exit() instead of process.exitCode:** Prefer `process.exitCode` to allow graceful shutdown and buffered output to complete

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Promise timeouts | Custom setTimeout/clearTimeout wrappers | p-timeout library | Handles edge cases (cleanup, abort signals, custom timers for testing), 4M+ weekly downloads, 100% test coverage |
| Retry logic with exponential backoff | Custom retry loops with Math.pow delays | p-retry library | Implements jitter to avoid thundering herd, configurable retry conditions, proper error propagation, battle-tested |
| Network error messages | Parsing error.message strings | Node.js error.code property | Stable error codes (ETIMEDOUT, etc.) don't change between versions, messages may vary |
| Boolean CLI flags | Manual argv parsing | Commander.js .option() | Automatic camelCase conversion, help text generation, validation, consistent with existing CLI |
| Spinner management | Manual process.stdout.write | ora library | TTY detection, CI environment handling, proper cleanup, already in stack |

**Key insight:** Timeout and retry logic has many edge cases (cleanup on timeout, preventing retry thundering herd, handling abort signals). Well-tested libraries handle these correctly, reducing bugs and maintenance burden.

## Common Pitfalls

### Pitfall 1: Dry-Run Mode Still Persists Data

**What goes wrong:** Dry-run flag added but code still writes files or updates config
**Why it happens:** Forgot to check dry-run flag before all side-effect operations
**How to avoid:** Audit all persistence operations (writeFile, configService.set*, BackgroundManager.save) and add dry-run checks before each
**Warning signs:** Users report "dry-run still changed my settings", files appear in Zoom directory during dry-run

### Pitfall 2: Network Errors Show Generic Messages

**What goes wrong:** User sees "Error: getaddrinfo ENOTFOUND" instead of actionable guidance
**Why it happens:** Catching generic Error instead of checking error.code for network error types
**How to avoid:** Add network error handler at top of catch blocks, check error.code before other error types
**Warning signs:** Users ask "what does ETIMEDOUT mean?", error messages don't suggest solutions

### Pitfall 3: Timeout Shorter Than Service Duration

**What goes wrong:** Timeout error on working service because timeout is too aggressive
**Why it happens:** Hardcoded timeout or not respecting service-specific `getTimeout()` values
**How to avoid:** Always use `service.getTimeout()` for timeout duration, don't hardcode values
**Warning signs:** Timeout errors on HuggingFace (90s generation) with 30s timeout, free tier timeouts more than paid

### Pitfall 4: Retrying Non-Transient Errors

**What goes wrong:** Tool retries 401 Unauthorized three times, wastes 7+ seconds before failing
**Why it happens:** Retry logic doesn't distinguish permanent errors (401, 400) from transient errors (429, 503)
**How to avoid:** Use p-retry's AbortError for permanent errors to stop immediately, only retry 429, 500, 503, ETIMEDOUT, ECONNREFUSED
**Warning signs:** Long delays before showing "invalid API key" error, multiple identical error messages

### Pitfall 5: Spinner Stays Running After Error

**What goes wrong:** Error thrown but spinner still animating, terminal corrupted
**Why it happens:** Spinner.start() called but spinner.fail() not called in error path
**How to avoid:** Wrap spinner operations in try/finally, call spinner.fail() in catch, spinner.stop() in finally
**Warning signs:** Cursor hidden, terminal output garbled after error, spinner animation never stops

### Pitfall 6: Verbose Mode Logs Sensitive Data

**What goes wrong:** Verbose mode logs API keys, full error responses with sensitive info
**Why it happens:** Blindly logging all variables without filtering sensitive fields
**How to avoid:** Never log API keys (show "configured: true/false" instead), redact sensitive error fields
**Warning signs:** API keys appear in terminal output, error logs contain authorization headers

### Pitfall 7: Exit Code Always 0

**What goes wrong:** Tool fails but returns exit code 0, breaks CI/CD pipelines
**Why it happens:** Not setting process.exitCode in error handlers
**How to avoid:** Set `process.exitCode = 1` in CLI error handler, already done in existing CLI
**Warning signs:** Scripts don't detect failures, `zoombg && next-command` runs next-command even when zoombg fails

### Pitfall 8: Retry Delays Block Event Loop

**What goes wrong:** During retry delays, application is completely unresponsive
**Why it happens:** Using synchronous sleep or blocking the event loop during backoff
**How to avoid:** p-retry uses async delays that don't block event loop, never use sync sleep
**Warning signs:** Ctrl+C doesn't work during retry delays, other async operations stall

## Code Examples

Verified patterns from official sources and existing codebase.

### Commander.js Dry-Run Flag
```typescript
// Source: Commander.js README - boolean options
import { Command } from 'commander';

const program = new Command();

program
  .option('--dry-run', 'simulate operation without saving')
  .option('-v, --verbose', 'show detailed progress')
  .action((options) => {
    // Multi-word options convert to camelCase
    console.log('Dry run:', options.dryRun);    // true if --dry-run passed
    console.log('Verbose:', options.verbose);   // true if -v or --verbose passed
  });
```

### Node.js Network Error Handling
```typescript
// Source: Node.js error documentation
try {
  await someNetworkOperation();
} catch (error: any) {
  // Always check error.code, not error.message
  if (error.code === 'ETIMEDOUT') {
    console.error('Operation timed out');
  } else if (error.code === 'ECONNREFUSED') {
    console.error('Connection refused');
  } else if (error.code === 'ENOTFOUND') {
    console.error('Host not found');
  } else {
    console.error('Unexpected error:', error);
  }
}
```

### Ora Conditional Spinner
```typescript
// Source: ora README - isEnabled option
import ora from 'ora';

const spinner = ora({
  text: 'Processing...',
  isEnabled: !dryRun,   // No animation in dry-run mode
  isSilent: false       // Still shows text (unless isSilent: true)
}).start();

// Do work...

spinner.succeed('Complete');
```

### Process Exit Codes
```typescript
// Source: Node.js process documentation
import process from 'node:process';

// ✅ RECOMMENDED - allows graceful shutdown
if (error) {
  console.error('Error:', error.message);
  process.exitCode = 1;  // Exit after event loop empties
}

// ❌ NOT recommended - may lose buffered output
if (error) {
  console.error('Error:', error.message);
  process.exit(1);  // Exits immediately, may lose console output
}

// Standard exit codes:
// 0 = success
// 1 = general error
// 130 = SIGINT (Ctrl+C)
// 143 = SIGTERM
```

### Error Chaining with Cause
```typescript
// Source: MDN Error documentation
try {
  await apiCall();
} catch (error) {
  // Chain errors to preserve original context
  throw new Error('Failed to generate image', { cause: error });
}

// Higher level handler
try {
  await workflow();
} catch (error: any) {
  console.error('Error:', error.message);
  if (error.cause) {
    console.error('Caused by:', error.cause.message);
    console.error('Stack:', error.cause.stack);
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No dry-run mode | --dry-run flag standard in CLI tools | Long-standing pattern | Users can test safely, CI/CD can validate configs without side effects |
| Generic error messages | Error.code-based network error translation | Node.js v0.x onward | Reliable error detection across Node versions, actionable user messages |
| Manual retry with setTimeout | Libraries like p-retry with exponential backoff | 2015+ (npm ecosystem maturity) | Handles thundering herd, jitter, abort signals, proper cleanup |
| Hardcoded timeouts | Service-specific timeouts | API-dependent | Free tier services need 90-120s, paid services 30-60s, prevents false timeout errors |
| process.exit() everywhere | process.exitCode for graceful shutdown | Node.js v0.11+ | Buffered output completes, cleanup handlers run, better for containers |

**Deprecated/outdated:**
- **Synchronous error handling with sync throws in async code:** Always use async/await with try/catch, not sync throw in promise chains
- **Parsing error.message for error types:** Use error.code for reliable detection, messages change between versions
- **No timeout enforcement:** Modern apps timeout long-running operations, prevents indefinite hangs

## Open Questions

1. **Should retry logic be configurable via flags?**
   - What we know: p-retry supports configuration, could expose --retries and --retry-delay flags
   - What's unclear: Do users want control or prefer sensible defaults?
   - Recommendation: Phase 5 uses fixed retry config (3 retries, 1-10s backoff), Phase 6+ could add flags if users request it (LOW confidence - no user demand yet)

2. **Should dry-run mode also skip AI generation?**
   - What we know: Dry-run typically skips all side effects, but AI generation is the core operation
   - What's unclear: Do users want to test generation without saving, or test full workflow simulation?
   - Recommendation: Phase 5 dry-run generates real image but doesn't save it (tests API keys, generation works), add --simulate flag for full simulation without API calls if needed (MEDIUM confidence - "dry-run" semantics vary by tool)

3. **Should verbose mode log API request/response details?**
   - What we know: Helpful for debugging, but risks logging sensitive data
   - What's unclear: How much detail is useful vs overwhelming?
   - Recommendation: Log operation metadata (service, timeout, buffer size) but not full requests/responses or API keys (HIGH confidence - balance debugging utility with security)

4. **What timeout should be used for network errors vs API processing?**
   - What we know: p-timeout enforces overall timeout, but network connection vs API processing have different characteristics
   - What's unclear: Should we have separate connect timeout and total timeout?
   - Recommendation: Use single timeout per service from `getTimeout()` for simplicity, OpenAI SDK handles connection timeout internally (MEDIUM confidence - most SDKs handle connection timeouts)

5. **Should rate limit retry delays respect Retry-After header?**
   - What we know: HTTP 429 responses may include Retry-After header with delay seconds
   - What's unclear: Do OpenAI and Stability APIs provide this header?
   - Recommendation: Phase 5 uses exponential backoff regardless of header, Phase 6+ could parse Retry-After if available (LOW confidence - would need to test actual 429 responses from each API)

## Sources

### Primary (HIGH confidence)
- **Node.js process documentation** (https://nodejs.org/api/process.html) - Exit codes, process.exitCode vs process.exit()
- **Node.js error documentation** (https://nodejs.org/api/errors.html) - System errors, error.code property, network error codes
- **Commander.js GitHub README** (https://github.com/tj/commander.js) - Boolean options, camelCase conversion, option patterns
- **ora GitHub README** (https://github.com/sindresorhus/ora) - isEnabled and isSilent options, conditional spinner display
- **MDN Error documentation** (https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error) - Error chaining with cause property
- **Existing codebase** - ZoomBGError pattern, AIServiceAdapter interface, workflow structure, current error handling

### Secondary (MEDIUM confidence)
- **p-timeout GitHub README** (https://github.com/sindresorhus/p-timeout) - Promise timeout wrapper API, TimeoutError handling
- **p-retry GitHub README** (https://github.com/sindresorhus/p-retry) - Exponential backoff configuration, retry condition patterns
- **Inquirer.js documentation** (https://github.com/SBoudrias/Inquirer.js) - Non-interactive mode patterns, AbortSignal usage

### Tertiary (LOW confidence - needs verification)
- **OpenAI retry configuration** - SDK likely includes retry logic but specific configuration not documented in README
- **Stability AI rate limit headers** - Unknown if Retry-After header is provided on 429 responses
- **Dry-run semantics** - Different tools interpret --dry-run differently (skip all operations vs skip persistence only)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in dependencies except p-timeout/p-retry (optional enhancements), versions verified 2026-02-22
- Architecture patterns: MEDIUM-HIGH - Dry-run and conditional execution are standard patterns, network error handling is well-documented, timeout/retry patterns are from battle-tested libraries
- Error handling: HIGH - Node.js error codes are stable API, existing ZoomBGError pattern supports user-friendly messages
- Timeout/retry: MEDIUM - p-timeout/p-retry are optional additions, existing code works without them but would benefit from explicit timeout enforcement and retry logic
- Dry-run implementation: HIGH - Clear separation between generation and persistence in existing workflow makes dry-run straightforward

**Research date:** 2026-02-22
**Valid until:** 2026-03-22 (30 days - stable patterns, Node.js APIs don't change frequently)

**Known gaps:**
- OpenAI SDK internal retry/timeout configuration not documented (may have built-in retry)
- Stability AI SDK timeout behavior not explicitly documented
- Exact 429 response format (Retry-After header presence) unknown without testing
- User preference for dry-run semantics (skip generation or just skip save) requires validation
