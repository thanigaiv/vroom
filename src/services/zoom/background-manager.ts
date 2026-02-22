/**
 * Zoom background manager with dynamic directory discovery
 * Handles finding the Zoom backgrounds directory across different Zoom versions
 */

import { glob } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { getZoomDataDir } from '../../utils/platform.js';
import { ZoomNotLoggedInError } from '../errors.js';

/**
 * BackgroundManager class provides dynamic discovery of Zoom backgrounds directory
 * Zoom has changed directory names across versions, so we search multiple patterns
 */
export class BackgroundManager {
  /**
   * Known directory names from different Zoom versions
   * Checked in order (fast path) before falling back to glob search
   */
  private readonly searchPaths = [
    'VirtualBkgnd_Custom',
    'VirtualBackground_Custom',
    'Backgrounds',
    'CustomBackgrounds',
  ];

  /**
   * Find the Zoom virtual backgrounds directory using multiple search strategies
   * 1. Fast path: Check known directory names
   * 2. Fallback: Use glob to search recursively for Virtual*Custom* patterns
   *
   * @returns The full path to the backgrounds directory
   * @throws {ZoomNotLoggedInError} if Zoom data directory doesn't exist
   * @throws {Error} if no backgrounds directory can be found
   */
  async findBackgroundsDirectory(): Promise<string> {
    const baseDir = getZoomDataDir();

    // Check if Zoom data directory exists (indicates user is logged in)
    if (!existsSync(baseDir)) {
      throw new ZoomNotLoggedInError();
    }

    // Fast path: Try known directory names first
    for (const dirName of this.searchPaths) {
      const fullPath = join(baseDir, dirName);
      if (existsSync(fullPath)) {
        return fullPath;
      }
    }

    // Fallback: Search recursively for any Virtual*Custom directory
    const pattern = join(baseDir, '**/*Virtual*Custom*');
    const matches = [];

    for await (const entry of glob(pattern, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        // Reconstruct full path from entry
        const fullPath = join(entry.parentPath || baseDir, entry.name);
        matches.push(fullPath);
      }
    }

    if (matches.length > 0) {
      return matches[0]; // Return first match
    }

    // No matches found - provide helpful error message
    throw new Error(
      `Could not find Zoom virtual backgrounds directory. Searched in: ${baseDir}\n` +
      `Expected one of: ${this.searchPaths.join(', ')}\n` +
      `This may indicate a new Zoom version with a different directory structure.`
    );
  }
}

export default BackgroundManager;
