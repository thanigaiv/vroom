/**
 * AI service adapter interfaces for image generation
 * Implements Strategy pattern to enable multiple AI providers
 */

/**
 * Request payload for image generation
 */
export interface GenerationRequest {
  /** User's text description of desired image */
  prompt: string;
  /** Optional service override (defaults to configured service) */
  service?: string;
}

/**
 * Result from image generation
 */
export interface GenerationResult {
  /** Image data ready to write to disk */
  buffer: Buffer;
  /** MIME type (e.g., 'image/png', 'image/jpeg') */
  contentType: string;
  /** Which service generated this image */
  service: string;
}

/**
 * AI service adapter interface (Strategy pattern)
 * Each provider implements this interface enabling zero-orchestration-change
 * provider additions in Phase 4
 */
export interface AIServiceAdapter {
  /**
   * Generate image from text prompt
   * @param prompt User's text description
   * @returns Generated image as Buffer with metadata
   * @throws AIServiceError with user-friendly message on failure
   */
  generateImage(prompt: string): Promise<GenerationResult>;

  /**
   * Get service name for display and logging
   */
  getServiceName(): string;

  /**
   * Whether this service requires an API key to function
   */
  requiresApiKey(): boolean;

  /**
   * Service-specific timeout in milliseconds
   * Free tier services may need longer timeouts
   */
  getTimeout(): number;
}
