/**
 * AI service factory for instantiating AI providers
 * Centralizes service creation logic for easy provider additions
 */

import type { AIServiceAdapter } from './types.js';
import HuggingFaceService from './huggingface.js';
import { OpenAIService } from './openai.js';
import { StabilityService } from './stability.js';
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

    case 'stability':
      // Required API key
      const stabilityKey = apiKey || configService.getApiKey('stability');
      if (!stabilityKey) {
        throw new Error(
          'Stability AI API key required. Set via: zoombg config set stabilityApiKey YOUR_KEY'
        );
      }
      return new StabilityService(stabilityKey);

    default:
      throw new Error(`Unsupported AI service: ${service}`);
  }
}
