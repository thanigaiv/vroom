/**
 * Hugging Face service implementation with free tier support
 * No API key required - uses Hugging Face inference API free tier
 */

import { HfInference } from '@huggingface/inference';
import type { AIServiceAdapter, GenerationResult } from './types.js';
import { AIServiceError } from '../errors.js';

/**
 * HuggingFaceService implements AIServiceAdapter for Hugging Face free tier
 * Uses FLUX.1-schnell model (fast, free)
 */
export class HuggingFaceService implements AIServiceAdapter {
  private client: HfInference;

  /**
   * Create HuggingFace service
   * @param apiKey Optional API key (undefined enables free tier)
   */
  constructor(apiKey?: string) {
    // Passing undefined enables free tier access
    this.client = new HfInference(apiKey);
  }

  getServiceName(): string {
    return 'HuggingFace';
  }

  requiresApiKey(): boolean {
    // Free tier works without key
    return false;
  }

  getTimeout(): number {
    // Conservative timeout for free tier (120 seconds)
    // Free tier can be slow during high load
    return 120000;
  }

  async generateImage(prompt: string): Promise<GenerationResult> {
    try {
      // Use FLUX.1-schnell: fast free model (per RESEARCH.md line 112)
      // textToImage returns a Blob by default with outputType: 'blob'
      const result = await this.client.textToImage({
        model: 'black-forest-labs/FLUX.1-schnell',
        inputs: prompt
      }, {
        outputType: 'blob'
      }) as Blob;

      // Convert Blob to Buffer for file writing
      const arrayBuffer = await result.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      return {
        buffer,
        contentType: 'image/png',
        service: 'HuggingFace'
      };
    } catch (error: any) {
      // Translate API errors to user-friendly messages
      const errorMessage = error?.message || String(error);

      // Rate limit error (429)
      if (errorMessage.includes('429') || errorMessage.toLowerCase().includes('rate limit')) {
        throw new AIServiceError(
          'HuggingFace',
          errorMessage,
          'Rate limit reached. Wait 60 seconds and try again, or provide an API key for higher limits.'
        );
      }

      // Content policy violation (400)
      if (errorMessage.includes('400') || errorMessage.toLowerCase().includes('content policy')) {
        throw new AIServiceError(
          'HuggingFace',
          errorMessage,
          'Your prompt may violate content policy. Try rephrasing to avoid explicit, violent, or copyrighted content.'
        );
      }

      // Generic error
      throw new AIServiceError(
        'HuggingFace',
        errorMessage,
        `Failed to generate image: ${errorMessage}`
      );
    }
  }
}

export default HuggingFaceService;
