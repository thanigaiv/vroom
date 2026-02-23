/**
 * AI service factory for instantiating AI providers
 * Centralizes service creation logic for easy provider additions
 */

import type { AIServiceAdapter } from './types.js';
import HuggingFaceService from './huggingface.js';
import { OpenAIService } from './openai.js';
import type { AIService } from '../../types/index.js';
import { ConfigService } from '../config.js';

/**
 * Create an AI service adapter based on service type
 * @param service Service name ('huggingface', 'openai', 'stability')
 * @param apiKey Optional API key for the service
 * @returns AIServiceAdapter instance
 * @throws Error if service is not supported
 */
export function createAIService(service: AIService, apiKey?: string): AIServiceAdapter {
  const configService = new ConfigService();

  switch (service) {
    case 'huggingface':
      return new HuggingFaceService(apiKey);

    case 'openai':
      // Required API key
      const openaiKey = apiKey || configService.getApiKey('openai');
      if (!openaiKey) {
        throw new Error(
          'OpenAI API key required. Set via: zoombg config set openaiApiKey YOUR_KEY'
        );
      }
      return new OpenAIService(openaiKey);

    // Phase 4 Plan 02: Add Stability AI case here

    default:
      throw new Error(`Unsupported AI service: ${service}`);
  }
}
