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

/**
 * Thrown when network errors occur during operations
 * Translates Node.js error codes to user-actionable messages
 */
export class NetworkError extends ZoomBGError {
  code: string;

  constructor(code: string, operation: string, originalError?: Error) {
    const userMessages: Record<string, string> = {
      'ETIMEDOUT': `Network timeout while ${operation}. Check your internet connection and try again.`,
      'ECONNREFUSED': `Connection refused while ${operation}. The service may be temporarily unavailable.`,
      'ENOTFOUND': `DNS lookup failed while ${operation}. Check your internet connection.`,
      'ECONNRESET': `Connection reset while ${operation}. The service may be experiencing issues.`,
      'EAI_AGAIN': `DNS lookup timeout while ${operation}. Check your DNS settings.`,
    };

    const userMessage = userMessages[code] ||
      `Network error (${code}) while ${operation}. Please try again.`;

    super(
      `Network error ${code}: ${originalError?.message}`,
      userMessage
    );
    this.code = code;
  }
}

/**
 * Thrown when operation times out
 */
export class TimeoutError extends ZoomBGError {
  constructor(operation: string, timeoutMs: number) {
    super(
      `Operation timed out after ${timeoutMs}ms`,
      `${operation} took longer than ${timeoutMs / 1000} seconds. Try a simpler prompt or check your network connection.`
    );
  }
}

/**
 * Thrown when rate limit is exceeded
 */
export class RateLimitError extends ZoomBGError {
  retryAfter?: number;

  constructor(service: string, retryAfter?: number) {
    const retryMessage = retryAfter
      ? `Rate limit will reset in ${retryAfter} seconds.`
      : 'Please wait a few minutes before trying again.';

    super(
      `Rate limit exceeded for ${service}`,
      `You've exceeded the rate limit for ${service}. ${retryMessage}`
    );
    this.retryAfter = retryAfter;
  }
}
