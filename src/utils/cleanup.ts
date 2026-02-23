/**
 * Resource cleanup manager with signal handlers.
 *
 * Ensures temporary resources are cleaned up on all exit paths,
 * including user interruption (Ctrl+C) and termination signals.
 */

type CleanupFunction = () => Promise<void>;

/**
 * Manages cleanup operations with automatic signal handling.
 *
 * Registers cleanup functions and ensures they're called on:
 * - Manual cleanup() invocation
 * - SIGINT (Ctrl+C)
 * - SIGTERM (process termination)
 *
 * Uses Promise.allSettled to attempt all cleanups even if some fail.
 */
export class CleanupManager {
  private cleanups: CleanupFunction[] = [];
  private isCleaningUp = false;

  constructor() {
    // Register signal handlers once in constructor
    this.setupSignalHandlers();
  }

  /**
   * Register a cleanup function to be called on exit.
   *
   * @param cleanup - Async function to call during cleanup
   *
   * @example
   * cleanupManager.register(async () => {
   *   await rm(tempDir, { recursive: true, force: true });
   * });
   */
  register(cleanup: CleanupFunction): void {
    this.cleanups.push(cleanup);
  }

  /**
   * Execute all registered cleanup functions.
   *
   * Uses Promise.allSettled to ensure all cleanups are attempted
   * even if some fail. Logs failures for debugging.
   */
  async cleanup(): Promise<void> {
    if (this.isCleaningUp) {
      return; // Prevent recursive cleanup
    }

    this.isCleaningUp = true;

    const results = await Promise.allSettled(
      this.cleanups.map(fn => fn())
    );

    // Log any cleanup failures
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.warn(`Cleanup function ${index} failed:`, result.reason);
      }
    });

    // Clear cleanup array after execution
    this.cleanups = [];
    this.isCleaningUp = false;
  }

  /**
   * Setup signal handlers for SIGINT and SIGTERM.
   * Called once in constructor.
   */
  private setupSignalHandlers(): void {
    // Handle Ctrl+C (SIGINT)
    process.on('SIGINT', async () => {
      console.log('\nReceived SIGINT, cleaning up...');
      await this.cleanup();
      process.exit(130); // Standard exit code for SIGINT
    });

    // Handle termination signal (SIGTERM)
    process.on('SIGTERM', async () => {
      console.log('\nReceived SIGTERM, cleaning up...');
      await this.cleanup();
      process.exit(143); // Standard exit code for SIGTERM
    });
  }
}

/**
 * Singleton cleanup manager instance.
 *
 * Use this throughout the application to register cleanup operations.
 *
 * @example
 * import { cleanupManager } from './utils/cleanup.js';
 *
 * const tempDir = await mkdtemp(join(tmpdir(), 'vroom-'));
 * cleanupManager.register(async () => {
 *   await rm(tempDir, { recursive: true, force: true });
 * });
 */
export const cleanupManager = new CleanupManager();
