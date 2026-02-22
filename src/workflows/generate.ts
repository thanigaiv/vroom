/**
 * Complete workflow orchestrator for generating Zoom backgrounds.
 *
 * Implements iterative generate→preview→approve→save flow with:
 * - Interactive CLI prompts for user input and decisions
 * - Progress spinners during AI generation
 * - Browser preview after generation
 * - Approval/rejection loop with prompt refinement
 * - Save to Zoom backgrounds directory
 * - Comprehensive resource cleanup
 */

import { confirm, input } from '@inquirer/prompts';
import { writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import ora from 'ora';
import { createAIService } from '../services/ai/factory.js';
import { BackgroundManager } from '../services/zoom/background-manager.js';
import { ZoomVerifier } from '../services/zoom/verifier.js';
import { showPreview } from './preview.js';
import { cleanupManager } from '../utils/cleanup.js';

/**
 * Options for the workflow.
 */
export interface WorkflowOptions {
  initialPrompt?: string;
  service?: string;
  interactive?: boolean;
}

/**
 * Main workflow: prompt → generate → preview → approve → save.
 *
 * Runs iterative loop allowing user to:
 * - Generate image from text prompt
 * - Preview in browser
 * - Approve to save or reject to regenerate
 * - Modify prompt and try again
 * - Cancel at any point
 *
 * @param options - Workflow configuration options
 * @throws {ZoomNotInstalledError} if Zoom is not installed
 * @throws {ZoomNotLoggedInError} if Zoom is not logged in
 * @throws {AIServiceError} if image generation fails
 *
 * @example
 * // Run complete workflow
 * await generateWorkflow();
 *
 * @example
 * // Run with initial prompt
 * await generateWorkflow({ initialPrompt: 'mountain sunset' });
 *
 * @example
 * // Run with specific service
 * await generateWorkflow({ service: 'openai' });
 */
export async function generateWorkflow(options: WorkflowOptions = {}): Promise<void> {
  const {
    initialPrompt,
    service = 'huggingface',
    interactive = true
  } = options;
  // Verify Zoom prerequisites (fail fast before generation)
  const verifier = new ZoomVerifier();
  await verifier.verify(); // Throws ZoomNotInstalledError or ZoomNotLoggedInError

  let approved = false;
  let currentPrompt: string;

  // Get initial prompt (from options or interactive prompt)
  if (initialPrompt) {
    currentPrompt = initialPrompt;
  } else if (interactive) {
    currentPrompt = await input({
      message: 'Describe the Zoom background you want:',
    });
  } else {
    throw new Error('initialPrompt is required when interactive mode is disabled');
  }

  while (!approved) {
    let tempDir: string | undefined;

    try {
      // Generate with spinner (may take 15-90 seconds on free tier)
      const spinner = ora('Generating image (may take 15-90 seconds)...').start();

      const aiService = createAIService(service as any);
      const result = await aiService.generateImage(currentPrompt);

      // Stop spinner before showing prompt (prevents terminal corruption)
      spinner.succeed('Image generated');

      // Preview in browser (opens automatically)
      tempDir = await showPreview(result.buffer);

      // Register cleanup for signal handlers (Ctrl+C)
      cleanupManager.register(async () => {
        if (tempDir) {
          await rm(tempDir, { recursive: true, force: true });
        }
      });

      // User approval prompt (spinner fully stopped, no overlapping output)
      approved = await confirm({
        message: 'Do you approve this image?',
        default: true,
      });

      if (!approved) {
        // Rejection flow: offer to modify or cancel
        const shouldModify = await confirm({
          message: 'Do you want to modify the prompt and regenerate?',
          default: true,
        });

        if (shouldModify) {
          // Modify prompt (pre-fill with current prompt)
          currentPrompt = await input({
            message: 'Enter new prompt:',
            default: currentPrompt,
          });
        } else {
          // User cancelled - exit workflow
          console.log('Generation cancelled.');
          return;
        }
      } else {
        // Approval flow: save to Zoom backgrounds directory
        const saveSpinner = ora('Saving to Zoom backgrounds...').start();

        const bgManager = new BackgroundManager();
        const bgDir = await bgManager.findBackgroundsDirectory();

        // Generate unique filename with timestamp
        const filename = `zoombg-${Date.now()}.png`;
        const savePath = join(bgDir, filename);

        await writeFile(savePath, result.buffer);

        saveSpinner.succeed(`Saved as ${filename}`);
        console.log(`\nZoom background saved to: ${savePath}`);
      }
    } catch (error) {
      // Propagate errors to caller (CLI will display user-friendly messages)
      console.error('\nError during workflow:', error);
      throw error;
    } finally {
      // Cleanup temp files (browser has loaded base64, safe to delete)
      if (tempDir) {
        await rm(tempDir, { recursive: true, force: true }).catch(() => {
          // Suppress cleanup errors (already handled in cleanupManager)
        });
      }
    }
  }
}
