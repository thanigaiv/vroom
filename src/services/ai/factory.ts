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
import { NetworkError, TimeoutError, RateLimitError } from '../errors.js';

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

/**
 * Service-specific timeout values (ms)
 * From Phase 04-02 decisions: HuggingFace 120s, OpenAI 60s, Stability 90s
 */
const SERVICE_TIMEOUTS: Record<string, number> = {
  huggingface: 120000,  // 120 seconds (free tier is slow)
  openai: 60000,        // 60 seconds
  stability: 90000      // 90 seconds
};

/**
 * Wrap promise with timeout enforcement
 */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operation: string
): Promise<T> {
  let timeoutHandle: NodeJS.Timeout;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new TimeoutError(operation, timeoutMs));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutHandle!);
  }
}

/**
 * Retry transient errors with exponential backoff
 * Retries: 429 (rate limit), 500 (server error), 503 (unavailable), ETIMEDOUT, ECONNREFUSED
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 2,
  initialDelayMs: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Don't retry on last attempt
      if (attempt === maxRetries) {
        break;
      }

      const statusCode = error?.status || error?.response?.status;

      // Permanent errors - don't retry
      if (statusCode === 401 || statusCode === 400 || statusCode === 403) {
        throw error;
      }

      // Check for transient errors
      const isTransient =
        statusCode === 429 ||  // Rate limit
        statusCode === 500 ||  // Server error
        statusCode === 503 ||  // Service unavailable
        statusCode === 502 ||  // Bad gateway
        ['ETIMEDOUT', 'ECONNREFUSED', 'ECONNRESET'].includes(error.code);

      if (!isTransient) {
        throw error;  // Unknown error, don't retry
      }

      // Transient error - retry with exponential backoff
      const delay = initialDelayMs * Math.pow(2, attempt);
      const jitter = Math.random() * 0.3 * delay;  // Add 0-30% jitter
      const totalDelay = Math.floor(delay + jitter);

      console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${totalDelay}ms...`);
      await new Promise(resolve => setTimeout(resolve, totalDelay));
    }
  }

  // All retries exhausted
  throw lastError!;
}

/**
 * Enhanced createAIService wrapper with timeout and retry
 */
export function createAIServiceWithResilience(serviceName: string): AIServiceAdapter {
  const service = createAIService(serviceName as AIService);  // Use existing factory
  const timeout = SERVICE_TIMEOUTS[serviceName] || 90000;

  // Wrap generateImage method with timeout and retry
  const originalGenerate = service.generateImage.bind(service);

  return {
    ...service,
    generateImage: async (prompt: string) => {
      try {
        return await withRetry(
          () => withTimeout(
            originalGenerate(prompt),
            timeout,
            'generating image'
          )
        );
      } catch (error: any) {
        // Translate network errors
        if (error.code && ['ETIMEDOUT', 'ECONNREFUSED', 'ENOTFOUND', 'ECONNRESET'].includes(error.code)) {
          throw new NetworkError(error.code, 'generating image', error);
        }

        // Translate rate limit errors
        const statusCode = error?.status || error?.response?.status;
        if (statusCode === 429) {
          const retryAfter = error?.response?.headers?.['retry-after'];
          throw new RateLimitError(serviceName, retryAfter ? parseInt(retryAfter) : undefined);
        }

        // Re-throw other errors (AIServiceError, etc.)
        throw error;
      }
    }
  };
}
