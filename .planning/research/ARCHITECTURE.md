# Architecture Research

**Domain:** CLI tool with AI service integration, browser preview, and file system operations
**Researched:** 2026-02-21
**Confidence:** MEDIUM-HIGH

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      CLI Interface Layer                     │
│  (Command parsing, validation, user interaction)             │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │  Zoom   │  │   AI    │  │ Browser │  │ Config  │        │
│  │Verifier │  │ Service │  │ Preview │  │ Manager │        │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘        │
│       │            │            │            │              │
├───────┴────────────┴────────────┴────────────┴──────────────┤
│                    Service Orchestrator                      │
│       (Coordinates workflow, manages state transitions)      │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Platform Adapters Layer                 │    │
│  │    (File system, process spawning, HTTP clients)     │    │
│  └─────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────┤
│                     Persistence Layer                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                   │
│  │  Config  │  │  Image   │  │   Temp   │                   │
│  │  Store   │  │  Cache   │  │   HTML   │                   │
│  └──────────┘  └──────────┘  └──────────┘                   │
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| **CLI Interface** | Parse commands, handle user input, display output | Commander.js or oclif for command structure |
| **Zoom Verifier** | Check Zoom installation, verify login status | Platform-specific process checks, file existence validation |
| **AI Service Manager** | Abstract multiple AI providers, handle API calls, manage errors | Strategy pattern for provider selection, unified interface |
| **Browser Preview** | Generate HTML, open browser, handle approval flow | Template generation, `open` package for cross-platform browser launch |
| **Config Manager** | Store/retrieve API keys, remember service preference | `conf` package for atomic writes, schema validation |
| **Service Orchestrator** | Coordinate the generate→preview→approve→save workflow | State machine or sequential promise chain |
| **Platform Adapters** | Abstract OS-specific operations (file paths, process spawning) | Adapter pattern for macOS-specific logic |
| **Persistence Layer** | File I/O, temporary file management, background cleanup | Node.js `fs` module, OS temp directories |

## Recommended Project Structure

```
zoombg/
├── bin/
│   └── zoombg.js              # Entry point (#!/usr/bin/env node)
├── src/
│   ├── cli/
│   │   ├── commands/
│   │   │   ├── generate.js    # Main generate command handler
│   │   │   └── config.js      # Config management commands
│   │   ├── index.js           # CLI setup and command registration
│   │   └── prompts.js         # User interaction prompts
│   ├── services/
│   │   ├── ai/
│   │   │   ├── index.js       # AI service factory/strategy selector
│   │   │   ├── huggingface.js # Hugging Face implementation
│   │   │   ├── dalle.js       # DALL-E implementation
│   │   │   └── stability.js   # Stability AI implementation
│   │   ├── zoom/
│   │   │   ├── verifier.js    # Zoom installation/login checks
│   │   │   └── background.js  # Background file management
│   │   ├── preview/
│   │   │   ├── generator.js   # HTML template generation
│   │   │   └── launcher.js    # Browser opening logic
│   │   └── config/
│   │       └── store.js       # Configuration persistence
│   ├── orchestrator/
│   │   └── workflow.js        # Coordinates generate→preview→approve flow
│   ├── utils/
│   │   ├── errors.js          # Custom error classes
│   │   ├── logger.js          # Logging utilities
│   │   └── platform.js        # macOS-specific helpers
│   └── index.js               # Main exports
├── templates/
│   └── preview.html           # HTML template for browser preview
├── tests/
│   ├── unit/                  # Component tests
│   └── integration/           # End-to-end tests
├── package.json
└── README.md
```

### Structure Rationale

- **bin/:** Executable entry point that imports the CLI from src/
- **cli/commands/:** Each command is a separate module for maintainability and testability
- **services/:** Business logic separated by domain (AI, Zoom, preview, config) - each is independently testable
- **orchestrator/:** Single responsibility for workflow coordination - isolates state transitions from business logic
- **utils/:** Cross-cutting concerns (logging, errors, platform helpers)
- **templates/:** Static assets separated from code

**Why this structure:**
- **Separation of concerns:** CLI parsing is distinct from business logic
- **Testability:** Services can be unit tested without invoking CLI
- **Extensibility:** Adding a new AI provider = add new file in services/ai/
- **Clarity:** Directory structure mirrors component diagram

## Architectural Patterns

### Pattern 1: Service Adapter (Strategy Pattern)

**What:** Abstract multiple AI providers behind a unified interface. Each provider implements the same contract.

**When to use:** When supporting multiple external services with similar functionality but different APIs.

**Trade-offs:**
- **Pro:** Easy to add new providers without changing orchestration logic
- **Pro:** Can mock AI services for testing
- **Con:** Adds one level of indirection

**Example:**
```javascript
// src/services/ai/index.js
class AIServiceFactory {
  static create(provider, apiKey) {
    switch(provider) {
      case 'dalle': return new DalleService(apiKey);
      case 'stability': return new StabilityService(apiKey);
      default: return new HuggingFaceService(apiKey);
    }
  }
}

// All providers implement this interface
class AIService {
  async generateImage(prompt, options) {
    throw new Error('Must implement');
  }
}

// Usage in orchestrator
const service = AIServiceFactory.create(config.get('provider'), apiKey);
const imageUrl = await service.generateImage(userPrompt);
```

### Pattern 2: Orchestrator (Coordinator Pattern)

**What:** Single module responsible for coordinating the multi-step workflow: generate → preview → approve/reject → save.

**When to use:** When business logic involves multiple services that must execute in sequence with conditional branching.

**Trade-offs:**
- **Pro:** Workflow logic is in one place, easy to understand flow
- **Pro:** Services remain decoupled and independently testable
- **Con:** Orchestrator can become a "god object" if not careful

**Example:**
```javascript
// src/orchestrator/workflow.js
class WorkflowOrchestrator {
  constructor(aiService, previewService, zoomService, config) {
    this.aiService = aiService;
    this.previewService = previewService;
    this.zoomService = zoomService;
    this.config = config;
  }

  async execute(prompt) {
    // 1. Verify Zoom
    await this.zoomService.verify();

    // 2. Generate image
    const imageUrl = await this.aiService.generateImage(prompt);

    // 3. Preview in browser
    const htmlPath = await this.previewService.generate(imageUrl);
    await this.previewService.launch(htmlPath);

    // 4. Get user approval
    const approved = await this.getUserApproval();

    if (approved) {
      // 5. Save to Zoom
      await this.zoomService.saveBackground(imageUrl);
      return { success: true };
    } else {
      // Recursive: prompt for modifications
      const modifiedPrompt = await this.getModifiedPrompt();
      return this.execute(modifiedPrompt);
    }
  }
}
```

### Pattern 3: Atomic Configuration with Schema Validation

**What:** Use a dedicated configuration store with atomic writes and schema validation to prevent corruption.

**When to use:** For storing API keys, user preferences, and other persistent settings in CLI tools.

**Trade-offs:**
- **Pro:** Atomic writes prevent corruption on crash
- **Pro:** Schema validation catches configuration errors early
- **Pro:** Platform-appropriate storage locations handled automatically
- **Con:** Single-process limitation (not an issue for CLI tools)

**Example:**
```javascript
// src/services/config/store.js
import Conf from 'conf';

const schema = {
  provider: {
    type: 'string',
    enum: ['huggingface', 'dalle', 'stability'],
    default: 'huggingface'
  },
  apiKeys: {
    type: 'object',
    properties: {
      dalle: { type: 'string' },
      stability: { type: 'string' }
    }
  }
};

class ConfigStore {
  constructor() {
    this.store = new Conf({
      projectName: 'zoombg',
      schema
    });
  }

  getProvider() {
    return this.store.get('provider', 'huggingface');
  }

  setProvider(provider) {
    this.store.set('provider', provider);
  }

  getApiKey(provider) {
    return this.store.get(`apiKeys.${provider}`);
  }

  setApiKey(provider, key) {
    this.store.set(`apiKeys.${provider}`, key);
  }
}
```

### Pattern 4: Error Wrapping with Context

**What:** Wrap external service errors with context about what operation failed and provide actionable error messages.

**When to use:** Always, especially when integrating external APIs that may fail for various reasons.

**Trade-offs:**
- **Pro:** Users get helpful error messages
- **Pro:** Easier debugging with full error context
- **Con:** Requires discipline to wrap every external call

**Example:**
```javascript
// src/utils/errors.js
class ZoomBGError extends Error {
  constructor(message, context = {}) {
    super(message);
    this.name = 'ZoomBGError';
    this.context = context;
  }
}

class AIServiceError extends ZoomBGError {
  constructor(provider, originalError) {
    super(
      `Failed to generate image using ${provider}`,
      { provider, originalError: originalError.message }
    );
  }
}

// Usage
try {
  const response = await fetch(apiUrl);
  if (!response.ok) {
    throw new AIServiceError('dalle', new Error(`HTTP ${response.status}`));
  }
} catch (error) {
  if (error instanceof AIServiceError) {
    console.error(`AI Service Error: ${error.message}`);
    console.error(`Provider: ${error.context.provider}`);
    console.error(`Details: ${error.context.originalError}`);
  }
  throw error;
}
```

## Data Flow

### Request Flow: Generate Background

```
User Command: zoombg generate "sunset beach"
    ↓
[CLI Parser] → parse command & arguments
    ↓
[Generate Command Handler] → validate prompt
    ↓
[Workflow Orchestrator] → coordinate services
    ↓
┌─────────────────────────────────────────────┐
│ 1. [Zoom Verifier]                          │
│    → Check ~/Library/Application Support/   │
│    → Verify Zoom.app exists                 │
│    ← Return verification status             │
└─────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────┐
│ 2. [Config Manager]                         │
│    → Get preferred provider                 │
│    → Get API key for provider               │
│    ← Return config                          │
└─────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────┐
│ 3. [AI Service Factory]                     │
│    → Create provider instance               │
│    ↓                                         │
│    [AI Provider] → API call with prompt     │
│    ← Return image URL or binary             │
└─────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────┐
│ 4. [Preview Generator]                      │
│    → Create temp HTML with image            │
│    → Write to temp directory                │
│    ← Return HTML file path                  │
└─────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────┐
│ 5. [Browser Launcher]                       │
│    → Open HTML in default browser           │
│    ↓                                         │
│    [User views in browser]                  │
└─────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────┐
│ 6. [CLI Prompt]                             │
│    → Display "Approve? (y/n)"               │
│    ← User input                             │
└─────────────────────────────────────────────┘
    ↓
    If YES ────────────────────────────────────┐
    ↓                                           │
┌─────────────────────────────────────────┐   │
│ 7. [Zoom Background Manager]            │   │
│    → Download/copy image                │   │
│    → Save to Zoom backgrounds directory │   │
│    ← Success confirmation               │   │
└─────────────────────────────────────────┘   │
    ↓                                           │
[Display Success Message] ←───────────────────┘

    If NO ──────────────────────────────────────┐
    ↓                                            │
┌──────────────────────────────────────────┐   │
│ [CLI Prompt]                             │   │
│    → "Modify prompt:"                    │   │
│    ← New prompt from user                │   │
└──────────────────────────────────────────┘   │
    ↓                                            │
    RESTART FROM STEP 3 ←──────────────────────┘
```

### Configuration Flow

```
User: zoombg config set provider dalle
    ↓
[CLI Parser] → parse config command
    ↓
[Config Command Handler] → validate provider value
    ↓
[Config Store] → atomic write to config file
    ↓
    Location: ~/.config/zoombg/config.json (macOS)
    Content: { "provider": "dalle", "apiKeys": {...} }
    ↓
[Success Message] → "Provider set to dalle"
```

### Key Data Flows

1. **Image generation flow:** User prompt → AI service → Image URL/binary → Temp HTML → Browser display
2. **Configuration flow:** User command → Config validation → Atomic write → Persistent storage
3. **Approval flow:** Browser preview → CLI prompt → User input → Conditional execution (save or regenerate)
4. **Error flow:** Service error → Error wrapper → Context logging → User-friendly message

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1-100 users | Current architecture is sufficient. Single-process CLI, no concurrency concerns. Focus on error handling and user experience. |
| 100-1k users (organization use) | Add: Shared configuration for teams (optional cloud config), usage analytics (opt-in), image caching to reduce API costs |
| 1k+ users (SaaS potential) | Consider: Backend service for image generation (queue system), web interface alongside CLI, centralized API key management, rate limiting per user |

### Scaling Priorities

1. **First bottleneck:** API rate limits from AI services
   - **Fix:** Implement exponential backoff retry logic, add response caching for duplicate prompts

2. **Second bottleneck:** Cost of paid AI services
   - **Fix:** Add image caching/deduplication, implement cost tracking per user, consider hosting own model for common requests

**Note for v1.0:** The recommended architecture is designed for individual users. No premature optimization for scale needed.

## Anti-Patterns

### Anti-Pattern 1: Inline API Calls in CLI Commands

**What people do:** Put API calls directly in command handler functions
```javascript
// BAD
program
  .command('generate <prompt>')
  .action(async (prompt) => {
    const response = await fetch('https://api.ai.com/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt })
    });
    // ... more logic mixed together
  });
```

**Why it's wrong:**
- Impossible to unit test without making real API calls
- Can't swap AI providers without rewriting command handlers
- Violates separation of concerns

**Do this instead:** Extract API logic to service modules
```javascript
// GOOD
program
  .command('generate <prompt>')
  .action(async (prompt) => {
    const orchestrator = new WorkflowOrchestrator(/* inject dependencies */);
    await orchestrator.execute(prompt);
  });
```

### Anti-Pattern 2: Storing API Keys as Plain Environment Variables

**What people do:** Use `.env` files or environment variables for API key storage
```javascript
// BAD
const apiKey = process.env.OPENAI_API_KEY;
```

**Why it's wrong:**
- Requires users to set environment variables every session
- No persistent storage of provider preference
- .env files can be accidentally committed to git

**Do this instead:** Use dedicated configuration store
```javascript
// GOOD
const config = new ConfigStore();
const apiKey = config.getApiKey('dalle') || await promptForApiKey();
```

### Anti-Pattern 3: Synchronous File Operations

**What people do:** Use `fs.readFileSync()` and `fs.writeFileSync()` in async contexts
```javascript
// BAD
async function saveBackground(imageUrl) {
  const data = fs.readFileSync(imageUrl); // Blocks event loop
  fs.writeFileSync(targetPath, data);
}
```

**Why it's wrong:**
- Blocks the event loop unnecessarily
- No error handling for I/O failures
- Doesn't take advantage of Node.js async capabilities

**Do this instead:** Use async file operations
```javascript
// GOOD
async function saveBackground(imageUrl) {
  const data = await fs.promises.readFile(imageUrl);
  await fs.promises.writeFile(targetPath, data);
}
```

### Anti-Pattern 4: Monolithic Orchestrator

**What people do:** Put all business logic in a single orchestrator class that grows to hundreds of lines
```javascript
// BAD
class Orchestrator {
  async execute(prompt) {
    // Zoom verification logic (50 lines)
    // AI service selection logic (30 lines)
    // Image generation logic (40 lines)
    // HTML generation logic (60 lines)
    // Browser launching logic (20 lines)
    // User prompt logic (30 lines)
    // File saving logic (40 lines)
    // ... 270+ lines total
  }
}
```

**Why it's wrong:**
- Difficult to test individual concerns
- Hard to understand what the orchestrator actually coordinates
- Violates single responsibility principle

**Do this instead:** Orchestrator delegates to specialized services
```javascript
// GOOD
class Orchestrator {
  constructor(zoomService, aiService, previewService) {
    this.zoomService = zoomService;
    this.aiService = aiService;
    this.previewService = previewService;
  }

  async execute(prompt) {
    await this.zoomService.verify();
    const imageUrl = await this.aiService.generate(prompt);
    await this.previewService.show(imageUrl);
    const approved = await this.getUserApproval();
    if (approved) {
      await this.zoomService.save(imageUrl);
    }
  }
}
```

### Anti-Pattern 5: No Error Context for External Services

**What people do:** Let external service errors bubble up as-is
```javascript
// BAD
try {
  await fetch(apiUrl);
} catch (error) {
  throw error; // Generic network error, no context
}
```

**Why it's wrong:**
- Users see cryptic error messages
- No way to know which service failed or why
- Difficult to debug issues in production

**Do this instead:** Wrap errors with context
```javascript
// GOOD
try {
  const response = await fetch(apiUrl);
  if (!response.ok) {
    throw new AIServiceError(
      'dalle',
      new Error(`API returned ${response.status}: ${response.statusText}`)
    );
  }
} catch (error) {
  if (error instanceof AIServiceError) {
    console.error(`Failed to generate image with DALL-E`);
    console.error(`Reason: ${error.context.originalError}`);
    console.error(`Try: Check your API key or try a different provider`);
  }
  throw error;
}
```

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| **Hugging Face API** | HTTP REST via fetch/axios | Free tier available, may have rate limits. Use Inference API for model access. |
| **OpenAI DALL-E 3** | Official `openai` npm package | Requires paid API key. Best error handling and retry logic built-in. |
| **Stability AI** | HTTP REST via fetch/axios | Requires paid API key. Returns binary image data, different from URL-based APIs. |
| **Default Browser** | `open` npm package | Cross-platform but target macOS only for v1. Use `await open(url)` pattern. |
| **Zoom Application** | File system operations | No official API. Write to `~/Library/Application Support/zoom.us/data/VirtualBkgnd_Custom/` on macOS. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| **CLI ↔ Orchestrator** | Direct function calls | CLI passes validated input, orchestrator returns success/error. Keep CLI thin. |
| **Orchestrator ↔ Services** | Dependency injection | Orchestrator receives service instances in constructor. Enables testing with mocks. |
| **AI Service Factory ↔ Providers** | Unified interface | All providers implement `generateImage(prompt, options)` contract. Factory selects based on config. |
| **Config Store ↔ Services** | Shared instance | Singleton config store passed to services that need it. No direct file I/O in services. |
| **Preview Generator ↔ Browser Launcher** | File path | Generator creates HTML file, returns path. Launcher takes path and opens browser. Decoupled. |

## Build Order Recommendation

Based on dependencies and testing priorities:

### Phase 1: Foundation (Independent, can build in parallel)
1. **Config Store** - No dependencies, needed by all other components
2. **Error Classes** - No dependencies, needed for proper error handling
3. **Platform Utils** - No dependencies, needed for file paths and OS detection

### Phase 2: Core Services (Depends on Phase 1)
4. **Zoom Verifier** - Depends on: Platform Utils, Error Classes
5. **AI Service Interfaces** - Depends on: Config Store, Error Classes
6. **Preview Generator** - Depends on: Platform Utils (for temp paths)

### Phase 3: AI Provider Implementations (Depends on Phase 2)
7. **Hugging Face Service** - Depends on: AI Service Interface, Error Classes
8. **DALL-E Service** - Depends on: AI Service Interface, Config Store, Error Classes
9. **Stability Service** - Depends on: AI Service Interface, Config Store, Error Classes

### Phase 4: Browser Integration (Depends on Phase 2, 3)
10. **Browser Launcher** - Depends on: Preview Generator, Error Classes

### Phase 5: Orchestration (Depends on all services)
11. **Workflow Orchestrator** - Depends on: All services, Config Store, Error Classes

### Phase 6: CLI Interface (Depends on all previous)
12. **CLI Commands** - Depends on: Orchestrator, Config Store
13. **Entry Point** - Depends on: CLI Commands

### Phase 7: Integration
14. **End-to-end testing** - Validates all components work together

**Rationale for this order:**
- Build foundation first so all components can use shared utilities
- Services are independent and can be built/tested in isolation
- Orchestrator comes late because it coordinates completed services
- CLI is last because it's just a thin wrapper over orchestrator
- Can parallelize within phases (e.g., all three AI services at once)

## Sources

- oclif CLI Framework Architecture: https://github.com/oclif/oclif (MEDIUM confidence - official framework docs)
- Commander.js command structure patterns: https://github.com/tj/commander.js (MEDIUM confidence - official library docs)
- Configuration management pattern (`conf`): https://github.com/sindresorhus/conf (MEDIUM confidence - official library docs)
- OpenAI Node.js integration: https://github.com/openai/openai-node (MEDIUM confidence - official SDK docs)
- Browser launching pattern (`open`): https://github.com/sindresorhus/open (MEDIUM confidence - official library docs)
- CLI architecture patterns: Training data from established Node.js CLI patterns (MEDIUM confidence - widely adopted patterns)

**Confidence Assessment:**
- **Component structure:** HIGH - based on established CLI patterns and official framework documentation
- **Service integration:** MEDIUM-HIGH - based on official SDK documentation and common practices
- **Data flow:** HIGH - logical workflow derived from requirements
- **Build order:** HIGH - based on dependency analysis
- **Anti-patterns:** MEDIUM - based on common mistakes observed in CLI tools (training data)

---
*Architecture research for: ZoomBG - AI-powered Zoom background CLI tool*
*Researched: 2026-02-21*
