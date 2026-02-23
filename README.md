# Vroom 🚀

Generate AI-powered Zoom backgrounds from text prompts with style.

Vroom is a command-line tool that creates custom Zoom virtual backgrounds using AI image generation. Choose from free (HuggingFace) or premium services (OpenAI DALL-E 3, Stability AI), preview images in your browser, and automatically install approved backgrounds to Zoom.

## Features

### 🎨 **Multiple AI Providers**
- **HuggingFace** (free tier) - No API key required
- **OpenAI DALL-E 3** - High-quality images with your API key
- **Stability AI** - Alternative premium option

### 🔒 **Secure Configuration**
- API keys stored with 0600 file permissions
- Automatic security enforcement
- Cross-platform config management

### 🖼️ **Interactive Workflow**
- Generate images from text prompts
- Preview in browser before saving
- Approve or regenerate with refinements
- Automatic installation to Zoom backgrounds

### 💾 **Smart Defaults**
- Remembers your preferred AI service
- Sticky service selection across sessions
- No repeated configuration needed

### 🧪 **Dry-Run Mode**
- Test without modifying Zoom directory
- Validate API keys and prompts
- Perfect for CI/CD and testing

### 🛡️ **Robust Error Handling**
- Automatic retry for transient failures
- Service-specific timeout enforcement
- User-friendly error messages with solutions

## Installation

### Prerequisites

- **Node.js** 18+ required
- **Zoom** installed and logged in
- **API keys** (optional, for premium services)

### Install via npm

```bash
npm install -g vroom
```

### Build from source

```bash
git clone https://github.com/thanigaiv/vroom.git
cd vroom
npm install
npm run build
npm link
```

## Quick Start

### Generate with free tier (no API key needed)

```bash
vroom "serene mountain landscape at sunset"
```

### Configure API keys for AI services

```bash
# HuggingFace (optional - improves free tier rate limits)
vroom config set huggingfaceApiKey hf_YOUR_KEY

# OpenAI DALL-E 3 (required for OpenAI service)
vroom config set openaiApiKey sk-YOUR_KEY

# Stability AI (required for Stability service)
vroom config set stabilityApiKey sk-YOUR_KEY
```

### Use specific AI service

```bash
vroom "modern office workspace" --service openai
```

### Test without saving (dry-run)

```bash
vroom "ocean waves" --dry-run
```

## Usage

### Basic Commands

```bash
# Interactive mode (prompts for input)
vroom

# Generate with prompt
vroom "your description here"

# Use specific service
vroom "cyberpunk cityscape" --service stability

# Test without saving
vroom "forest scene" --dry-run

# Show help
vroom --help

# Show version
vroom --version
```

### Configuration Management

```bash
# Set API keys (choose the services you want to use)
vroom config set huggingfaceApiKey hf_YOUR_KEY
vroom config set openaiApiKey sk-YOUR_KEY
vroom config set stabilityApiKey sk-YOUR_KEY

# Get specific API key
vroom config get openaiApiKey

# List all configuration
vroom config list

# Get config file location
vroom config path

# Delete API key
vroom config delete stabilityApiKey
```

### Service Selection

Vroom uses this priority order:
1. **CLI flag** - `--service openai` (explicit choice for this run)
2. **Last used service** - Automatically remembered from previous session
3. **Default** - HuggingFace free tier

Once you use a service and save an image, Vroom remembers it for next time.

## AI Service Comparison

| Service | API Key | Cost | Speed | Quality | Timeout |
|---------|---------|------|-------|---------|---------|
| **HuggingFace** | Optional | Free tier available | Slower (120s) | Good | 120s |
| **OpenAI DALL-E 3** | Required | Pay per image | Fast (60s) | Excellent | 60s |
| **Stability AI** | Required | Pay per image | Medium (90s) | Excellent | 90s |

### Getting API Keys

- **OpenAI**: https://platform.openai.com/api-keys
- **Stability AI**: https://platform.stability.ai/account/keys
- **HuggingFace**: https://huggingface.co/settings/tokens (optional)

## Workflow

1. **Generate** - AI creates image from your text prompt
2. **Preview** - Image opens in browser for review
3. **Approve/Regenerate** - Accept or refine with new prompt
4. **Save** - Automatically installs to Zoom backgrounds directory

### Example Session

```bash
$ vroom "mountain sunset with purple sky"

Generating image (may take 15-90 seconds)...
✓ Image generated successfully

Opening preview in browser...

? Approve this background? (Y/n) Y
? Save as: mountain-sunset.png

✓ Saved to: /Users/you/Library/Application Support/zoom.us/data/VirtualBkgnd_Custom/mountain-sunset.png
```

## Dry-Run Mode

Test the tool without modifying your system:

```bash
vroom "test prompt" --dry-run
```

**What dry-run skips:**
- Saving files to Zoom backgrounds directory
- Persisting service preference to config

**What dry-run does:**
- Generates real image (tests API keys)
- Opens browser preview
- Shows where file would be saved
- Displays simulated metadata

**Use cases:**
- Test API keys before committing
- Preview prompts without cluttering Zoom
- CI/CD testing and validation

## Error Handling

Vroom automatically handles common errors:

### Network Issues
- Automatic retry with exponential backoff
- Clear error messages with solutions
- Timeout enforcement prevents indefinite hangs

### Rate Limits
- Detects 429 errors from AI services
- Shows retry-after information
- Suggests waiting or upgrading plan

### Configuration Problems
- Validates API keys before use
- Checks Zoom installation and login status
- Verifies directory permissions

## Troubleshooting

### "Zoom not installed"
```bash
# macOS - Install Zoom from:
https://zoom.us/download

# Verify installation
ls "/Applications/zoom.us.app"
```

### "Zoom not logged in"
1. Open Zoom application
2. Sign in with your account
3. Try Vroom again

### "Permission denied" on config file
```bash
# View config location
vroom config path

# Check permissions (should be 0600)
ls -la $(vroom config path)
```

### HuggingFace provider errors
- Free tier has variable availability
- Try a premium service: `--service openai`
- Or wait a few minutes and retry

### "Invalid API key"
```bash
# Verify key is set correctly
vroom config get openaiApiKey

# Re-set if needed
vroom config set openaiApiKey sk-YOUR-KEY
```

## Architecture

Vroom uses a **Strategy pattern** for AI services:
- Common `AIServiceAdapter` interface
- Factory creates service instances
- Zero orchestration changes when adding providers

**Key Design Decisions:**
- TypeScript for type safety
- ESM modules for modern Node.js
- Atomic commits in development (GSD workflow)
- Phase-based feature development

## Development

### Project Structure

```
vroom/
├── src/
│   ├── cli.ts              # Command-line interface
│   ├── services/           # Core services
│   │   ├── ai/            # AI provider adapters
│   │   ├── config.ts      # Configuration management
│   │   ├── errors.ts      # Error types
│   │   └── zoom.ts        # Zoom integration
│   ├── workflows/         # Orchestration
│   │   ├── generate.ts    # Main workflow
│   │   └── preview.ts     # Browser preview
│   ├── utils/             # Utilities
│   └── types/             # TypeScript types
├── dist/                  # Compiled JavaScript
├── .planning/             # GSD planning artifacts
└── package.json
```

### Build and Test

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run development version
npm run dev "test prompt"

# Link for local testing
npm link
vroom "test prompt"
```

### Adding a New AI Service

1. Create adapter in `src/services/ai/newservice.ts`
2. Implement `AIServiceAdapter` interface
3. Add case to factory in `src/services/ai/factory.ts`
4. Add API key to config schema
5. Update CLI validation

**Example:**
```typescript
export class NewService implements AIServiceAdapter {
  getServiceName(): string { return 'NewService'; }
  requiresApiKey(): boolean { return true; }
  getTimeout(): number { return 60000; }
  async generateImage(prompt: string): Promise<GenerationResult> {
    // Implementation
  }
}
```

## Contributing

Vroom was built using the [Get Shit Done (GSD)](https://github.com/anthropics/claude-code) workflow:
- Phases represent feature milestones
- Plans are atomic, executable units
- Verification ensures goal achievement
- All work tracked in `.planning/`

### Development Phases

- ✅ **Phase 1**: Foundation & Core Services
- ✅ **Phase 2**: Workflow Orchestration
- ✅ **Phase 3**: CLI Interface
- ✅ **Phase 4**: Multi-Service Support
- ✅ **Phase 5**: Enhancement & Polish

## License

MIT

## Links

- GitHub: https://github.com/thanigaiv/vroom
- Issues: https://github.com/thanigaiv/vroom/issues
- NPM: (publish to npm for public package)

## Credits

Built with:
- [Commander.js](https://github.com/tj/commander.js) - CLI framework
- [Inquirer](https://github.com/SBoudrias/Inquirer.js) - Interactive prompts
- [Conf](https://github.com/sindresorhus/conf) - Config management
- [OpenAI SDK](https://github.com/openai/openai-node) - DALL-E 3 integration
- [HuggingFace Inference](https://huggingface.co/docs/huggingface.js) - Free tier AI
- [Stability AI SDK](https://platform.stability.ai/docs) - Stable Diffusion

---

**Made with ❤️ and Claude Code**
