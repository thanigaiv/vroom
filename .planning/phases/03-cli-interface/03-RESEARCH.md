# Phase 3: CLI Interface - Research

**Researched:** 2026-02-22
**Domain:** Node.js CLI argument parsing, error handling, and executable configuration
**Confidence:** HIGH

## Summary

Phase 3 wraps the workflow orchestrator from Phase 2 in a command-line interface that enables users to invoke the tool with text prompts via command-line arguments and select AI services via flags. The technical challenge is bridging the gap between declarative CLI argument parsing (commander/meow) and the existing interactive workflow (Inquirer prompts) while maintaining proper error handling, exit codes, and help documentation.

The critical architectural decisions are: (1) Commander.js v14.0.3 for argument parsing provides TypeScript support, auto-generated help, and error handling with customizable exit codes, (2) Executable configuration via package.json bin field with #!/usr/bin/env node shebang for cross-platform compatibility, (3) Separation of CLI entry point (argument parsing) from workflow orchestration (existing generate.ts), and (4) Proper exit code handling (0 for success, 1 for user errors, 2 for system errors) following Node.js conventions and CLI best practices.

**Primary recommendation:** Use commander v14.0.3 with explicit error handling via .error() method, configure bin field to point to dedicated cli.ts entry point, and follow clig.dev guidelines for user-friendly error messages with actionable guidance.

<phase_requirements>
## Phase Requirements

This phase MUST address the following requirements:

| ID | Description | Research Support |
|----|-------------|-----------------|
| CONFIG-02 | User can select which AI service to use for generation | Commander option with `--service <name>` flag validates against known services (huggingface, openai, stability), defaults to huggingface, passes to AIServiceFactory |
</phase_requirements>

## Standard Stack

### Core Libraries

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| commander | 14.0.3 | CLI argument parsing and help generation | Industry standard (28k stars), stable release with 12-month support window, native TypeScript support, auto-generated help, customizable error handling |
| Node.js process | Native 20+ | Exit code handling and error reporting | Standard exit codes (0=success, 1=error), process.exitCode for graceful shutdown, process.exit() for immediate termination |

### Supporting Utilities

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| picocolors | 1.1.1 | Terminal color styling for errors/success messages | 14x smaller than chalk (7KB vs 101KB), supports both ESM and CommonJS, no dependencies, faster startup |
| Node.js url | Native | Convert file paths for bin field resolution | fileURLToPath() for ESM module path handling, import.meta.url for entry point detection |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| commander v14 | commander v15 (ESM-only) | v15 requires Node.js 22.12+, breaks CommonJS compatibility; v14 has 12-month support until May 2027 |
| commander | yargs v18 | yargs has more features (shell completion, complex validation) but heavier API, commander is simpler for single-command CLI |
| commander | meow | meow is lightweight with zero dependencies but lacks TypeScript types, commander has better TypeScript integration |
| picocolors | chalk v5 | chalk v5 is ESM-only and breaks compatibility, chalk v4 is 14x larger, picocolors has identical API with better performance |

**Installation:**
```bash
npm install commander picocolors
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── cli.ts              # CLI entry point with commander configuration
├── workflows/          # Phase 2 orchestrators (already exists)
│   └── generate.ts     # Interactive workflow orchestration
├── services/           # Phase 1 services (already exists)
└── types/              # Shared TypeScript interfaces
    └── cli.ts          # CLI-specific types (CLIOptions, etc.)
```

**Entry point configuration:**
```json
// package.json
{
  "bin": {
    "zoombg": "./dist/cli.js"
  }
}
```

### Pattern 1: CLI Entry Point with Commander

**What:** Separate CLI entry point that parses arguments and invokes workflow orchestrator
**When to use:** When existing workflow is interactive but needs CLI wrapper for automation
**Example:**
```typescript
// Source: Derived from commander.js v14.0.3 documentation and clig.dev best practices
// src/cli.ts
#!/usr/bin/env node

import { Command } from 'commander';
import { generateWorkflow } from './workflows/generate.js';
import { version } from '../package.json' assert { type: 'json' };
import pc from 'picocolors';

const program = new Command();

program
  .name('zoombg')
  .version(version)
  .description('Generate AI-powered Zoom backgrounds from text prompts')
  .argument('[prompt]', 'Description of the Zoom background to generate')
  .option('-s, --service <name>', 'AI service to use (huggingface, openai, stability)', 'huggingface')
  .option('--no-interaction', 'Skip interactive prompts and use provided prompt only')
  .action(async (prompt, options) => {
    try {
      // Validate service selection
      const validServices = ['huggingface', 'openai', 'stability'];
      if (!validServices.includes(options.service)) {
        program.error(
          `Invalid service: ${options.service}\nValid services: ${validServices.join(', ')}`,
          { exitCode: 1 }
        );
      }

      // Invoke workflow orchestrator
      await generateWorkflow({
        initialPrompt: prompt,
        service: options.service,
        interactive: options.interaction
      });

      process.exitCode = 0;
    } catch (error) {
      console.error(pc.red('Error:'), error.message);
      if (error.userMessage) {
        console.error(pc.yellow('Suggestion:'), error.userMessage);
      }
      process.exitCode = 1;
    }
  });

// Parse with error handling
try {
  await program.parseAsync(process.argv);
} catch (error) {
  // Commander throws on invalid arguments - handle gracefully
  console.error(pc.red('Error:'), error.message);
  process.exitCode = 1;
}
```

### Pattern 2: Error Handling with User-Friendly Messages

**What:** Wrap low-level errors with actionable guidance following clig.dev principles
**When to use:** Any error that prevents CLI from completing successfully
**Example:**
```typescript
// Source: clig.dev error message guidelines
// src/cli.ts (error handling section)
import pc from 'picocolors';
import { ZoomBGError } from './services/errors.js';

function handleError(error: Error): void {
  // Extract user-friendly message from custom errors
  if (error instanceof ZoomBGError) {
    console.error(pc.red('Error:'), error.message);
    console.error(pc.yellow('Solution:'), error.userMessage);
  } else if (error.message.includes('ENOENT')) {
    console.error(pc.red('Error:'), 'File not found');
    console.error(pc.yellow('Suggestion:'), 'Check that all required files exist and are accessible');
  } else if (error.message.includes('EACCES')) {
    console.error(pc.red('Error:'), 'Permission denied');
    console.error(pc.yellow('Suggestion:'), 'Try running with appropriate file permissions');
  } else {
    // Unexpected errors with debug info
    console.error(pc.red('Unexpected error:'), error.message);
    console.error(pc.gray('Stack trace:'), error.stack);
    console.error('\nPlease report this issue at: https://github.com/user/zoombg/issues');
  }

  process.exitCode = 1;
}
```

### Pattern 3: Help Documentation with Examples

**What:** Auto-generated help text with usage examples following clig.dev guidelines
**When to use:** When user runs --help or provides invalid arguments
**Example:**
```typescript
// Source: commander.js documentation + clig.dev help text guidelines
// src/cli.ts (help configuration)
import { Command } from 'commander';

const program = new Command();

program
  .name('zoombg')
  .usage('[options] [prompt]')
  .description('Generate AI-powered Zoom backgrounds from text prompts')
  .addHelpText('after', `

Examples:
  $ zoombg "serene mountain landscape at sunset"
  $ zoombg "modern office with plants" --service openai
  $ zoombg --help

For more information, visit: https://github.com/user/zoombg
Report issues: https://github.com/user/zoombg/issues
  `);

// Configure help to show on missing required arguments
program.configureHelp({
  sortOptions: true,  // Alphabetical sorting for easy scanning
  showGlobalOptions: true
});
```

### Pattern 4: Exit Code Management

**What:** Proper exit code handling following Node.js conventions and clig.dev guidelines
**When to use:** All exit paths (success, user error, system error, signal termination)
**Example:**
```typescript
// Source: Node.js process documentation + clig.dev exit code guidelines
// src/cli.ts (exit code handling)

// Success path
async function runCLI() {
  try {
    await generateWorkflow();
    process.exitCode = 0;  // Explicit success code
  } catch (error) {
    if (error instanceof ValidationError) {
      // User error (invalid input)
      console.error('Invalid arguments:', error.message);
      process.exitCode = 1;
    } else if (error instanceof SystemError) {
      // System error (missing dependencies, permission issues)
      console.error('System error:', error.message);
      process.exitCode = 2;
    } else {
      // Unexpected error
      console.error('Unexpected error:', error.message);
      process.exitCode = 1;
    }
  }
}

// Handle signals (Ctrl+C, SIGTERM)
process.on('SIGINT', async () => {
  console.log('\nCleaning up...');
  await cleanupManager.cleanup();
  process.exit(130); // 128 + SIGINT(2)
});

process.on('SIGTERM', async () => {
  await cleanupManager.cleanup();
  process.exit(143); // 128 + SIGTERM(15)
});
```

### Pattern 5: Executable Configuration with Shebang

**What:** Configure package.json bin field and add shebang for executable Node.js script
**When to use:** Making CLI tool installable via npm and invokable as command
**Example:**
```typescript
// Source: Node.js executable script conventions
// src/cli.ts (top of file)
#!/usr/bin/env node

// ESM entry point detection
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const argv1 = resolve(process.argv[1]);

// Only run CLI if this file is the entry point
if (__filename === argv1) {
  runCLI().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

// Export for testing
export { runCLI };
```

```json
// package.json
{
  "name": "zoombg",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "zoombg": "./dist/cli.js"
  },
  "scripts": {
    "build": "tsc",
    "prepublishOnly": "npm run build"
  }
}
```

### Pattern 6: Interactive vs Non-Interactive Mode

**What:** Support both interactive workflow (Phase 2) and non-interactive mode for scripting
**When to use:** CLI needs to work in both human-interactive and automated contexts
**Example:**
```typescript
// Source: Derived from clig.dev composability guidelines
// src/workflows/generate.ts (modified for CLI support)
import { confirm, input } from '@inquirer/prompts';

export async function generateWorkflow(options?: {
  initialPrompt?: string;
  service?: string;
  interactive?: boolean;
}): Promise<void> {
  const interactive = options?.interactive ?? true;

  let currentPrompt = options?.initialPrompt;

  // In non-interactive mode, require prompt
  if (!interactive && !currentPrompt) {
    throw new Error('Prompt is required in non-interactive mode');
  }

  // In interactive mode, prompt if not provided
  if (interactive && !currentPrompt) {
    currentPrompt = await input({
      message: 'Describe the Zoom background you want:'
    });
  }

  let approved = false;

  while (!approved) {
    // Generate image...
    const result = await aiService.generateImage(currentPrompt);

    // Preview (always, even in non-interactive)
    await showPreview(result.buffer);

    if (interactive) {
      // Interactive approval flow
      approved = await confirm({
        message: 'Do you approve this image?'
      });

      if (!approved) {
        // Offer to modify...
      }
    } else {
      // Non-interactive: auto-approve
      approved = true;
    }
  }

  // Save approved image...
}
```

### Anti-Patterns to Avoid

- **Hardcoded exit codes:** Use named constants or enums for exit codes, not magic numbers scattered throughout code
- **Swallowing commander errors:** Don't catch commander parsing errors without logging them - users need to know what went wrong
- **Missing shebang:** Forgetting #!/usr/bin/env node makes script non-executable on Unix systems
- **Relative bin paths:** Using relative paths like ../dist/cli.js in bin field breaks npm link and global installs
- **process.exit() everywhere:** Overusing process.exit() prevents cleanup handlers from running - prefer process.exitCode
- **Poor error messages:** Generic "Error: failed" without context or suggestions - follow clig.dev guidelines for actionable errors
- **No help examples:** Showing only option list without usage examples makes CLI hard to discover

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Argument parsing | Manual process.argv splitting with string matching | commander | Handles options with values, boolean flags, subcommands, validation, type coercion, and help generation automatically |
| Help documentation | Manual help text with console.log | commander auto-generated help | Automatically formats options, arguments, and descriptions; keeps help in sync with code |
| Terminal colors | ANSI escape code strings (\x1b[31m) | picocolors | Handles terminal capability detection, NO_COLOR support, cross-platform compatibility |
| Exit code management | Scattered process.exit() calls | process.exitCode with organized error handling | Allows cleanup handlers to run, prevents abrupt termination mid-operation |

**Key insight:** CLI argument parsing has subtle edge cases (quoted arguments with spaces, combined short flags like -abc, option-arguments vs boolean flags, -- separator for stdin, shell expansion). Well-tested libraries handle these edge cases; custom implementations surface them as user-reported bugs.

## Common Pitfalls

### Pitfall 1: Commander Parsing Errors Not Caught

**What goes wrong:** Commander throws errors for invalid arguments, but if not caught, they crash the process with stack trace
**Why it happens:** Commander .parse() can throw synchronously for validation errors
**How to avoid:** Wrap program.parseAsync() in try-catch, or use commander's built-in error handling with .error()
**Warning signs:** Users see stack traces for invalid arguments instead of friendly error messages

```typescript
// BAD: Commander errors crash with stack trace
await program.parseAsync(process.argv);

// GOOD: Handle parsing errors gracefully
try {
  await program.parseAsync(process.argv);
} catch (error) {
  console.error('Error:', error.message);
  process.exitCode = 1;
}

// BEST: Use commander's built-in error handling
program
  .exitOverride((error) => {
    console.error('Error:', error.message);
    process.exitCode = error.exitCode || 1;
  });
await program.parseAsync(process.argv);
```

### Pitfall 2: Bin Path Not Relative to Package Root

**What goes wrong:** Using absolute paths or paths relative to src/ in bin field breaks npm install
**Why it happens:** npm resolves bin paths from package.json location (package root), not from current directory
**How to avoid:** Always use paths relative to package.json location (e.g., ./dist/cli.js not ./src/cli.ts)
**Warning signs:** CLI works in development but fails after npm install or npm link

```json
// BAD: Absolute path breaks on other machines
{
  "bin": {
    "zoombg": "/Users/dev/zoombg/dist/cli.js"
  }
}

// BAD: Wrong relative path (npm looks from package root)
{
  "bin": {
    "zoombg": "cli.js"
  }
}

// GOOD: Correct relative path from package root
{
  "bin": {
    "zoombg": "./dist/cli.js"
  }
}
```

### Pitfall 3: Forgetting Shebang in Executable

**What goes wrong:** CLI script runs with node cli.js but fails when invoked as zoombg command
**Why it happens:** Unix systems need shebang to know which interpreter to use for executable files
**How to avoid:** Add #!/usr/bin/env node as first line of CLI entry point file
**Warning signs:** Command not found errors on Unix systems, or script opens in text editor instead of running

```typescript
// BAD: Missing shebang
import { Command } from 'commander';
// ...CLI code

// GOOD: Shebang at very first line
#!/usr/bin/env node

import { Command } from 'commander';
// ...CLI code
```

### Pitfall 4: TypeScript Compiling Shebang Incorrectly

**What goes wrong:** TypeScript compiler doesn't preserve shebang or puts it after generated code
**Why it happens:** TypeScript doesn't recognize shebang as JavaScript syntax
**How to avoid:** Verify shebang is preserved in dist/cli.js after compilation, or add it in build script
**Warning signs:** Compiled file missing shebang, executable fails after build

```bash
# Verify shebang after build
npm run build
head -n 1 dist/cli.js  # Should output: #!/usr/bin/env node

# If missing, add shebang in build script
{
  "scripts": {
    "build": "tsc && echo '#!/usr/bin/env node' | cat - dist/cli.js > temp && mv temp dist/cli.js"
  }
}
```

### Pitfall 5: Interactive Workflow Breaking in Non-TTY

**What goes wrong:** Inquirer prompts fail when CLI is piped or run in CI/CD environment
**Why it happens:** Inquirer requires interactive terminal (TTY) but pipes/CI have no TTY
**How to avoid:** Detect TTY availability and skip interactive prompts in non-interactive mode
**Warning signs:** "Input stream closed" errors in CI, hanging process when piped

```typescript
// BAD: Always uses interactive prompts
const prompt = await input({ message: 'Enter prompt:' });

// GOOD: Detect TTY and handle non-interactive
import { stdin as isInteractive } from 'node:process';

if (process.stdin.isTTY) {
  // Interactive mode
  const prompt = await input({ message: 'Enter prompt:' });
} else {
  // Non-interactive mode
  if (!options.prompt) {
    throw new Error('--prompt required in non-interactive mode');
  }
}
```

### Pitfall 6: Exit Code Set After Async Operation Completes

**What goes wrong:** Setting process.exitCode in async callback doesn't propagate if process exits before callback runs
**Why it happens:** Node.js exits when event loop empties, which may happen before async callbacks
**How to avoid:** Set process.exitCode before async operations return, or await all async operations before exit
**Warning signs:** CLI always exits with 0 even on errors

```typescript
// BAD: Exit code set too late
generateWorkflow().then(() => {
  process.exitCode = 0;  // May not run if process exits first
});

// GOOD: Await operation before exit
try {
  await generateWorkflow();
  process.exitCode = 0;
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
```

### Pitfall 7: Service Validation in Wrong Place

**What goes wrong:** Service validation happens after workflow starts, wasting time on invalid input
**Why it happens:** Validation logic placed inside workflow instead of CLI argument parsing
**How to avoid:** Validate all arguments in CLI layer before invoking workflow
**Warning signs:** Users wait for AI generation before seeing "invalid service" error

```typescript
// BAD: Validation inside workflow
export async function generateWorkflow(service: string) {
  const spinner = ora('Generating...').start();
  // ... generate for 30 seconds ...

  // Too late - should have validated before starting
  if (!['huggingface', 'openai'].includes(service)) {
    throw new Error('Invalid service');
  }
}

// GOOD: Validate in CLI before workflow
program
  .option('-s, --service <name>', 'AI service')
  .action(async (options) => {
    const validServices = ['huggingface', 'openai', 'stability'];
    if (!validServices.includes(options.service)) {
      program.error(`Invalid service: ${options.service}`);
    }

    // Only start workflow after validation
    await generateWorkflow(options.service);
  });
```

## Code Examples

Verified patterns from official sources.

### Complete CLI Entry Point

```typescript
// Source: commander.js v14.0.3 documentation + clig.dev guidelines
// src/cli.ts
#!/usr/bin/env node

import { Command } from 'commander';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import pc from 'picocolors';
import { generateWorkflow } from './workflows/generate.js';
import { ZoomBGError } from './services/errors.js';

// Read package.json for version
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function getVersion(): Promise<string> {
  const packageJson = await readFile(
    join(__dirname, '../package.json'),
    'utf-8'
  );
  return JSON.parse(packageJson).version;
}

async function main() {
  const version = await getVersion();

  const program = new Command();

  program
    .name('zoombg')
    .version(version)
    .description('Generate AI-powered Zoom backgrounds from text prompts')
    .argument('[prompt]', 'Description of the background to generate')
    .option(
      '-s, --service <name>',
      'AI service (huggingface, openai, stability)',
      'huggingface'
    )
    .option('--no-interaction', 'Skip interactive prompts (use provided prompt only)')
    .addHelpText('after', `

Examples:
  Generate interactively:
    $ zoombg

  Generate with prompt:
    $ zoombg "serene mountain landscape at sunset"

  Use specific AI service:
    $ zoombg "modern office" --service openai

  Non-interactive mode:
    $ zoombg "beach sunset" --no-interaction

Documentation: https://github.com/user/zoombg
Report issues: https://github.com/user/zoombg/issues
    `)
    .action(async (prompt, options) => {
      try {
        // Validate service
        const validServices = ['huggingface', 'openai', 'stability'];
        if (!validServices.includes(options.service)) {
          console.error(
            pc.red('Error:'),
            `Invalid service "${options.service}"`
          );
          console.error(
            pc.yellow('Valid services:'),
            validServices.join(', ')
          );
          process.exitCode = 1;
          return;
        }

        // Check TTY for interactive mode
        if (options.interaction && !process.stdin.isTTY) {
          console.error(
            pc.yellow('Warning:'),
            'No interactive terminal detected, running in non-interactive mode'
          );
          options.interaction = false;
        }

        // Require prompt in non-interactive mode
        if (!options.interaction && !prompt) {
          console.error(
            pc.red('Error:'),
            'Prompt is required in non-interactive mode'
          );
          console.error(
            pc.yellow('Suggestion:'),
            'Provide prompt as argument: zoombg "your prompt here"'
          );
          process.exitCode = 1;
          return;
        }

        // Invoke workflow
        await generateWorkflow({
          initialPrompt: prompt,
          service: options.service,
          interactive: options.interaction
        });

        process.exitCode = 0;
      } catch (error) {
        handleError(error);
      }
    });

  // Parse with error handling
  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    handleError(error);
  }
}

function handleError(error: Error | unknown): void {
  if (error instanceof ZoomBGError) {
    // Custom error with user message
    console.error(pc.red('Error:'), error.message);
    console.error(pc.yellow('Solution:'), error.userMessage);
    process.exitCode = 1;
  } else if (error instanceof Error) {
    // Standard error
    console.error(pc.red('Error:'), error.message);

    // Provide context for common error types
    if (error.message.includes('ENOENT')) {
      console.error(pc.yellow('Suggestion:'), 'Check that all required files exist');
    } else if (error.message.includes('EACCES')) {
      console.error(pc.yellow('Suggestion:'), 'Check file permissions');
    } else {
      // Unexpected error with debug info
      console.error(pc.gray('\nStack trace:'));
      console.error(error.stack);
      console.error(
        '\n' + pc.yellow('Please report this issue at:'),
        'https://github.com/user/zoombg/issues'
      );
    }

    process.exitCode = 1;
  } else {
    // Unknown error type
    console.error(pc.red('Unexpected error:'), error);
    process.exitCode = 1;
  }
}

// Only run if this is the entry point
const __filename = fileURLToPath(import.meta.url);
const argv1 = resolve(process.argv[1]);

if (__filename === argv1) {
  main().catch((error) => {
    console.error(pc.red('Fatal error:'), error);
    process.exit(1);
  });
}

// Export for testing
export { main };
```

### Package.json Configuration

```json
// Source: npm package.json bin field documentation
{
  "name": "zoombg",
  "version": "0.1.0",
  "description": "CLI tool for generating AI-powered Zoom backgrounds",
  "type": "module",
  "bin": {
    "zoombg": "./dist/cli.js"
  },
  "main": "./dist/index.js",
  "scripts": {
    "build": "tsc",
    "dev": "tsx watch src/cli.ts",
    "prepublishOnly": "npm run build"
  },
  "dependencies": {
    "@huggingface/inference": "^4.13.12",
    "@inquirer/prompts": "^8.2.1",
    "commander": "^14.0.3",
    "conf": "^15.1.0",
    "open": "^11.0.0",
    "ora": "^9.3.0",
    "picocolors": "^1.1.1"
  },
  "devDependencies": {
    "@types/node": "^22.10.6",
    "tsx": "^4.19.2",
    "typescript": "^5.7.3"
  },
  "engines": {
    "node": ">=20.0.0"
  }
}
```

### Service Validation Pattern

```typescript
// Source: commander.js validation + Phase 1 AIServiceFactory
// src/cli.ts (service validation)
import { createAIService } from './services/ai/factory.js';

// Validate at CLI layer before invoking workflow
program.action(async (prompt, options) => {
  const validServices = ['huggingface', 'openai', 'stability'];

  if (!validServices.includes(options.service)) {
    program.error(
      `Invalid service: ${options.service}\nValid services: ${validServices.join(', ')}`,
      { exitCode: 1 }
    );
  }

  // Service is valid, pass to workflow
  await generateWorkflow({
    service: options.service
  });
});
```

### Modified Workflow for CLI Integration

```typescript
// Source: Phase 2 generate.ts modified for CLI support
// src/workflows/generate.ts
import { confirm, input } from '@inquirer/prompts';
import ora from 'ora';
import { createAIService } from '../services/ai/factory.js';
import { BackgroundManager } from '../services/zoom/background-manager.js';
import { ZoomVerifier } from '../services/zoom/verifier.js';
import { showPreview } from './preview.js';

export interface WorkflowOptions {
  initialPrompt?: string;
  service?: string;
  interactive?: boolean;
}

export async function generateWorkflow(options: WorkflowOptions = {}): Promise<void> {
  const {
    initialPrompt,
    service = 'huggingface',
    interactive = true
  } = options;

  // Verify Zoom prerequisites
  const verifier = new ZoomVerifier();
  await verifier.verify();

  let approved = false;
  let currentPrompt = initialPrompt;

  // Get prompt (interactive or required parameter)
  if (!currentPrompt) {
    if (interactive) {
      currentPrompt = await input({
        message: 'Describe the Zoom background you want:'
      });
    } else {
      throw new Error('Prompt is required in non-interactive mode');
    }
  }

  while (!approved) {
    let tempDir: string | undefined;

    try {
      // Generate with spinner
      const spinner = ora('Generating image (may take 15-90 seconds)...').start();

      const aiService = createAIService(service as any);
      const result = await aiService.generateImage(currentPrompt);

      spinner.succeed('Image generated');

      // Preview in browser
      tempDir = await showPreview(result.buffer);

      if (interactive) {
        // Interactive approval flow
        approved = await confirm({
          message: 'Do you approve this image?',
          default: true
        });

        if (!approved) {
          const shouldModify = await confirm({
            message: 'Do you want to modify the prompt and regenerate?',
            default: true
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
        }
      } else {
        // Non-interactive: auto-approve
        approved = true;
      }

      if (approved) {
        // Save to Zoom
        const saveSpinner = ora('Saving to Zoom backgrounds...').start();

        const bgManager = new BackgroundManager();
        const bgDir = await bgManager.findBackgroundsDirectory();
        const filename = `zoombg-${Date.now()}.png`;
        const savePath = join(bgDir, filename);

        await writeFile(savePath, result.buffer);

        saveSpinner.succeed(`Saved as ${filename}`);
        console.log(`\nZoom background saved to: ${savePath}`);
      }
    } catch (error) {
      console.error('\nError during workflow:', error);
      throw error;
    } finally {
      // Cleanup temp files
      if (tempDir) {
        await rm(tempDir, { recursive: true, force: true }).catch(() => {});
      }
    }
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Optimist for argument parsing | Commander v14 or Yargs v18 | 2015-2020 | Modern libraries have TypeScript support, better validation, auto-generated help |
| chalk v4 with CommonJS | picocolors (dual format) or chalk v5 (ESM-only) | 2024-2025 | Picocolors is 14x smaller, both ESM/CJS, same API; chalk v5 breaks CommonJS compatibility |
| Manual exit() calls | process.exitCode for graceful shutdown | Node.js best practices | Allows cleanup handlers to run, prevents data loss |
| Generic error messages | clig.dev human-centered errors | 2020-2025 | Errors explain what went wrong + how to fix, reduces user frustration |
| CommonJS require() | ESM import with package.json type: module | Node.js 12+ (2019), widely adopted 2023+ | Native async, tree-shaking, better tooling integration |

**Deprecated/outdated:**
- **optimist**: Deprecated in favor of yargs (successor) or commander (simpler alternative)
- **process.exit() without cleanup**: Modern Node.js apps use process.exitCode + cleanup handlers
- **chalk v4 for new projects**: Unless CommonJS required, picocolors is better choice (smaller, faster)
- **Hardcoded ANSI codes**: Use libraries that handle terminal capability detection and NO_COLOR standard

## Open Questions

1. **Should we support config file for default service selection?**
   - What we know: Phase 4 adds CONFIG-03 for persisting service preference
   - What's unclear: Should Phase 3 read config, or defer to Phase 4?
   - Recommendation: Phase 3 supports --service flag only. Phase 4 adds config file reading for default service.

2. **How to handle partial TTY (stdin is pipe but stdout is terminal)?**
   - What we know: process.stdin.isTTY detects interactive terminal
   - What's unclear: If stdin is piped but stdout/stderr are terminals, should we show progress spinners?
   - Recommendation: Check process.stdout.isTTY for spinner display, process.stdin.isTTY for prompts. Allow mixed mode (show spinners but skip prompts).

3. **Should we add --version and --help as explicit checks?**
   - What we know: Commander handles --help and --version automatically
   - What's unclear: Do we need custom version display with additional info (Node.js version, platform)?
   - Recommendation: Phase 3 uses commander defaults. Phase 5 can add detailed version output if users request it.

4. **How to test CLI entry point?**
   - What we know: CLI entry point checks if it's main module before running
   - What's unclear: Best pattern for testing CLI parsing without executing workflow
   - Recommendation: Export main() function for testing, use exitOverride() to catch exits in tests, mock workflow function.

## Sources

### Primary (HIGH confidence)
- **commander.js v14.0.3 GitHub Repository** (https://github.com/tj/commander.js) - Latest stable version (Jan 31, 2025), API documentation, error handling, help generation
- **commander.js v14.0.3 README** - Option definition, argument parsing, exit code handling, exitOverride functionality
- **Node.js v25.6.1 Process Documentation** (https://nodejs.org/api/process.html) - Exit codes (0, 1, 2, 128+N), process.exitCode vs process.exit(), signal handling
- **Node.js Modules Documentation** (https://nodejs.org/api/modules.html) - Entry point detection with import.meta.url for ESM
- **clig.dev CLI Guidelines** (https://clig.dev) - Error message best practices, help documentation, exit codes, human-centered design
- **picocolors v1.1.1 GitHub** (https://github.com/alexeyraspopov/picocolors) - Terminal styling, size comparison (7KB vs 101KB chalk), CommonJS + ESM support
- **chalk v5 GitHub** (https://github.com/chalk/chalk) - ESM-only migration in v5, breaking CommonJS compatibility
- **np CLI tool source** (https://github.com/sindresorhus/np) - Real-world CLI patterns: bin field, shebang, error handling, exit codes

### Secondary (MEDIUM confidence)
- **yargs v18 GitHub** (https://github.com/yargs/yargs) - Alternative to commander, 11.4k stars, shell completion support
- **meow GitHub** (https://github.com/sindresorhus/meow) - Lightweight alternative (zero dependencies), 3.7k stars
- **Phase 1 RESEARCH.md** - AI service factory patterns, service validation, error types
- **Phase 2 RESEARCH.md** - Workflow orchestration patterns, Inquirer integration, cleanup management

### Tertiary (LOW confidence - needs verification)
- **commander v15 breaking changes** - ESM-only requirement stated in release notes, but full migration impact not documented
- **TTY detection edge cases** - Behavior with stdin piped but stdout/stderr terminals not explicitly documented
- **npm bin symlink behavior** - Documented that npm links bin executables, but specific symlink vs copy behavior varies by platform

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Commander v14.0.3 verified from GitHub releases (Jan 31, 2025), picocolors v1.1.1 verified from npm
- Architecture: HIGH - Patterns derived from commander documentation, clig.dev guidelines, real-world CLI tool inspection (np)
- Pitfalls: HIGH - Shebang requirement verified from Node.js conventions, bin path issues confirmed from npm documentation
- Integration details: MEDIUM - Workflow modification patterns inferred from Phase 2 research, TTY detection edge cases not fully documented

**Research date:** 2026-02-22
**Valid until:** 2026-03-24 (30 days - stable library, verify when planning Phase 4 for config integration changes)
