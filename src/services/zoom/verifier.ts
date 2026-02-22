/**
 * Zoom verification service
 * Checks Zoom installation and login state before attempting operations
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { getZoomAppPath, getZoomDataDir } from '../../utils/platform.js';
import { ZoomNotInstalledError, ZoomNotLoggedInError } from '../errors.js';

/**
 * ZoomVerifier class provides methods to check Zoom prerequisites
 */
export class ZoomVerifier {
  /**
   * Check if Zoom app is installed on macOS
   * Verifies both app bundle AND executable to avoid false positives from incomplete installations
   * @returns true if Zoom is installed, false otherwise
   */
  isInstalled(): boolean {
    const appPath = getZoomAppPath();
    const executablePath = join(appPath, 'Contents', 'MacOS', 'zoom.us');

    // Check both app bundle and executable exist
    return existsSync(appPath) && existsSync(executablePath);
  }

  /**
   * Check if user has logged into Zoom
   * Data directory only exists after first login
   * @returns true if user is logged in, false otherwise
   */
  isLoggedIn(): boolean {
    const dataDir = getZoomDataDir();
    return existsSync(dataDir);
  }

  /**
   * Verify all Zoom prerequisites are met
   * Throws specific errors if requirements are not met
   * @throws {ZoomNotInstalledError} if Zoom app is not installed
   * @throws {ZoomNotLoggedInError} if user has not logged into Zoom
   */
  verify(): void {
    if (!this.isInstalled()) {
      throw new ZoomNotInstalledError();
    }

    if (!this.isLoggedIn()) {
      throw new ZoomNotLoggedInError();
    }
  }
}

export default ZoomVerifier;
