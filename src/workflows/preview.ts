/**
 * Browser preview workflow for generated images.
 *
 * Opens images in browser using temporary HTML files with base64 data URLs.
 * Returns temp directory path for caller-managed cleanup after user approval/rejection.
 */

import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import open from 'open';
import { generatePreviewHTML } from '../utils/html-gen.js';

/**
 * Display image in browser and return temp directory path.
 *
 * Creates temporary directory with HTML preview file, opens in default browser.
 * Caller is responsible for cleanup after user interaction.
 *
 * @param imageBuffer - PNG image buffer to preview
 * @returns Path to temporary directory (for cleanup after user approval/rejection)
 *
 * @throws If temp directory creation, file write, or browser open fails
 *
 * @example
 * const tempDir = await showPreview(imageBuffer);
 * // ... wait for user approval/rejection ...
 * await rm(tempDir, { recursive: true, force: true });
 *
 * @example With cleanup manager
 * const tempDir = await showPreview(imageBuffer);
 * cleanupManager.register(async () => {
 *   await rm(tempDir, { recursive: true, force: true });
 * });
 */
export async function showPreview(imageBuffer: Buffer): Promise<string> {
  let tempDir: string | undefined;

  try {
    // Create unique temp directory with vroom- prefix
    tempDir = await mkdtemp(join(tmpdir(), 'vroom-'));

    // Generate HTML with embedded base64 image
    const html = generatePreviewHTML(imageBuffer);

    // Write HTML file to temp directory
    const htmlPath = join(tempDir, 'preview.html');
    await writeFile(htmlPath, html, 'utf8');

    // Convert file path to proper file:// URL (handles special characters)
    const fileUrl = pathToFileURL(htmlPath).href;

    // Open in browser (default wait:false, doesn't block)
    await open(fileUrl);

    // Return temp directory for caller cleanup
    return tempDir;
  } catch (error) {
    // Cleanup temp directory on error
    if (tempDir) {
      try {
        await rm(tempDir, { recursive: true, force: true });
      } catch (cleanupError) {
        console.warn('Failed to cleanup temp directory after error:', cleanupError);
      }
    }

    throw error;
  }
}
