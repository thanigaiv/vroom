/**
 * Custom error types for ZoomBG with user-friendly messages
 */

/**
 * Base error class for all ZoomBG errors
 * Includes both technical message (for logs) and userMessage (for display)
 */
export class ZoomBGError extends Error {
  userMessage: string;

  constructor(message: string, userMessage: string) {
    super(message);
    this.name = this.constructor.name;
    this.userMessage = userMessage;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Thrown when config file permissions cannot be set to 0600
 */
export class ConfigPermissionError extends ZoomBGError {
  constructor(path: string, originalError?: Error) {
    super(
      `Failed to set config file permissions: ${originalError?.message}`,
      `Could not secure configuration file at ${path}. Please check file permissions.`
    );
  }
}

/**
 * Thrown when Zoom app is not installed
 */
export class ZoomNotInstalledError extends ZoomBGError {
  constructor() {
    super(
      'Zoom app not found at /Applications/zoom.us.app',
      'Zoom is not installed. Please install Zoom from https://zoom.us/download and try again.'
    );
  }
}

/**
 * Thrown when user has not logged into Zoom
 */
export class ZoomNotLoggedInError extends ZoomBGError {
  constructor() {
    super(
      'Zoom data directory not found - user has not logged in',
      'Please open Zoom and sign in before using this tool.'
    );
  }
}

/**
 * Thrown when AI service encounters an error
 */
export class AIServiceError extends ZoomBGError {
  constructor(service: string, message: string, userMessage?: string) {
    super(
      `${service} error: ${message}`,
      userMessage || `AI service error: ${message}`
    );
  }
}
