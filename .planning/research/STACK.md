# Stack Research

**Domain:** macOS CLI tool for AI-powered Zoom backgrounds
**Researched:** 2026-02-21
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Node.js | 18+ LTS | Runtime environment | Native async support for API calls, excellent ecosystem for CLI tools, cross-platform path handling with `node:path`, built-in `fs` module for file operations |
| TypeScript | ^5.0 | Type safety and developer experience | Catch API integration errors at compile time, better IDE support for complex API types (OpenAI, Hugging Face SDKs), recommended by all major AI SDK maintainers |
| commander | ^14.0.3 | CLI framework | Industry standard (28k+ stars), simple declarative API, built-in help generation, option parsing, and command organization |

### AI Service Integration

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @huggingface/inference | ^4.13.12 | Hugging Face API client | Default free service - text-to-image via `textToImage()`, supports multiple providers (Replicate, Fal.ai), no API key required for basic models |
| openai | ^6.22.0 | OpenAI DALL-E 3 integration | Premium option - use `client.images.generate()` with `model: "dall-e-3"`, supports quality/style parameters, excellent TypeScript types |
| axios | ^1.13.5 | HTTP client for Stability AI | REST API calls to Stability AI (no official Node.js SDK) - use for direct API integration with custom error handling |

### CLI User Experience

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @inquirer/prompts | ^8.2.1 | Interactive prompts | User approval flow ("approve this image?"), modification prompts, service selection - modern rewrite with tree-shaking support |
| chalk | ^5.6.2 | Terminal styling | Status messages, error formatting, success/warning indicators - 16M colors, chainable API (note: ESM-only) |
| ora | ^9.3.0 | Progress spinners | Image generation waiting states, API call feedback - elegant spinners with start/stop/succeed/fail states |

### File System & Configuration

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| conf | ^15.1.0 | Configuration management | Store API keys, remember last used service, user preferences - atomic writes, JSON schema validation, platform-aware paths |
| open | ^11.0.0 | Browser control | Display generated image in default browser - cross-platform (uses macOS `open` command), works with local HTML files |
| dotenv | ^17.3.1 | Development environment variables | Development workflow only - load `.env` for API keys during testing (production uses `conf` for storage) |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| ts-node | TypeScript execution | Development workflow - run TS files directly without compilation step |
| @types/node | Node.js type definitions | Essential for TypeScript - provides types for `fs`, `path`, `process` modules |
| eslint + typescript-eslint | Code quality | Catch common async/await mistakes, enforce consistent error handling |
| prettier | Code formatting | Consistent style across team, integrate with ESLint |

## Installation

```bash
# Core dependencies
npm install commander@^14.0.3 @inquirer/prompts@^8.2.1 conf@^15.1.0 open@^11.0.0

# AI service clients
npm install @huggingface/inference@^4.13.12 openai@^6.22.0 axios@^1.13.5

# CLI experience
npm install chalk@^5.6.2 ora@^9.3.0

# Development environment
npm install dotenv@^17.3.1

# Dev dependencies
npm install -D typescript@^5.0 ts-node @types/node eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin prettier
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Node.js + TypeScript | Python | If you need tighter integration with ML pipelines or prefer Python's ecosystem - has better native support for some AI tools but slower CLI startup time |
| commander | yargs | If you need complex nested commands or advanced validation - yargs has more features but steeper learning curve |
| @inquirer/prompts | prompts | If bundle size is critical concern - prompts is smaller but less feature-rich |
| conf | configstore | Never - configstore is deprecated and archived by maintainer |
| Axios (for Stability AI) | node-fetch | If you want native Fetch API in Node.js - but axios has better error handling and interceptors for API key management |
| @huggingface/inference | Direct REST calls | If you need maximum control or custom error handling - but SDK provides better TypeScript types and error messages |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| inquirer (legacy) | Monolithic package with large bundle size, outdated architecture | @inquirer/prompts (modern rewrite with tree-shaking) |
| request | Deprecated since 2020, no longer maintained | axios or native fetch |
| chalk v4 or earlier in ESM projects | CommonJS compatibility issues, missing ESM features | chalk v5+ (ESM-only but modern) |
| stability-sdk (Python) | Python-only, requires spawning subprocess from Node.js | Direct REST API calls with axios |
| Global TypeScript installation | Version conflicts across projects | Project-local typescript in devDependencies |

## Stack Patterns by Variant

**If targeting only macOS (this project):**
- Use native `open` command via `open` package for browser launching
- Hardcode Zoom background path: `~/Library/Application Support/zoom.us/data/VirtualBkgnd_Custom/`
- Use `process.platform === 'darwin'` checks for safety

**If planning cross-platform expansion later:**
- Abstract file paths into platform-specific modules early
- Windows Zoom path: `%APPDATA%\Zoom\data\VirtualBkgnd_Custom\`
- Linux Zoom path: `~/.zoom/data/VirtualBkgnd_Custom/`
- Keep macOS-only for v1.0 as specified in PROJECT.md

**For API key management:**
- Development: Use `dotenv` with `.env.example` template
- Production/distribution: Use `conf` for cross-platform storage in user config directory
- Never commit API keys to git
- Provide clear setup instructions for first-time users

**For error handling:**
- Axios interceptors for API rate limits and auth errors
- Separate error types for network vs API vs file system failures
- User-friendly error messages (not stack traces) in CLI output
- Log detailed errors to optional debug file when `--debug` flag is provided

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| chalk@5.6.2 | Node.js 18+ | ESM-only, requires `"type": "module"` in package.json |
| ora@9.3.0 | Node.js 18+ | Also ESM-only, pairs well with chalk v5 |
| @inquirer/prompts@8.2.1 | Node.js 18.19+ | Modern rewrite, uses ESM |
| commander@14.0.3 | Node.js 18+ | Supports both ESM and CommonJS |
| openai@6.22.0 | Node.js 18+ | TypeScript-first SDK, generated from OpenAPI spec |
| @huggingface/inference@4.13.12 | Any Node.js version | Works with ESM and CommonJS |

**Critical note:** This stack requires ESM (`"type": "module"` in package.json) due to chalk and ora. All other packages are ESM-compatible. TypeScript config should use `"module": "ESNext"` and `"moduleResolution": "bundler"` or `"node16"`.

## Integration Points

### AI Service Architecture

```typescript
// Abstract interface for all AI services
interface AIImageGenerator {
  generate(prompt: string): Promise<Buffer>;
  name: string;
  requiresApiKey: boolean;
}

// Implementations
class HuggingFaceGenerator implements AIImageGenerator {
  constructor(private client: HfInference) {}
  // Uses @huggingface/inference textToImage()
}

class DallEGenerator implements AIImageGenerator {
  constructor(private client: OpenAI) {}
  // Uses openai client.images.generate()
}

class StabilityAIGenerator implements AIImageGenerator {
  constructor(private apiKey: string) {}
  // Uses axios for REST calls to platform.stability.ai
}
```

### Zoom Background Integration

```typescript
// macOS-specific implementation
import { homedir } from 'node:os';
import { join } from 'node:path';
import { writeFile, access } from 'node:fs/promises';

const ZOOM_BG_PATH = join(
  homedir(),
  'Library/Application Support/zoom.us/data/VirtualBkgnd_Custom'
);

async function verifyZoomInstalled(): Promise<boolean> {
  try {
    await access(ZOOM_BG_PATH);
    return true;
  } catch {
    return false;
  }
}

async function saveBackground(imageBuffer: Buffer): Promise<string> {
  const filename = `ai-generated-${Date.now()}.png`;
  const fullPath = join(ZOOM_BG_PATH, filename);
  await writeFile(fullPath, imageBuffer);
  return fullPath;
}
```

### Browser Preview Pattern

```typescript
import open from 'open';
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

async function showPreview(imageBuffer: Buffer): Promise<void> {
  const base64Image = imageBuffer.toString('base64');
  const html = `
    <!DOCTYPE html>
    <html>
      <head><title>Zoom Background Preview</title></head>
      <body style="margin:0;display:flex;justify-content:center;align-items:center;height:100vh;background:#000;">
        <img src="data:image/png;base64,${base64Image}" style="max-width:90vw;max-height:90vh;" />
      </body>
    </html>
  `;

  const tmpPath = join(tmpdir(), `zoom-bg-preview-${Date.now()}.html`);
  await writeFile(tmpPath, html);
  await open(tmpPath);
}
```

## Sources

- **NPM Registry** — Current versions verified for all packages (2026-02-21)
- **Hugging Face JS Documentation** (https://huggingface.co/docs/huggingface.js/inference/README) — MEDIUM confidence: Official docs, confirmed text-to-image support
- **OpenAI Node.js SDK GitHub** (https://github.com/openai/openai-node) — HIGH confidence: Official SDK, v6.22.0 confirmed, DALL-E 3 support verified in api.md
- **OpenAI Cookbook** (https://developers.openai.com/cookbook/examples/dalle/) — HIGH confidence: Official cookbook, confirmed DALL-E 3 capabilities and quality/style parameters
- **Commander.js GitHub** (https://github.com/tj/commander.js) — HIGH confidence: 28k+ stars, active maintenance confirmed
- **Inquirer.js GitHub** (https://github.com/SBoudrias/Inquirer.js) — HIGH confidence: Recent rewrite to @inquirer/prompts, modern ESM architecture
- **conf GitHub** (https://github.com/sindresorhus/conf) — HIGH confidence: Standard for Node.js CLI config storage, atomic writes, platform-aware
- **open GitHub** (https://github.com/sindresorhus/open) — HIGH confidence: Cross-platform file/URL opening, macOS support confirmed
- **Stability AI Platform** (https://platform.stability.ai) — LOW confidence: Documentation blocked by Cloudflare, REST API approach based on community knowledge - recommend verifying their current API docs directly
- **Axios GitHub** (https://github.com/axios/axios) — HIGH confidence: 109k+ stars, active maintenance, standard HTTP client

---
*Stack research for: AI-powered Zoom background CLI tool (macOS)*
*Researched: 2026-02-21*
*Confidence: HIGH for Node.js/OpenAI/Hugging Face stack, MEDIUM for Stability AI integration (docs inaccessible)*
