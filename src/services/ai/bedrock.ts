/**
 * Amazon Bedrock service implementation
 * Supports Nova Canvas, Titan Image Generator, and Stable Diffusion 3.5 Large
 * Requires AWS IAM credentials for all operations
 */

import {
  BedrockRuntimeClient,
  InvokeModelCommand
} from '@aws-sdk/client-bedrock-runtime';
import type { AIServiceAdapter, GenerationResult } from './types.js';
import { AIServiceError } from '../errors.js';

/**
 * BedrockService implements AIServiceAdapter for Amazon Bedrock
 * Paid service requiring AWS IAM credentials (access key + secret key)
 */
export class BedrockService implements AIServiceAdapter {
  private client: BedrockRuntimeClient;
  private modelId: string;

  /**
   * Create Bedrock service
   * @param accessKeyId AWS access key ID (required)
   * @param secretAccessKey AWS secret access key (required)
   * @param region AWS region (defaults to us-east-1)
   * @param modelId Bedrock model ID (defaults to amazon.nova-canvas-v1:0)
   */
  constructor(
    accessKeyId: string,
    secretAccessKey: string,
    region: string = 'us-east-1',
    modelId: string = 'amazon.nova-canvas-v1:0'
  ) {
    this.modelId = modelId;
    this.client = new BedrockRuntimeClient({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey
      },
      maxAttempts: 3 // SDK-level retries
    });
  }

  getServiceName(): string {
    return 'Bedrock';
  }

  requiresApiKey(): boolean {
    // Bedrock requires AWS IAM credentials
    return true;
  }

  getTimeout(): number {
    // 90 seconds - image generation can take time
    return 90000;
  }

  async generateImage(prompt: string): Promise<GenerationResult> {
    try {
      // Build payload for Nova Canvas model
      const payload = {
        taskType: 'TEXT_IMAGE',
        textToImageParams: {
          text: prompt
        },
        imageGenerationConfig: {
          seed: Math.floor(Math.random() * 858993460),
          quality: 'standard'
        }
      };

      // Send InvokeModelCommand
      const command = new InvokeModelCommand({
        modelId: this.modelId,
        body: JSON.stringify(payload),
        contentType: 'application/json',
        accept: 'application/json'
      });

      const response = await this.client.send(command);

      // Decode response body
      if (!response.body) {
        throw new Error('No response body returned from Bedrock');
      }

      const responseText = new TextDecoder().decode(response.body);
      const responseBody = JSON.parse(responseText);

      // Extract base64 image
      if (!responseBody.images || responseBody.images.length === 0) {
        throw new Error('No image data returned from Bedrock');
      }

      const base64Image = responseBody.images[0];

      // Convert to Buffer
      const buffer = Buffer.from(base64Image, 'base64');

      return {
        buffer,
        contentType: 'image/png',
        service: 'Bedrock'
      };
    } catch (error: any) {
      // Translate AWS SDK errors to user-friendly messages
      const errorMessage = error?.message || String(error);
      const errorName = error?.name || '';
      const statusCode = error?.$metadata?.httpStatusCode;

      // AccessDeniedException (403): IAM permissions issue
      if (errorName === 'AccessDeniedException' || statusCode === 403) {
        throw new AIServiceError(
          'Bedrock',
          errorMessage,
          'Access denied. Check your AWS IAM permissions for Bedrock. Ensure your IAM user/role has the "bedrock:InvokeModel" permission.'
        );
      }

      // ThrottlingException (429): Rate limit exceeded
      if (errorName === 'ThrottlingException' || statusCode === 429) {
        throw new AIServiceError(
          'Bedrock',
          errorMessage,
          'Rate limit exceeded. You can request a quota increase at https://console.aws.amazon.com/servicequotas'
        );
      }

      // ValidationException (400): Invalid parameters
      if (errorName === 'ValidationException' || statusCode === 400) {
        throw new AIServiceError(
          'Bedrock',
          errorMessage,
          'Invalid request parameters. Check your prompt length and model configuration.'
        );
      }

      // ModelTimeoutException (408): Timeout
      if (errorName === 'ModelTimeoutException' || statusCode === 408) {
        throw new AIServiceError(
          'Bedrock',
          errorMessage,
          'Model request timed out. Try again or consider using a different model.'
        );
      }

      // ModelNotReadyException: Model is still loading
      if (errorName === 'ModelNotReadyException') {
        throw new AIServiceError(
          'Bedrock',
          errorMessage,
          'Model is not ready yet. This is usually temporary - try again in a few moments.'
        );
      }

      // ResourceNotFoundException: Model doesn't exist in region
      if (errorName === 'ResourceNotFoundException' || statusCode === 404) {
        throw new AIServiceError(
          'Bedrock',
          errorMessage,
          `Model "${this.modelId}" not found in this region. Check that the model is available in your configured region.`
        );
      }

      // ServiceQuotaExceededException: Quota exceeded
      if (errorName === 'ServiceQuotaExceededException') {
        throw new AIServiceError(
          'Bedrock',
          errorMessage,
          'Service quota exceeded. Request a quota increase at https://console.aws.amazon.com/servicequotas'
        );
      }

      // Generic error
      throw new AIServiceError(
        'Bedrock',
        errorMessage,
        `Failed to generate image with Bedrock: ${errorMessage}`
      );
    }
  }
}
