# Phase 4: Multi-Service Support - Research

**Researched:** 2026-02-22
**Domain:** Multi-provider AI image generation APIs (OpenAI DALL-E 3, Stability AI), service configuration persistence, Strategy pattern extension
**Confidence:** MEDIUM-HIGH

## Summary

Phase 4 validates the service abstraction established in Phase 1 by adding two paid AI providers: OpenAI DALL-E 3 and Stability AI. The existing Strategy pattern (AIServiceAdapter interface with HuggingFaceService implementation) was designed for this extension, requiring only new adapter implementations and factory registration with zero changes to the orchestration layer. The technical challenge is implementing two distinct APIs with different authentication patterns, response formats, and error handling while maintaining the unified interface contract.

OpenAI provides an official TypeScript SDK (v6.22.0) with native async/await, typed responses, and comprehensive error handling. DALL-E 3 returns image URLs or base64-encoded data via images.generate() method. Stability AI has a community-maintained SDK (stability-ai v0.7.0) built on axios with similar patterns but different model naming and response structures. Both require API keys stored securely in the existing ConfigService with 0600 permissions.

The critical architectural decision is persisting service preference across sessions using the existing ConfigService.lastUsedService field. When user specifies --service flag, save that choice. On next invocation without --service, default to lastUsedService instead of hardcoded 'huggingface'. This enables "sticky" service selection: once user chooses OpenAI, future invocations continue using OpenAI until explicitly changed.

**Primary recommendation:** Implement OpenAIService and StabilityService adapters following HuggingFaceService pattern, register in factory.ts switch statement, persist service selection via ConfigService.setLastUsedService() after successful generation, and handle service-specific errors with user-actionable messages including API key setup instructions.

<phase_requirements>
## Phase Requirements

This phase MUST address the following requirements:

| ID | Description | Research Support |
|----|-------------|-----------------|
| AI-02 | Tool generates images using DALL-E 3 with OpenAI API key | Official openai SDK v6.22.0 provides client.images.generate() with model='dall-e-3', returns ImagesResponse with URL or base64 data |
| AI-03 | Tool generates images using Stability AI with Stability API key | stability-ai SDK v0.7.0 provides textToImage() method with engine parameter, returns filepath or buffer via axios |
| AI-04 | Tool remembers last used AI service across sessions | ConfigService already has lastUsedService field with getter/setter, persist after successful generation, default to stored value when --service not provided |
| CONFIG-03 | Tool persists service preference to configuration file | ConfigService.setLastUsedService() writes to conf store with atomic file operations and 0600 permissions enforcement |
</phase_requirements>

## Standard Stack

### Core Libraries

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| openai | 6.22.0 | Official OpenAI API client for DALL-E 3 | Official SDK maintained by OpenAI, full TypeScript support, automatic retries, comprehensive error types, 25M+ weekly downloads |
| stability-ai | 0.7.0 | Community Stability AI REST API client | Most maintained community SDK (updated Nov 2024), TypeScript support, axios-based with familiar patterns, supports v1 and v2beta APIs |
| axios | ^1.6.8 | HTTP client (stability-ai dependency) | Used by stability-ai SDK, handles streaming responses and binary data, industry standard |

### Supporting (Already in Stack)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| conf | 15.1.0 | Configuration storage with atomic writes | Already used for API key storage, lastUsedService persistence, schema validation |
| picocolors | 1.1.1 | Terminal styling for service-specific error messages | Already used in CLI, consistent error formatting across services |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| openai SDK | Direct fetch to OpenAI REST API | SDK provides TypeScript types, automatic retries, error classification, auth handling; raw fetch requires manual implementation |
| stability-ai v0.7.0 | stability-client v1.9.0 (older) | v0.7.0 more recent (Nov 2024), supports v2beta API, better TypeScript types, active maintenance |
| stability-ai | Direct REST calls to Stability API | SDK abstracts authentication headers, response parsing, binary handling; direct calls require manual error translation |

**Installation:**
```bash
npm install openai@6.22.0 stability-ai@0.7.0
```

## Architecture Patterns

### Pattern 1: Service Adapter Extension (Strategy Pattern)

**What:** Add new AI service implementations without modifying orchestration layer
**When to use:** When adding providers to existing abstraction with shared interface
**Example:**
```typescript
// Source: Derived from openai SDK v6.22.0 documentation and existing HuggingFaceService pattern
// src/services/ai/openai.ts
import OpenAI from 'openai';
import type { AIServiceAdapter, GenerationResult } from './types.js';
import { AIServiceError } from '../errors.js';

export class OpenAIService implements AIServiceAdapter {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  getServiceName(): string {
    return 'OpenAI';
  }

  requiresApiKey(): boolean {
    return true; // DALL-E requires API key
  }

  getTimeout(): number {
    return 60000; // 60 seconds for DALL-E 3
  }

  async generateImage(prompt: string): Promise<GenerationResult> {
    try {
      const response = await this.client.images.generate({
        model: 'dall-e-3',
        prompt: prompt,
        n: 1,
        size: '1024x1024',
        response_format: 'b64_json' // Get base64 instead of URL
      });

      const imageData = response.data[0];
      if (!imageData.b64_json) {
        throw new Error('No image data in response');
      }

      const buffer = Buffer.from(imageData.b64_json, 'base64');

      return {
        buffer,
        contentType: 'image/png',
        service: 'OpenAI'
      };
    } catch (error: any) {
      // Translate OpenAI API errors to user-friendly messages
      if (error?.status === 401) {
        throw new AIServiceError(
          'OpenAI',
          error,
          'Invalid OpenAI API key. Get your API key from https://platform.openai.com/api-keys'
        );
      }

      if (error?.status === 429) {
        throw new AIServiceError(
          'OpenAI',
          error,
          'Rate limit exceeded. Wait a few moments or check your OpenAI billing at https://platform.openai.com/account/billing'
        );
      }

      if (error?.status === 400 && error?.message?.includes('content_policy')) {
        throw new AIServiceError(
          'OpenAI',
          error,
          'Your prompt violates OpenAI content policy. Try rephrasing to avoid explicit or harmful content.'
        );
      }

      throw new AIServiceError('OpenAI', error);
    }
  }
}
```

### Pattern 2: Stability AI Service Adapter

**What:** Implement Stability AI using community SDK with buffer extraction
**When to use:** When SDK returns file paths but need in-memory buffers
**Example:**
```typescript
// Source: Derived from stability-ai SDK v0.7.0 GitHub examples
// src/services/ai/stability.ts
import StabilityAI from 'stability-ai';
import { readFile } from 'node:fs/promises';
import type { AIServiceAdapter, GenerationResult } from './types.js';
import { AIServiceError } from '../errors.js';

export class StabilityService implements AIServiceAdapter {
  private client: StabilityAI;

  constructor(apiKey: string) {
    this.client = new StabilityAI(apiKey);
  }

  getServiceName(): string {
    return 'Stability';
  }

  requiresApiKey(): boolean {
    return true; // Stability AI requires API key
  }

  getTimeout(): number {
    return 90000; // 90 seconds for Stability AI
  }

  async generateImage(prompt: string): Promise<GenerationResult> {
    try {
      // Use Stable Diffusion XL model
      const results = await this.client.v1.generation.textToImage(
        'stable-diffusion-xl-1024-v1-0',
        [{ text: prompt, weight: 1.0 }]
      );

      if (!results || results.length === 0) {
        throw new Error('No images generated');
      }

      const result = results[0];

      // SDK saves to file, read buffer from filepath
      const buffer = await readFile(result.filepath);

      return {
        buffer,
        contentType: 'image/png',
        service: 'Stability'
      };
    } catch (error: any) {
      // Translate Stability API errors to user-friendly messages
      if (error?.response?.status === 401) {
        throw new AIServiceError(
          'Stability',
          error,
          'Invalid Stability AI API key. Get your API key from https://platform.stability.ai/account/keys'
        );
      }

      if (error?.response?.status === 429) {
        throw new AIServiceError(
          'Stability',
          error,
          'Rate limit exceeded. Wait a few moments or upgrade your Stability AI plan.'
        );
      }

      if (error?.response?.status === 400) {
        throw new AIServiceError(
          'Stability',
          error,
          'Your prompt may violate content policy or contain invalid parameters. Try simplifying your prompt.'
        );
      }

      throw new AIServiceError('Stability', error);
    }
  }
}
```

### Pattern 3: Service Preference Persistence

**What:** Remember last used service and default to it on next invocation
**When to use:** When users have preferred service and repeating --service flag is tedious
**Example:**
```typescript
// Source: Existing ConfigService pattern with lastUsedService field
// src/workflows/generate.ts (modified)
import { ConfigService } from '../services/config.js';

export async function generateWorkflow(options: WorkflowOptions = {}): Promise<void> {
  const configService = new ConfigService();

  // Determine service: CLI flag > lastUsedService > default
  let service = options.service;
  if (!service) {
    const lastUsed = configService.getLastUsedService();
    service = lastUsed || 'huggingface';
  }

  const aiService = createAIService(service as AIService);
  const result = await aiService.generateImage(currentPrompt);

  // After successful generation, persist service preference
  if (approved) {
    await configService.setLastUsedService(service as AIService);
    // ... save to Zoom
  }
}
```

### Pattern 4: Factory Registration

**What:** Add new service cases to factory without changing interface
**When to use:** When Strategy pattern requires centralized instantiation
**Example:**
```typescript
// Source: Existing factory.ts extended for new services
// src/services/ai/factory.ts
import type { AIServiceAdapter } from './types.js';
import HuggingFaceService from './huggingface.js';
import { OpenAIService } from './openai.js';
import { StabilityService } from './stability.js';
import type { AIService } from '../../types/index.js';
import { ConfigService } from '../config.js';

export function createAIService(service: AIService, apiKey?: string): AIServiceAdapter {
  const configService = new ConfigService();

  switch (service) {
    case 'huggingface':
      // Optional API key for higher rate limits
      const hfKey = apiKey || configService.getApiKey('huggingface');
      return new HuggingFaceService(hfKey);

    case 'openai':
      // Required API key
      const openaiKey = apiKey || configService.getApiKey('openai');
      if (!openaiKey) {
        throw new Error(
          'OpenAI API key required. Set via: zoombg config set openaiApiKey YOUR_KEY'
        );
      }
      return new OpenAIService(openaiKey);

    case 'stability':
      // Required API key
      const stabilityKey = apiKey || configService.getApiKey('stability');
      if (!stabilityKey) {
        throw new Error(
          'Stability AI API key required. Set via: zoombg config set stabilityApiKey YOUR_KEY'
        );
      }
      return new StabilityService(stabilityKey);

    default:
      throw new Error(`Unsupported AI service: ${service}`);
  }
}
```

### Anti-Patterns to Avoid

- **Hardcoding service in workflow:** Never default to specific service in orchestrator - read from config or CLI flag
- **Ignoring API key requirements:** Services like OpenAI/Stability require keys - fail fast with setup instructions, not generic errors
- **Storing API keys in service classes:** Keys belong in ConfigService, services receive via constructor
- **Synchronous file reads:** Stability SDK saves to file - use async readFile() not readFileSync() to avoid blocking
- **Missing error translation:** Raw API errors like "401 Unauthorized" aren't actionable - wrap with service-specific guidance

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OpenAI API integration | Custom fetch() with auth headers | openai SDK | Official SDK handles authentication, retries, rate limiting, error classification, TypeScript types, streaming responses |
| Stability API integration | Manual axios calls with binary parsing | stability-ai SDK | Community SDK abstracts REST endpoints, response parsing, file handling, model naming conventions |
| Service preference storage | Custom JSON file writing | ConfigService.lastUsedService | Already implemented with atomic writes, 0600 permissions, schema validation |
| Base64 encoding/decoding | Custom Buffer.from() wrappers | Node.js Buffer native methods | Buffer.from(b64, 'base64') and buffer.toString('base64') are optimized, handle edge cases |

**Key insight:** AI provider SDKs encapsulate authentication flows, error codes, retry logic, and API versioning changes. Direct REST calls require maintaining compatibility as providers evolve their APIs. SDK updates handle breaking changes transparently.

## Common Pitfalls

### Pitfall 1: Missing API Key Configuration

**What goes wrong:** User selects OpenAI/Stability without configured API key, gets cryptic "401 Unauthorized" error
**Why it happens:** Factory creates service before checking if API key exists in config
**How to avoid:** Check for required API keys in factory, throw specific error with setup instructions before attempting API call
**Warning signs:** Generic authentication errors without explanation of how to configure keys

### Pitfall 2: Not Persisting Service Preference

**What goes wrong:** User specifies --service openai repeatedly, expectation that tool remembers preference not met
**Why it happens:** Service selection read from CLI flag or default, never written back to config
**How to avoid:** Call configService.setLastUsedService() after successful image generation (not before, to avoid persisting failed attempts)
**Warning signs:** Users always specifying --service flag, complaints about "forgetting" their choice

### Pitfall 3: OpenAI Response Format Confusion

**What goes wrong:** Requesting URL format but expecting base64, or vice versa, breaks downstream code expecting Buffer
**Why it happens:** OpenAI supports two formats: url (returns HTTPS link) and b64_json (returns base64 string)
**How to avoid:** Always use response_format: 'b64_json' to get data inline, convert to Buffer immediately, matches HuggingFace pattern
**Warning signs:** Network errors fetching image URLs, CORS issues, external URL dependencies

### Pitfall 4: Stability AI File Cleanup

**What goes wrong:** Stability SDK saves images to local files but doesn't clean them up, disk fills over time
**Why it happens:** SDK prioritizes developer control over automatic cleanup
**How to avoid:** Read buffer from filepath immediately after generation, then delete file, or track paths for cleanup in finally block
**Warning signs:** Temp directory accumulating image files, disk space warnings

### Pitfall 5: Service-Specific Error Code Assumptions

**What goes wrong:** Assuming all services use same error codes (e.g., 429 for rate limits), but Stability uses different codes
**Why it happens:** Different API providers have different error response structures and status codes
**How to avoid:** Wrap each service's errors individually, don't assume HTTP status codes have same meaning across providers
**Warning signs:** Error messages not matching actual failure reason, incorrect user guidance

### Pitfall 6: Timeout Mismatch

**What goes wrong:** Default timeout too short for Stability AI (can take 30-60s), requests fail prematurely
**Why it happens:** Different providers have different generation speeds, free tiers slower than paid
**How to avoid:** Use service-specific timeouts via getTimeout() method: HuggingFace 120s, OpenAI 60s, Stability 90s
**Warning signs:** Timeout errors on services known to be slow but functional

### Pitfall 7: Missing Content Policy Error Translation

**What goes wrong:** Content policy violations show generic 400 error, user doesn't know prompt was rejected
**Why it happens:** Each provider has different content policy and error response format
**How to avoid:** Check error message for keywords (content_policy, safety, moderation), provide service-specific guidance
**Warning signs:** Users confused why some prompts work on one service but not another

## Code Examples

Verified patterns from official sources.

### OpenAI DALL-E 3 Image Generation

```typescript
// Source: OpenAI SDK v6.22.0 api.md and TypeScript interfaces
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Generate with DALL-E 3
const response = await client.images.generate({
  model: 'dall-e-3',
  prompt: 'A serene mountain landscape at sunset',
  n: 1, // DALL-E 3 only supports n=1
  size: '1024x1024', // Options: 1024x1024, 1792x1024, 1024x1792
  quality: 'standard', // Options: standard, hd
  response_format: 'b64_json' // Get base64 data instead of URL
});

const imageData = response.data[0];
const buffer = Buffer.from(imageData.b64_json, 'base64');

// Save to file
import { writeFile } from 'node:fs/promises';
await writeFile('output.png', buffer);
```

### Stability AI Text-to-Image Generation

```typescript
// Source: stability-ai SDK v0.7.0 GitHub README and examples
import StabilityAI from 'stability-ai';

const stability = new StabilityAI(process.env.STABILITY_AI_API_KEY);

// Generate with Stable Diffusion XL
const results = await stability.v1.generation.textToImage(
  'stable-diffusion-xl-1024-v1-0', // Engine ID
  [
    { text: 'A serene mountain landscape at sunset', weight: 1.0 }
  ]
);

// SDK returns array of results with filepath
const result = results[0];
console.log(`Image saved to: ${result.filepath}`);

// Read buffer if needed for processing
import { readFile } from 'node:fs/promises';
const buffer = await readFile(result.filepath);
```

### Service Preference Persistence

```typescript
// Source: Existing ConfigService with lastUsedService field
import { ConfigService } from './services/config.js';
import type { AIService } from './types/index.js';

const configService = new ConfigService();

// Get last used service (defaults to 'huggingface' if never set)
const lastService = configService.getLastUsedService();
console.log(`Last used service: ${lastService}`);

// After successful generation, persist user's choice
const selectedService: AIService = 'openai';
await configService.setLastUsedService(selectedService);

// Next session defaults to 'openai' unless --service flag overrides
```

### Error Handling with Service Context

```typescript
// Source: Derived from OpenAI SDK error types and Stability axios patterns
import { AIServiceError } from './services/errors.js';

try {
  const result = await aiService.generateImage(prompt);
} catch (error: any) {
  if (error instanceof AIServiceError) {
    // User-friendly error with service context
    console.error(`${error.service} Error: ${error.userMessage}`);

    // Service-specific guidance
    if (error.service === 'OpenAI' && error.message.includes('401')) {
      console.error('Get API key: https://platform.openai.com/api-keys');
    } else if (error.service === 'Stability' && error.message.includes('401')) {
      console.error('Get API key: https://platform.stability.ai/account/keys');
    }
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| OpenAI images API v1 (DALL-E 2) | DALL-E 3 with quality and style parameters | Nov 2023 | Higher quality images, longer prompts (4000 chars), HD option, style control (vivid/natural) |
| Stability AI REST API v1 | v2beta with Stable Image Ultra/Core | 2024 | Better quality, faster generation, more control options (sketch, structure, style) |
| URL-based image responses | Base64 inline responses (b64_json) | Ongoing | Eliminates external URL dependencies, CORS issues, network failures fetching images |
| Single service per tool | Multi-service with runtime selection | Current phase | Users choose quality/cost tradeoff, validate abstraction for future providers |

**Deprecated/outdated:**
- **DALL-E 2:** Still available but DALL-E 3 significantly better quality, use dall-e-3 model parameter
- **Stability v1 only:** v2beta adds Stable Image Ultra/Core with better results, SDK supports both
- **Manual authentication headers:** Official SDKs handle auth, retries, rate limiting transparently

## Open Questions

1. **Should tool validate API key before attempting generation?**
   - What we know: ConfigService stores keys, services fail with 401 on invalid key
   - What's unclear: Pre-validation adds network call overhead, but improves error messaging
   - Recommendation: Fail fast in factory if key missing (LOW confidence - offline check), let API call validate key authenticity (avoids extra network round-trip)

2. **What are actual rate limits for OpenAI DALL-E 3 and Stability AI?**
   - What we know: Both return 429 errors when limits exceeded, varies by billing tier
   - What's unclear: Free tier limits (if any), paid tier requests per minute
   - Recommendation: Document that rate limits are tier-dependent, link to provider billing pages in error messages, implement exponential backoff for 429 errors (MEDIUM confidence - standard pattern)

3. **Should service preference be global or per-prompt?**
   - What we know: ConfigService lastUsedService is global, persists across invocations
   - What's unclear: Do users want different services for different prompt types (landscapes vs people)?
   - Recommendation: Phase 4 uses global preference (simpler UX), Phase 5 could add prompt-based preferences if requested (LOW confidence - no user feedback yet)

4. **Do Stability AI generated files need explicit cleanup?**
   - What we know: SDK saves to local filesystem, returns filepath
   - What's unclear: Does SDK clean up automatically? Are files in temp directory?
   - Recommendation: Read buffer and immediately delete file after generation to prevent accumulation, use same cleanup pattern as Phase 2 temp files (MEDIUM-HIGH confidence - defensive approach)

5. **Should tool support multiple concurrent service calls?**
   - What we know: Current workflow is sequential (one service at a time)
   - What's unclear: Would users want to generate with all services simultaneously and pick best result?
   - Recommendation: Phase 4 maintains sequential single-service model, Phase 5 could add parallel generation if users request it (LOW confidence - adds complexity without validated demand)

## Sources

### Primary (HIGH confidence)
- **openai npm package v6.22.0** (https://www.npmjs.com/package/openai) - Latest version, peer dependencies, installation
- **OpenAI Node SDK api.md** (https://github.com/openai/openai-node/blob/master/api.md) - TypeScript interfaces for images.generate, parameters, response types
- **stability-ai npm package v0.7.0** (https://www.npmjs.com/package/stability-ai) - Community SDK version, dependencies (axios, fs-extra)
- **stability-ai GitHub README** (https://github.com/jbeoris/stability-ai-node-sdk) - Authentication, textToImage usage, engine IDs, response format
- **Existing codebase analysis** - ConfigService with lastUsedService field, AIServiceAdapter interface, HuggingFaceService implementation pattern

### Secondary (MEDIUM confidence)
- **OpenAI SDK TypeScript interfaces** - Parameter types extracted via WebFetch, model options, size options, response_format values
- **Stability AI SDK examples** - Usage patterns inferred from README, specific error codes not documented
- **Node.js Buffer documentation** - Base64 encoding/decoding patterns, verified standard approach

### Tertiary (LOW confidence - needs verification)
- **Rate limits for paid tiers** - Not documented publicly, varies by billing plan, 429 error handling is known pattern
- **Stability AI file cleanup behavior** - SDK documentation doesn't specify, defensive cleanup recommended
- **Content policy error codes** - Inferred from typical API patterns, exact error messages may vary

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - OpenAI official SDK verified, stability-ai most maintained community option, versions checked on npm 2026-02-22
- Architecture: HIGH - Strategy pattern already validated in Phase 1, new services follow established interface, factory pattern is standard
- OpenAI integration: MEDIUM-HIGH - SDK documented, TypeScript interfaces verified, response format patterns extracted, some examples incomplete (404s from GitHub)
- Stability AI integration: MEDIUM - Community SDK documented, usage examples verified, error handling patterns inferred from axios conventions, official docs blocked by Cloudflare
- Pitfalls: MEDIUM-HIGH - Based on API patterns from Phase 1 research, service-specific behaviors inferred from SDK documentation
- Configuration persistence: HIGH - ConfigService already implements lastUsedService with atomic writes and permissions

**Research date:** 2026-02-22
**Valid until:** 2026-03-22 (30 days - AI SDKs update frequently, OpenAI released DALL-E 3 improvements Dec 2024, Stability v2beta evolving)

**Known blockers:**
- Stability AI official documentation inaccessible (Cloudflare protection) - relied on community SDK and npm README
- OpenAI GitHub examples returned 404s - used SDK TypeScript interfaces and api.md instead
- No official rate limit documentation for either provider - will handle 429 errors reactively
