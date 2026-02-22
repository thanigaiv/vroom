// Platform-specific utilities for macOS Zoom integration
// Provides standard paths for Zoom app and data directories

import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * Get the user's home directory
 * Uses os.homedir() to avoid tilde expansion issues (Node.js doesn't expand ~)
 */
export function getHomeDir(): string {
  return homedir();
}

/**
 * Get the standard macOS Zoom application path
 * Zoom installs to /Applications/zoom.us.app by default
 */
export function getZoomAppPath(): string {
  return '/Applications/zoom.us.app';
}

/**
 * Get the Zoom data directory path
 * This directory is created after first Zoom login and contains user data
 * including virtual background configurations
 */
export function getZoomDataDir(): string {
  return join(getHomeDir(), 'Library', 'Application Support', 'zoom.us', 'data');
}
