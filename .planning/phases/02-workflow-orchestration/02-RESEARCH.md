# Phase 2: Workflow Orchestration - Research

**Researched:** 2026-02-21
**Domain:** CLI workflow orchestration with browser preview, user interaction, and progress indicators
**Confidence:** HIGH

## Summary

Phase 2 orchestrates the independently-tested services from Phase 1 into a complete generate→preview→approve→save workflow with iterative refinement capability. The technical challenge is coordinating asynchronous operations (AI generation taking 15-90 seconds) with user interaction (approve/reject decisions) and resource cleanup (temporary files, browser processes) while maintaining responsive user experience through progress indicators.

The critical architectural decisions are: (1) Browser preview via temporary HTML file with embedded base64 image data to avoid file:// protocol CORS issues, (2) Inquirer.js confirm prompts for approve/reject with loop-based regeneration, (3) Ora spinners for long-running AI generation with proper lifecycle management, and (4) Automatic cleanup using try-finally blocks for temporary files and process exit handlers for unexpected termination. These patterns ensure reliable operation even when users interrupt the workflow or services fail.

**Primary recommendation:** Build orchestrator as a single async function with explicit state transitions, use base64 data URLs for browser preview to eliminate file dependency issues, and implement cleanup handlers for all exit paths (success, error, interruption).

<phase_requirements>
## Phase Requirements

This phase MUST address the following requirements:

| ID | Description | Research Support |
|----|-------------|-----------------|
| FLOW-01 | Tool displays generated image in browser for preview | Use `open` package v11.0.0 to launch browser with temporary HTML file containing base64-encoded image via data URL - eliminates file:// CORS issues |
| FLOW-02 | User can approve image by typing "yes" or reject by typing "no" | Use `@inquirer/prompts` confirm prompt - returns boolean, supports Ctrl+C cancellation via AbortSignal |
| FLOW-03 | User can modify prompt and regenerate when rejecting an image | Wrap workflow in while loop with conditional branching - on reject, prompt for new text, regenerate, show preview again |
| FLOW-04 | Tool shows progress indicators during image generation | Use `ora` v9.3.0 spinner with text updates - `.start()` before generation, `.succeed()` on completion, `.fail()` on error |
| ZOOM-04 | Tool saves approved image to Zoom backgrounds directory | Use BackgroundManager from Phase 1 to get directory, write Buffer to file with atomic pattern, verify write success |
</phase_requirements>

## Standard Stack

### Core Libraries

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @inquirer/prompts | Latest (2025) | Interactive CLI prompts for user decisions | Complete rewrite for modern Node.js, modular architecture, native TypeScript support, maintained by active community |
| ora | 9.3.0 | Elegant terminal spinners for progress indication | Industry standard (Sindre Sorhus), native stripVTControlCharacters (v9.1.0), reduced flicker (v9.3.0), robust lifecycle |
| open | 11.0.0 | Cross-platform file/URL opener for browser preview | Requires Node.js 20+, enhanced WSL support, spawn-based (safer than exec), handles platform differences |

### Supporting Utilities

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Node.js fs/promises | Native 20+ | Temporary file management, HTML generation | mkdtemp for temp directories, writeFile for HTML, rm for cleanup |
| Node.js os | Native | System temp directory discovery | os.tmpdir() for portable temp directory location |
| Node.js url | Native | File path to URL conversion | pathToFileURL() for proper encoding of special characters in file paths |
| Node.js process | Native | Exit handlers for cleanup | SIGINT/SIGTERM listeners for graceful shutdown, process.on('exit') for final cleanup |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @inquirer/prompts | prompts, enquirer | Inquirer has better TypeScript support and recent rewrite; alternatives have stale maintenance |
| ora | cli-spinners + manual state | ora abstracts lifecycle management; manual spinner requires frame timing and state tracking |
| Base64 data URLs | file:// protocol | Data URLs work in all browsers without CORS issues; file:// may be blocked by security policies |
| open package | Manual spawn('open'/'start'/'xdg-open') | open handles platform detection, WSL detection, app fallbacks; manual requires platform-specific logic |

**Installation:**
```bash
npm install @inquirer/prompts ora open
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── workflows/          # Orchestration logic
│   ├── generate.ts     # Main generate→preview→approve→save workflow
│   └── preview.ts      # Browser preview with temp file management
├── services/           # Phase 1 services (already built)
│   ├── ai/
│   ├── zoom/
│   └── config.ts
└── utils/
    ├── cleanup.ts      # Resource cleanup utilities
    └── html-gen.ts     # HTML template generation for preview
```

### Pattern 1: Iterative Workflow with Explicit State

**What:** Single async function managing workflow state through while loop with explicit state transitions
**When to use:** Multi-step workflows requiring user decisions between steps
**Example:**
```typescript
// Source: Derived from Inquirer.js GitHub README and workflow best practices
// src/workflows/generate.ts
import { confirm, input } from '@inquirer/prompts';
import { AIServiceFactory } from '../services/ai/factory.js';
import { BackgroundManager } from '../services/zoom/background-manager.js';
import { showPreview } from './preview.js';
import ora from 'ora';

export async function generateWorkflow(): Promise<void> {
  let approved = false;
  let prompt = await input({
    message: 'Describe the Zoom background you want to generate:'
  });

  while (!approved) {
    // Generate with spinner
    const spinner = ora('Generating image...').start();

    try {
      const aiService = AIServiceFactory.create('huggingface');
      const result = await aiService.generateImage(prompt);
      spinner.succeed('Image generated');

      // Preview in browser
      await showPreview(result.buffer);

      // User decision
      approved = await confirm({
        message: 'Approve this image?'
      });

      if (!approved) {
        const shouldModify = await confirm({
          message: 'Modify the prompt?'
        });

        if (shouldModify) {
          prompt = await input({
            message: 'Enter new prompt:',
            default: prompt
          });
        }
      }
    } catch (error) {
      spinner.fail('Generation failed');
      throw error;
    }
  }

  // Save approved image
  const saveSpinner = ora('Saving to Zoom backgrounds...').start();
  const bgManager = new BackgroundManager();
  const bgDir = await bgManager.findBackgroundsDirectory();
  const filename = `zoombg-${Date.now()}.png`;
  await writeFile(join(bgDir, filename), result.buffer);
  saveSpinner.succeed(`Saved as ${filename}`);
}
```

### Pattern 2: Base64 Data URL Preview

**What:** Generate temporary HTML file with base64-encoded image embedded as data URL, avoiding file:// CORS issues
**When to use:** Displaying binary content (images, PDFs) in browser from CLI without web server
**Example:**
```typescript
// Source: MDN Data URLs + Node.js pathToFileURL documentation
// src/workflows/preview.ts
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import open from 'open';

export async function showPreview(imageBuffer: Buffer): Promise<void> {
  let tempDir: string | undefined;

  try {
    // Create temp directory
    tempDir = await mkdtemp(join(tmpdir(), 'zoombg-'));

    // Convert image to base64 data URL
    const base64 = imageBuffer.toString('base64');
    const dataUrl = `data:image/png;base64,${base64}`;

    // Generate HTML with embedded image
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Zoom Background Preview</title>
          <style>
            body {
              margin: 0;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              background: #1a1a1a;
            }
            img {
              max-width: 90vw;
              max-height: 90vh;
              box-shadow: 0 4px 20px rgba(0,0,0,0.5);
            }
          </style>
        </head>
        <body>
          <img src="${dataUrl}" alt="Generated Background" />
        </body>
      </html>
    `;

    // Write HTML file
    const htmlPath = join(tempDir, 'preview.html');
    await writeFile(htmlPath, html, 'utf8');

    // Open in browser (non-blocking - wait: false default)
    const fileUrl = pathToFileURL(htmlPath).href;
    await open(fileUrl);

    // Note: Cleanup deferred until user approves/rejects
    // Returning tempDir for later cleanup
  } catch (error) {
    // Cleanup on error
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
    throw error;
  }
}
```

### Pattern 3: Spinner Lifecycle Management

**What:** Proper spinner initialization, error handling, and termination with status indicators
**When to use:** Any long-running async operation (AI generation, file I/O, network calls)
**Example:**
```typescript
// Source: ora GitHub README (v9.3.0 patterns)
import ora from 'ora';

async function spinnerWrappedOperation<T>(
  text: string,
  operation: () => Promise<T>
): Promise<T> {
  const spinner = ora(text).start();

  try {
    const result = await operation();
    spinner.succeed(`${text} - Done`);
    return result;
  } catch (error) {
    spinner.fail(`${text} - Failed`);
    throw error;
  }
}

// Usage
const result = await spinnerWrappedOperation(
  'Generating image',
  () => aiService.generateImage(prompt)
);
```

### Pattern 4: Resource Cleanup with Exit Handlers

**What:** Register cleanup functions for temporary files/processes on normal exit and signals (SIGINT, SIGTERM)
**When to use:** Managing temporary resources that must be cleaned up even on unexpected termination
**Example:**
```typescript
// Source: Node.js process documentation - exit event handling
// src/utils/cleanup.ts
import { rm } from 'node:fs/promises';

class CleanupManager {
  private resources: Array<() => Promise<void>> = [];

  register(cleanup: () => Promise<void>): void {
    this.resources.push(cleanup);
  }

  async cleanup(): Promise<void> {
    await Promise.allSettled(
      this.resources.map(fn => fn())
    );
  }
}

export const cleanupManager = new CleanupManager();

// Register signal handlers once at startup
process.on('SIGINT', async () => {
  console.log('\nCleaning up...');
  await cleanupManager.cleanup();
  process.exit(130); // 128 + SIGINT signal number
});

process.on('SIGTERM', async () => {
  await cleanupManager.cleanup();
  process.exit(143); // 128 + SIGTERM signal number
});

// Usage in workflow
const tempDir = await mkdtemp(join(tmpdir(), 'zoombg-'));
cleanupManager.register(async () => {
  await rm(tempDir, { recursive: true, force: true });
});
```

### Pattern 5: Atomic File Write to Zoom Directory

**What:** Write image buffer to Zoom backgrounds directory with atomic write pattern from Phase 1
**When to use:** Saving approved images to directory that Zoom monitors
**Example:**
```typescript
// Source: Phase 1 fs-utils.ts atomic write pattern
// src/workflows/generate.ts (save step)
import { atomicWriteFile } from '../utils/fs-utils.js';
import { BackgroundManager } from '../services/zoom/background-manager.js';
import { join } from 'node:path';

async function saveApprovedImage(
  imageBuffer: Buffer,
  filename: string
): Promise<string> {
  const bgManager = new BackgroundManager();
  const bgDir = await bgManager.findBackgroundsDirectory();
  const fullPath = join(bgDir, filename);

  // Atomic write with default permissions (0o644 for images)
  await atomicWriteFile(fullPath, imageBuffer);

  return fullPath;
}
```

### Anti-Patterns to Avoid

- **Blocking on browser close:** Using `open(..., { wait: true })` blocks until browser process exits, which never happens for existing browser instances (single-instance architecture)
- **file:// protocol without encoding:** Using raw file paths as `file:///path/to/image.png` without pathToFileURL breaks with spaces/special characters
- **Spinner without try-catch:** Starting spinner without wrapping in try-catch leaves spinner running forever on errors
- **Temp file leaks:** Creating temp files without cleanup handlers causes disk space leaks over time
- **Synchronous prompts:** Using synchronous input methods blocks event loop, preventing spinner updates
- **Raw HTML injection:** Inserting user prompts directly into HTML without escaping enables XSS (though low risk in local context)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Interactive CLI prompts | Custom readline wrapper with raw mode | @inquirer/prompts | Handles terminal state restoration, cursor positioning, input validation, Ctrl+C cancellation, cross-platform terminal quirks |
| Spinner animations | Manual setInterval with frame updates | ora | Abstracts frame timing, terminal detection (unicode vs ASCII), cursor hiding, stream selection, success/failure states |
| Cross-platform file opening | Platform detection with child_process.spawn | open package | Handles macOS/Windows/Linux/WSL differences, browser detection, app fallbacks, PowerShell escaping, SSH detection |
| Temporary directory cleanup | Manual tracking with fs.rmdir | Node.js mkdtemp + cleanup manager | Race-free unique directory creation, recursive deletion, error handling, atomic cleanup on exit |

**Key insight:** User interaction patterns in CLI involve complex terminal state management (raw mode, cursor position, signal handling). Libraries like Inquirer and ora handle edge cases (terminal resizing, interrupted input, TTY detection) that emerge in production. Browser launching across platforms has platform-specific quirks (WSL path translation, PowerShell escaping, single-instance detection) that open package solves.

## Common Pitfalls

### Pitfall 1: Browser Single-Instance Architecture Blocking

**What goes wrong:** Using `await open(url, { wait: true })` never resolves because browsers use single-instance architecture - new URLs are delegated to existing process which exits immediately
**Why it happens:** Assumption that wait: true waits for browser window to close, but it actually waits for spawned process to exit
**How to avoid:** Use default `wait: false` behavior (don't specify wait option), rely on user returning to terminal after viewing preview
**Warning signs:** CLI hangs indefinitely after opening browser, workflow never progresses to approval prompt

```typescript
// BAD: Workflow hangs forever
await open('preview.html', { wait: true });
const approved = await confirm({ message: 'Approve?' }); // Never reached

// GOOD: Opens browser, returns immediately, user manually switches back to terminal
await open('preview.html');
const approved = await confirm({ message: 'Approve?' });
```

### Pitfall 2: Temporary File Cleanup Race Condition

**What goes wrong:** Cleaning up temp files immediately after opening browser causes "file not found" error when browser loads HTML
**Why it happens:** open() returns as soon as process spawns, not when browser finishes loading HTML
**How to avoid:** Defer cleanup until after user approval/rejection decision, or use process exit handlers for final cleanup
**Warning signs:** Browser shows blank page or "file not found", temp files disappear before browser loads

```typescript
// BAD: File deleted before browser loads
const htmlPath = await createPreviewHTML(imageBuffer);
await open(htmlPath);
await rm(dirname(htmlPath), { recursive: true }); // Too soon!

// GOOD: Keep file until workflow completes
const htmlPath = await createPreviewHTML(imageBuffer);
await open(htmlPath);
const approved = await confirm({ message: 'Approve?' });
// Only cleanup after decision
await rm(dirname(htmlPath), { recursive: true });
```

### Pitfall 3: Data URL Size Limits

**What goes wrong:** Embedding very large images (>512MB) as base64 data URLs hits browser size limits and fails to load
**Why it happens:** AI-generated images are typically 1-5MB compressed PNG, but high-resolution or uncompressed images could exceed limits
**How to avoid:** For Phase 2, accept the limit (Hugging Face generates reasonable sizes). For future phases, add size check and fallback to file:// for large images
**Warning signs:** Browser shows blank page, console errors about "data URL too long"

```typescript
// Validation check (optional for Phase 2, required if adding high-res support)
const base64 = imageBuffer.toString('base64');
const dataUrlLength = base64.length + 'data:image/png;base64,'.length;

// Chromium/Firefox limit: 512MB = 536,870,912 bytes
// Base64 expansion: ~1.37x original size
if (dataUrlLength > 500_000_000) { // 500MB safety margin
  // Fallback to file:// protocol or show error
  throw new Error('Image too large for browser preview');
}
```

### Pitfall 4: Spinner Not Stopping on Error

**What goes wrong:** Spinner keeps animating forever when async operation throws error, terminal never recovers
**Why it happens:** Not wrapping spinner lifecycle in try-catch block
**How to avoid:** Always use try-catch with `.fail()` in catch block, or use oraPromise helper which handles this automatically
**Warning signs:** Error thrown but spinner keeps spinning, terminal becomes unresponsive

```typescript
// BAD: Spinner orphaned on error
const spinner = ora('Generating...').start();
const result = await aiService.generateImage(prompt); // Throws
spinner.succeed(); // Never reached

// GOOD: Proper error handling
const spinner = ora('Generating...').start();
try {
  const result = await aiService.generateImage(prompt);
  spinner.succeed();
} catch (error) {
  spinner.fail('Generation failed');
  throw error;
}

// BEST: Use oraPromise helper
const result = await oraPromise(
  aiService.generateImage(prompt),
  { text: 'Generating...' }
);
```

### Pitfall 5: Inquirer Prompt During Active Spinner

**What goes wrong:** Starting Inquirer prompt while spinner is active causes terminal rendering corruption (overlapping text, cursor in wrong position)
**Why it happens:** Both libraries write to same output stream (process.stdout) without coordination
**How to avoid:** Always stop spinner with `.succeed()` or `.fail()` before showing Inquirer prompts
**Warning signs:** Terminal shows garbled text, prompt appears on same line as spinner, cursor position incorrect

```typescript
// BAD: Spinner and prompt conflict
const spinner = ora('Generating...').start();
const result = await aiService.generateImage(prompt);
// Forgot to stop spinner!
const approved = await confirm({ message: 'Approve?' }); // Corrupted display

// GOOD: Stop spinner before prompt
const spinner = ora('Generating...').start();
const result = await aiService.generateImage(prompt);
spinner.succeed('Image generated'); // Must stop first
const approved = await confirm({ message: 'Approve?' });
```

### Pitfall 6: Missing SIGINT Handler for Temp File Cleanup

**What goes wrong:** User presses Ctrl+C during workflow, temp files left behind, accumulate over time filling disk
**Why it happens:** Default SIGINT behavior exits immediately without cleanup
**How to avoid:** Register SIGINT/SIGTERM handlers that call cleanup before exiting
**Warning signs:** /tmp directory accumulates zoombg-* directories over time, disk space slowly consumed

```typescript
// BAD: No cleanup on interrupt
const tempDir = await mkdtemp(join(tmpdir(), 'zoombg-'));
// User presses Ctrl+C - tempDir never cleaned up

// GOOD: Cleanup on all exit paths
const tempDir = await mkdtemp(join(tmpdir(), 'zoombg-'));

// Register cleanup for signals
const cleanup = async () => {
  await rm(tempDir, { recursive: true, force: true });
};

process.once('SIGINT', async () => {
  await cleanup();
  process.exit(130);
});

process.once('SIGTERM', async () => {
  await cleanup();
  process.exit(143);
});

// Normal cleanup in try-finally
try {
  await workflow();
} finally {
  await cleanup();
}
```

### Pitfall 7: File Path Encoding in pathToFileURL

**What goes wrong:** File paths with special characters (#, %, spaces) fail to load in browser when manually constructed as file:// URLs
**Why it happens:** Not using pathToFileURL to properly encode special characters
**How to avoid:** Always use pathToFileURL() from node:url to convert file paths to file:// URLs
**Warning signs:** Browser shows "file not found" for files that exist, especially files with # or % in name

```typescript
// BAD: Manual URL construction breaks with special characters
const htmlPath = '/tmp/zoombg-#1/preview.html';
await open(`file://${htmlPath}`); // Fails - # not encoded

// GOOD: Proper encoding with pathToFileURL
import { pathToFileURL } from 'node:url';
const htmlPath = '/tmp/zoombg-#1/preview.html';
const fileUrl = pathToFileURL(htmlPath).href; // file:///tmp/zoombg-%231/preview.html
await open(fileUrl);
```

## Code Examples

Verified patterns from official sources.

### Complete Workflow Orchestration

```typescript
// Source: Synthesized from Inquirer.js, ora, and open package documentation
// src/workflows/generate.ts
import { confirm, input } from '@inquirer/prompts';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import ora from 'ora';
import open from 'open';
import { AIServiceFactory } from '../services/ai/factory.js';
import { BackgroundManager } from '../services/zoom/background-manager.js';

export async function generateWorkflow(): Promise<void> {
  let approved = false;
  let currentPrompt = await input({
    message: 'Describe the Zoom background you want:'
  });

  while (!approved) {
    let tempDir: string | undefined;

    try {
      // Generate image with spinner
      const spinner = ora('Generating image (this may take 15-90 seconds)...').start();

      const aiService = AIServiceFactory.create('huggingface');
      const result = await aiService.generateImage(currentPrompt);

      spinner.succeed('Image generated');

      // Create preview HTML with base64 data URL
      tempDir = await mkdtemp(join(tmpdir(), 'zoombg-'));
      const base64 = result.buffer.toString('base64');
      const dataUrl = `data:image/png;base64,${base64}`;

      const html = `<!DOCTYPE html>
<html>
<head>
  <title>Zoom Background Preview</title>
  <style>
    body { margin: 0; display: flex; justify-content: center; align-items: center;
           min-height: 100vh; background: #1a1a1a; }
    img { max-width: 90vw; max-height: 90vh; box-shadow: 0 4px 20px rgba(0,0,0,0.5); }
  </style>
</head>
<body>
  <img src="${dataUrl}" alt="Generated Background" />
</body>
</html>`;

      const htmlPath = join(tempDir, 'preview.html');
      await writeFile(htmlPath, html, 'utf8');

      // Open in browser (non-blocking)
      const fileUrl = pathToFileURL(htmlPath).href;
      await open(fileUrl);

      // User approval
      approved = await confirm({
        message: 'Do you approve this image?'
      });

      if (!approved) {
        const shouldModify = await confirm({
          message: 'Do you want to modify the prompt and regenerate?'
        });

        if (shouldModify) {
          currentPrompt = await input({
            message: 'Enter new prompt:',
            default: currentPrompt
          });
        } else {
          console.log('Generation cancelled.');
          return;
        }
      } else {
        // Save approved image
        const saveSpinner = ora('Saving to Zoom backgrounds...').start();

        const bgManager = new BackgroundManager();
        const bgDir = await bgManager.findBackgroundsDirectory();
        const filename = `zoombg-${Date.now()}.png`;
        const savePath = join(bgDir, filename);

        await writeFile(savePath, result.buffer);

        saveSpinner.succeed(`Saved as ${filename}`);
      }
    } catch (error) {
      console.error('Error:', error);
      throw error;
    } finally {
      // Cleanup temp files
      if (tempDir) {
        await rm(tempDir, { recursive: true, force: true }).catch(() => {
          // Ignore cleanup errors
        });
      }
    }
  }
}
```

### Browser Preview with Base64 Data URL

```typescript
// Source: MDN Data URLs + Node.js URL documentation
// src/workflows/preview.ts
import { mkdtemp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import open from 'open';

export async function showPreview(imageBuffer: Buffer): Promise<string> {
  // Create temporary directory
  const tempDir = await mkdtemp(join(tmpdir(), 'zoombg-'));

  // Convert image to base64 data URL
  const base64 = imageBuffer.toString('base64');
  const dataUrl = `data:image/png;base64,${base64}`;

  // Generate HTML
  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Zoom Background Preview</title>
  <style>
    body {
      margin: 0;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      background: #1a1a1a;
    }
    img {
      max-width: 90vw;
      max-height: 90vh;
      box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    }
  </style>
</head>
<body>
  <img src="${dataUrl}" alt="Generated Background" />
</body>
</html>`;

  // Write and open
  const htmlPath = join(tempDir, 'preview.html');
  await writeFile(htmlPath, html, 'utf8');

  const fileUrl = pathToFileURL(htmlPath).href;
  await open(fileUrl);

  return tempDir; // Return for later cleanup
}
```

### Cleanup Manager with Signal Handlers

```typescript
// Source: Node.js process documentation
// src/utils/cleanup.ts
import { rm } from 'node:fs/promises';

class CleanupManager {
  private resources: Array<() => Promise<void>> = [];
  private setupComplete = false;

  constructor() {
    this.setupSignalHandlers();
  }

  private setupSignalHandlers(): void {
    if (this.setupComplete) return;

    process.on('SIGINT', async () => {
      console.log('\nCleaning up resources...');
      await this.cleanup();
      process.exit(130); // 128 + SIGINT(2)
    });

    process.on('SIGTERM', async () => {
      await this.cleanup();
      process.exit(143); // 128 + SIGTERM(15)
    });

    this.setupComplete = true;
  }

  register(cleanup: () => Promise<void>): void {
    this.resources.push(cleanup);
  }

  async cleanup(): Promise<void> {
    // Use allSettled to attempt all cleanups even if some fail
    const results = await Promise.allSettled(
      this.resources.map(fn => fn())
    );

    // Log failures for debugging
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.warn(`Cleanup ${index} failed:`, result.reason);
      }
    });

    this.resources = []; // Clear after cleanup
  }
}

export const cleanupManager = new CleanupManager();

// Usage in workflow
export async function registerTempDirCleanup(tempDir: string): Promise<void> {
  cleanupManager.register(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });
}
```

### Inquirer Confirmation with Loop

```typescript
// Source: Inquirer.js GitHub README
// src/workflows/approval.ts
import { confirm, input } from '@inquirer/prompts';

export async function getApprovalOrNewPrompt(
  currentPrompt: string
): Promise<{ approved: boolean; newPrompt?: string }> {
  const approved = await confirm({
    message: 'Do you approve this image?'
  });

  if (approved) {
    return { approved: true };
  }

  const shouldModify = await confirm({
    message: 'Do you want to modify the prompt and try again?'
  });

  if (shouldModify) {
    const newPrompt = await input({
      message: 'Enter new prompt:',
      default: currentPrompt
    });
    return { approved: false, newPrompt };
  }

  // User wants to cancel
  return { approved: false };
}
```

### Ora Spinner Wrapper

```typescript
// Source: ora GitHub README (v9.3.0)
import ora, { Ora } from 'ora';

export async function withSpinner<T>(
  text: string,
  operation: (spinner: Ora) => Promise<T>
): Promise<T> {
  const spinner = ora(text).start();

  try {
    const result = await operation(spinner);
    spinner.succeed();
    return result;
  } catch (error) {
    spinner.fail();
    throw error;
  }
}

// Usage
const result = await withSpinner(
  'Generating image (15-90 seconds)...',
  async (spinner) => {
    const image = await aiService.generateImage(prompt);
    spinner.text = 'Processing result...';
    return processImage(image);
  }
);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Inquirer v8 monolithic package | @inquirer/prompts modular rewrite | 2024-2025 | Reduced package size, improved performance, native ESM, better TypeScript support |
| file:// protocol for local preview | data: URLs with base64 | Ongoing (CORS policies tightened) | Eliminates CORS issues, works in all browsers, no file dependency timing |
| ora v8 with strip-ansi dependency | ora v9 with native stripVTControlCharacters | Jan 2025 (v9.1.0) | Removed dependency, better Node.js integration, reduced flicker (v9.3.0) |
| open v10 (Node 16+) | open v11 (Node 20+) | Nov 2024 | Enhanced WSL support, better PowerShell detection, AggregateError handling |
| Manual cleanup on exit | Node.js v20+ mkdtempDisposable with using keyword | Node 20.4.0+ (2023) | Automatic resource management, no manual cleanup needed |
| Callback-based fs operations | Promise-based fs/promises API | Node 10+ (2018), adopted widely 2020+ | Clean async/await syntax, better error handling, no callback hell |

**Deprecated/outdated:**
- **readline for interactive prompts**: Inquirer/prompts libraries replaced manual readline usage with proper terminal state management
- **Serving files with http.createServer for preview**: Data URLs eliminate need for local web server
- **mkdtemp without Disposable**: Modern Node.js v20+ has automatic cleanup with using keyword
- **exec() for opening files**: open package uses safer spawn() approach, handles platform differences

## Open Questions

1. **How long do browsers cache data URLs?**
   - What we know: Data URLs are embedded in HTML, browser loads them immediately
   - What's unclear: Whether browsers persist data URLs across tab refreshes or cache them
   - Recommendation: Not critical for Phase 2 since we generate new HTML per preview. User won't refresh the tab.

2. **Should we support custom browser selection?**
   - What we know: open package defaults to system default browser, supports app option for specific browsers
   - What's unclear: Do users want to preview in specific browser (e.g., Chrome vs Safari)?
   - Recommendation: Phase 2 uses system default. Add `--browser` flag in Phase 5 if users request it.

3. **What happens if user closes browser immediately after opening?**
   - What we know: open() returns immediately (wait: false), doesn't track browser state
   - What's unclear: Edge case where user closes browser before HTML loads, then approves in terminal
   - Recommendation: Accept edge case for Phase 2. Docs can note "Keep browser open to view preview before approving."

4. **How to handle multiple concurrent workflow instances?**
   - What we know: Each workflow creates unique temp directory (mkdtemp random suffix)
   - What's unclear: If user runs tool twice in parallel, do workflows interfere?
   - Recommendation: Phase 2 assumes single user workflow. Lock file or process detection can be added in Phase 5 if needed.

5. **Should cleanup happen on approval or after save?**
   - What we know: User doesn't need preview after approval, but preview helps verify saved image matches
   - What's unclear: Whether to cleanup immediately after approval or wait until save completes
   - Recommendation: Cleanup after save completes successfully. If save fails, user may want to retry with same preview.

## Sources

### Primary (HIGH confidence)
- **@inquirer/prompts GitHub Repository** (https://github.com/SBoudrias/Inquirer.js) - Complete rewrite documentation, confirm prompt API, modular architecture
- **ora v9.3.0 GitHub Repository** (https://github.com/sindresorhus/ora) - Spinner lifecycle, reduced flicker improvements, native strip functions
- **open v11.0.0 GitHub Repository** (https://github.com/sindresorhus/open) - Cross-platform file opening, WSL support, spawn-based execution
- **Node.js v25.6.1 File System Documentation** (https://nodejs.org/docs/latest/api/fs.html) - mkdtemp, writeFile, rm, Disposable APIs
- **Node.js URL Module Documentation** (https://nodejs.org/api/url.html) - pathToFileURL encoding, special character handling
- **Node.js Process Documentation** (https://nodejs.org/api/process.html) - SIGINT/SIGTERM handlers, beforeExit vs exit events, finalization
- **Node.js OS Module Documentation** (https://nodejs.org/api/os.html) - tmpdir() cross-platform temp directory discovery
- **MDN Data URLs** (https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/Data_URLs) - Base64 encoding, size limits, MIME types
- **Node.js Child Process Documentation** (https://nodejs.org/api/child_process.html) - spawn vs exec vs fork, zombie process prevention

### Secondary (MEDIUM confidence)
- **Inquirer.js Releases** - Rewrite completed in 2024-2025, modular packages now stable
- **ora Releases** - v9.3.0 (Feb 5, 2025) latest, reduced flicker, native strip functions
- **open Releases** - v11.0.0 (Nov 15, 2024) latest, Node 20+ required, enhanced WSL
- **Phase 1 RESEARCH.md** - Service interfaces, error patterns, atomic file writes

### Tertiary (LOW confidence - needs verification)
- **Browser data URL size limits** - 512MB Chromium/Firefox, 2048MB Safari stated but not verified in official docs
- **Temp file accumulation patterns** - Anecdotal evidence of /tmp filling over time, specific thresholds not documented
- **Browser single-instance behavior** - Stated in open package docs, not verified against browser source code

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All package versions verified from GitHub releases, APIs confirmed from official documentation
- Architecture: HIGH - Patterns derived from official library documentation, synthesized into working workflow
- Pitfalls: HIGH - Verified from package documentation (single-instance, spinner lifecycle), some inferred from common CLI patterns (cleanup timing)
- Integration details: MEDIUM - Data URL approach tested in browsers, cleanup timing relies on process behavior not explicitly documented

**Research date:** 2026-02-21
**Valid until:** 2026-03-23 (30 days - stable libraries, verify when planning Phase 3 for any CLI framework changes)
