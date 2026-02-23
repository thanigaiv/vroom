/**
 * Glean image generation service implementation
 * Requires API token and instance name
 */

import { Glean } from '@gleanwork/api-client';
import https from 'node:https';
import type { AIServiceAdapter, GenerationResult } from './types.js';
import { AIServiceError } from '../errors.js';

/**
 * GleanService implements AIServiceAdapter for Glean's image generation
 * Uses Glean Assistant's image generation capability via Client API
 */
export class GleanService implements AIServiceAdapter {
  private client: Glean;
  private instance: string;

  /**
   * Create Glean service
   * @param apiToken Glean API token (required)
   * @param instance Glean instance name (required, e.g., "company-name")
   */
  constructor(apiToken: string, instance: string) {
    this.instance = instance;
    this.client = new Glean({
      apiToken,
      instance
    });
  }

  getServiceName(): string {
    return 'Glean';
  }

  requiresApiKey(): boolean {
    return true;
  }

  getTimeout(): number {
    // 60 seconds - image generation can take some time
    return 60000;
  }

  async generateImage(prompt: string): Promise<GenerationResult> {
    try {
      // Call Glean Chat API with image generation enabled
      const response = await this.client.client.chat.create({
        messages: [
          {
            fragments: [{ text: prompt }]
          }
        ],
        agentConfig: {
          agent: 'AUTO', // Let Glean choose best agent
          useImageGeneration: true // Enable image generation
        }
      });

      // Extract image URL from response fragments
      let imageUrl: string | undefined;
      for (const message of response.messages || []) {
        for (const fragment of message.fragments || []) {
          if (fragment.file?.url) {
            imageUrl = fragment.file.url;
            break;
          }
        }
        if (imageUrl) break;
      }

      if (!imageUrl) {
        throw new Error('No image generated in response');
      }

      // Download image from URL
      const buffer = await this.downloadImage(imageUrl);

      return {
        buffer,
        contentType: 'image/png',
        service: 'Glean'
      };
    } catch (error: any) {
      // Translate API errors to user-friendly messages
      const errorMessage = error?.message || String(error);
      const statusCode = error?.statusCode || error?.response?.status;

      // 401: Invalid API token
      if (statusCode === 401 || errorMessage.toLowerCase().includes('unauthorized')) {
        throw new AIServiceError(
          'Glean',
          errorMessage,
          `Invalid Glean API token. Get your token from your Glean admin console at https://${this.instance}.glean.com/admin`
        );
      }

      // 403: Insufficient permissions
      if (statusCode === 403 || errorMessage.toLowerCase().includes('forbidden')) {
        throw new AIServiceError(
          'Glean',
          errorMessage,
          'Insufficient permissions. Ensure your API token has image generation access and the feature is enabled for your instance.'
        );
      }

      // 429: Rate limit exceeded
      if (statusCode === 429 || errorMessage.toLowerCase().includes('rate limit')) {
        throw new AIServiceError(
          'Glean',
          errorMessage,
          'Rate limit exceeded. Wait a few moments and try again.'
        );
      }

      // Generic error
      throw new AIServiceError(
        'Glean',
        errorMessage,
        `Failed to generate image with Glean: ${errorMessage}`
      );
    }
  }

  /**
   * Download image from URL and return as Buffer
   * @param url Image URL from Glean response
   * @returns Buffer containing image data
   */
  private downloadImage(url: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      https.get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download image: HTTP ${response.statusCode}`));
          return;
        }

        const chunks: Buffer[] = [];

        response.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });

        response.on('end', () => {
          resolve(Buffer.concat(chunks));
        });

        response.on('error', (error) => {
          reject(error);
        });
      }).on('error', (error) => {
        reject(error);
      });
    });
  }
}
