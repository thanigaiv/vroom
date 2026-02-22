---
phase: 02-workflow-orchestration
plan: 01
subsystem: workflow
tags: [browser, preview, cleanup, temporary-files, base64, signal-handlers]

# Dependency graph
requires:
  - phase: 01-foundation-and-core-services
    provides: Project structure and TypeScript configuration
provides:
  - Browser preview system with base64 data URL embedding
  - Resource cleanup manager with signal handlers
  - Temporary file management utilities
affects: [02-workflow-orchestration, user-interaction]

# Tech tracking
tech-stack:
  added: [open]
  patterns: [base64 data URLs for CORS-free image display, signal handler cleanup pattern, caller-managed cleanup with temp directory return]

key-files:
  created:
    - src/utils/html-gen.ts
    - src/utils/cleanup.ts
    - src/workflows/preview.ts
  modified:
    - package.json
    - package-lock.json

key-decisions:
  - "Use base64 data URLs instead of file:// protocol to avoid CORS issues"
  - "Use pathToFileURL for proper special character encoding in file paths"
  - "Return temp directory path for caller-managed cleanup (browser needs file until HTML loads)"
  - "Use Promise.allSettled in cleanup manager to ensure all cleanups attempt even on failure"

patterns-established:
  - "Base64 data URL embedding for binary content in HTML: avoids file protocol security restrictions"
  - "Signal handler pattern: register SIGINT/SIGTERM in constructor, use standard exit codes (130/143)"
  - "Caller-managed cleanup: return temp directory path, let caller decide cleanup timing"
  - "Error cleanup: always attempt temp directory cleanup in catch blocks before re-throwing"

requirements-completed: [FLOW-01]

# Metrics
duration: 2.3min
completed: 2026-02-22
---

# Phase 2 Plan 1: Browser Preview Infrastructure Summary

**Browser preview with base64 data URLs, signal-based cleanup manager, and temporary file management for user-interactive workflows**

## Performance

- **Duration:** 2.3 min
- **Started:** 2026-02-22T06:10:03Z
- **Completed:** 2026-02-22T06:12:23Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- HTML template generator converts image buffers to base64 data URLs, avoiding file:// protocol CORS issues
- Cleanup manager with SIGINT/SIGTERM signal handlers ensures temporary resources cleaned up on all exit paths
- Browser preview workflow opens images in browser and returns temp directory path for caller-controlled cleanup timing

## Task Commits

Each task was committed atomically:

1. **Task 1: Create HTML template generator with base64 data URL embedding** - `d149b18` (feat)
2. **Task 2: Create resource cleanup manager with signal handlers** - `08b92f4` (feat)
3. **Task 3: Create browser preview with temporary file management** - `54ac094` (feat)

## Files Created/Modified
- `src/utils/html-gen.ts` - Generates HTML with base64-embedded images on dark background with responsive styling
- `src/utils/cleanup.ts` - CleanupManager singleton with signal handlers and Promise.allSettled cleanup coordination
- `src/workflows/preview.ts` - Opens browser preview using pathToFileURL, returns temp directory for caller cleanup
- `package.json` - Added open package for cross-platform browser launching
- `package-lock.json` - Dependency lock file updates

## Decisions Made

1. **Base64 data URLs vs file:// protocol:** Used data URLs to avoid browser CORS/security restrictions on file:// protocol. Research (RESEARCH.md lines 144-173) confirmed this approach works universally across browsers.

2. **pathToFileURL for file path encoding:** Used Node's pathToFileURL instead of manual `file://${path}` construction to properly handle special characters (#, %, spaces). Manual construction breaks with these characters (Research pitfall 7, lines 491-507).

3. **Caller-managed cleanup timing:** Return temp directory path instead of immediate cleanup. Browser needs HTML file to remain until page loads. Premature cleanup causes "file not found" errors (Research pitfall 2, lines 362-378).

4. **Promise.allSettled for cleanup coordination:** Ensures all cleanup operations attempt even if some fail. Alternative Promise.all would stop at first failure, leaking resources.

5. **Standard signal exit codes:** SIGINT exits with 130, SIGTERM with 143, following Unix conventions for proper shell integration.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added open package dependency**
- **Found during:** Task 3 (Create browser preview)
- **Issue:** open package not installed, required for cross-platform browser launching
- **Fix:** Ran `npm install open` to add dependency
- **Files modified:** package.json, package-lock.json
- **Verification:** Browser launch test succeeded
- **Committed in:** 54ac094 (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking - missing dependency)
**Impact on plan:** Essential dependency for browser preview functionality. No scope creep.

## Issues Encountered

None - all tasks executed as planned after dependency installation.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Preview infrastructure complete and verified:
- HTML generation tested with base64 data URL validation
- Cleanup manager tested with multiple cleanup function registration
- Browser preview tested with real image display (1x1 test pixel)
- TypeScript compilation passes without errors

Ready for Plan 02 (main orchestrator) to integrate:
- Import `showPreview` from `./workflows/preview.js`
- Import `cleanupManager` from `./utils/cleanup.js`
- Register temp directory cleanup after user approval/rejection
- Signal handlers already active for Ctrl+C cleanup

## Self-Check: PASSED

All files and commits verified:
- FOUND: src/utils/html-gen.ts
- FOUND: src/utils/cleanup.ts
- FOUND: src/workflows/preview.ts
- FOUND: d149b18 (Task 1 commit)
- FOUND: 08b92f4 (Task 2 commit)
- FOUND: 54ac094 (Task 3 commit)

---
*Phase: 02-workflow-orchestration*
*Completed: 2026-02-22*
