# ZoomBG

## What This Is

A CLI tool for macOS that generates AI-powered Zoom background images from text prompts and sets them as your Zoom background with user approval. The tool displays generated images in a browser for preview before applying them.

## Core Value

Quickly create and set custom Zoom backgrounds using AI without leaving the terminal.

## Current Milestone: v1.0 Initial Release

**Goal:** Build a working CLI that can generate AI backgrounds and set them in Zoom.

**Target features:**
- Zoom installation and login verification
- Multi-service AI image generation (free default + paid options)
- Browser-based image preview and approval flow
- Automatic Zoom background configuration

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Verify Zoom is installed and user is logged in before proceeding
- [ ] Support multiple AI image generation services (Hugging Face free default, DALL-E 3, Stability AI)
- [ ] Generate image from user text prompt
- [ ] Display generated image in browser for preview
- [ ] Allow user to approve ("yes") or request modifications ("no")
- [ ] On rejection, prompt for modified description and regenerate
- [ ] Save approved image to Zoom backgrounds directory
- [ ] Store API keys locally (config file)
- [ ] Remember last used AI service across sessions

### Out of Scope

- Multi-platform support (Windows, Linux) — macOS only for v1
- Mid-session service switching — keep it simple, one service per session
- Complex image editing or manipulation — generation only
- Real-time Zoom preview with background applied — just file placement
- Image history or gallery — single image workflow

## Context

- Target platform: macOS only
- Assumes Zoom desktop app is installed
- Uses simple local HTML page for image display (opens in default browser)
- Free option (Hugging Face) as default to lower barrier to entry
- API keys stored in plain text config initially (can encrypt later)

## Constraints

- **Platform**: macOS only — simplifies Zoom integration and file system operations
- **Tech stack**: CLI tool (Node.js or Python recommended for API integrations and browser control)
- **Dependencies**: Zoom desktop app must be pre-installed
- **Network**: Requires internet connection for AI service APIs

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Free service as default | Lower barrier to entry, users can try without API keys | — Pending |
| Browser preview vs terminal | Better image quality assessment in browser | — Pending |
| Single service per session | Simpler UX, avoid confusion with multiple keys/configs | — Pending |
| macOS only | Faster v1 delivery, can expand later | — Pending |

---
*Last updated: 2025-02-21 after initial milestone definition*
