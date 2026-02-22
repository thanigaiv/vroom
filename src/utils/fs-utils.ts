/**
 * File system utilities with atomic write support
 * Prevents corruption if process crashes during write
 */

import { writeFile, rename, unlink } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { randomBytes } from 'node:crypto';

/**
 * Atomically write data to a file using temp-then-rename pattern
 *
 * POSIX guarantees rename() is atomic, preventing corruption if
 * process crashes mid-write. Used for saving images to Zoom directory.
 *
 * @param filePath Target file path
 * @param data Content to write (string or Buffer)
 * @param mode File permissions (default: 0o644 = rw-r--r--)
 */
export async function atomicWriteFile(
  filePath: string,
  data: string | Buffer,
  mode: number = 0o644
): Promise<void> {
  // Generate temp file path in same directory (same filesystem = atomic rename)
  const tempPath = join(
    dirname(filePath),
    `.${randomBytes(8).toString('hex')}.tmp`
  );

  try {
    // Write to temp file with specified permissions
    await writeFile(tempPath, data, { mode });

    // Atomically rename temp to final (POSIX guarantees atomicity)
    await rename(tempPath, filePath);
  } catch (error) {
    // Cleanup: attempt to remove temp file (ignore errors)
    try {
      await unlink(tempPath);
    } catch {
      // Ignore cleanup errors - temp file will be left but won't interfere
    }

    // Re-throw original error
    throw error;
  }
}
