/**
 * OpenAI DALL-E 3 service implementation
 * Requires API key for all operations
 */

import OpenAI from 'openai';
import type { AIServiceAdapter, GenerationResult } from './types.js';
import { AIServiceError } from '../errors.js';

/**
 * OpenAIService implements AIServiceAdapter for OpenAI DALL-E 3
 * Paid service requiring API key
 */
export class OpenAIService implements AIServiceAdapter {
  private client: OpenAI;

  /**
   * Create OpenAI service
   * @param apiKey OpenAI API key (required)
   */
  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  getServiceName(): string {
    return 'OpenAI';
  }

  requiresApiKey(): boolean {
    // DALL-E 3 requires API key
    return true;
  }

  getTimeout(): number {
    // 60 seconds - faster than Hugging Face free tier
    return 60000;
  }

  async generateImage(prompt: string): Promise<GenerationResult> {
    try {
      // Use DALL-E 3 with b64_json response format to avoid CORS issues
      const response = await this.client.images.generate({
        model: 'dall-e-3',
        prompt: prompt,
        n: 1, // DALL-E 3 only supports single image
        size: '1024x1024', // Standard square format for Zoom backgrounds
        response_format: 'b64_json' // Base64 encoding - no CORS issues
      });

      // Extract base64 data from response
      if (!response.data || response.data.length === 0) {
        throw new Error('No image data returned from OpenAI');
      }

      const imageData = response.data[0];
      if (!imageData.b64_json) {
        throw new Error('No image data returned from OpenAI');
      }

      // Convert base64 to Buffer
      const buffer = Buffer.from(imageData.b64_json, 'base64');

      return {
        buffer,
        contentType: 'image/png',
        service: 'OpenAI'
      };
    } catch (error: any) {
      // Translate API errors to user-friendly messages
      const errorMessage = error?.message || String(error);
      const statusCode = error?.status || error?.response?.status;

      // 401: Invalid API key
      if (statusCode === 401 || errorMessage.toLowerCase().includes('unauthorized')) {
        throw new AIServiceError(
          'OpenAI',
          errorMessage,
          'Invalid OpenAI API key. Get your API key from https://platform.openai.com/api-keys'
        );
      }

      // 429: Rate limit exceeded
      if (statusCode === 429 || errorMessage.toLowerCase().includes('rate limit')) {
        throw new AIServiceError(
          'OpenAI',
          errorMessage,
          'Rate limit exceeded. Wait a few moments or check your OpenAI billing at https://platform.openai.com/account/billing'
        );
      }

      // 400 with content policy violation
      if (
        (statusCode === 400 || errorMessage.includes('400')) &&
        (errorMessage.toLowerCase().includes('content_policy') ||
          errorMessage.toLowerCase().includes('content policy'))
      ) {
        throw new AIServiceError(
          'OpenAI',
          errorMessage,
          'Your prompt violates OpenAI content policy. Try rephrasing to avoid explicit or harmful content.'
        );
      }

      // Generic error
      throw new AIServiceError(
        'OpenAI',
        errorMessage,
        `Failed to generate image with OpenAI: ${errorMessage}`
      );
    }
  }
}
