/**
 * Shared TypeScript type definitions for Vroom
 */

/**
 * Configuration schema matching conf library setup
 */
export interface Config {
  huggingfaceApiKey?: string;
  openaiApiKey?: string;
  stabilityApiKey?: string;
  gleanApiKey?: string;
  gleanInstance?: string;
  awsAccessKeyId?: string;
  awsSecretAccessKey?: string;
  awsRegion?: string;
  bedrockModelId?: string;
  lastUsedService: string;
}

/**
 * Supported AI service providers
 */
export type AIService = 'huggingface' | 'openai' | 'stability' | 'glean' | 'bedrock';
