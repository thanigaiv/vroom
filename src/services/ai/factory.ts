/**
 * AI service factory for instantiating AI providers
 * Centralizes service creation logic for easy provider additions
 */

import type { AIServiceAdapter } from './types.js';
import HuggingFaceService from './huggingface.js';
import type { AIService } from '../../types/index.js';

/**
 * Create an AI service adapter based on service type
 * @param service Service name ('huggingface', 'openai', 'stability')
 * @param apiKey Optional API key for the service
 * @returns AIServiceAdapter instance
 * @throws Error if service is not supported
 */
export function createAIService(service: AIService, apiKey?: string): AIServiceAdapter {
  switch (service) {
    case 'huggingface':
      return new HuggingFaceService(apiKey);
    
    // Phase 4: Add DALL-E and Stability AI cases here
    // case 'openai':
    //   return new OpenAIService(apiKey);
    // case 'stability':
    //   return new StabilityService(apiKey);
    
    default:
      throw new Error(`Unsupported AI service: ${service}`);
  }
}
