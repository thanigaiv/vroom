/**
 * Configuration service with secure API key storage
 * Enforces 0600 file permissions for security
 */

import Conf from 'conf';
import { chmod } from 'node:fs/promises';
import type { Config, AIService } from '../types/index.js';
import { ConfigPermissionError } from './errors.js';

const schema = {
  huggingfaceApiKey: {
    type: 'string',
    default: ''
  },
  openaiApiKey: {
    type: 'string',
    default: ''
  },
  stabilityApiKey: {
    type: 'string',
    default: ''
  },
  lastUsedService: {
    type: 'string',
    default: 'huggingface'
  }
} as const;

/**
 * ConfigService manages API key storage with enforced 0600 permissions
 */
export class ConfigService {
  private store: Conf<Config>;

  constructor() {
    this.store = new Conf({
      projectName: 'vroom',
      schema: schema as any
    });

    // CRITICAL: Enforce secure permissions on initialization
    this.enforceSecurePermissions();
  }

  /**
   * Enforce 0600 permissions on config file
   * CRITICAL: Prevents API keys from being world-readable
   */
  private async enforceSecurePermissions(): Promise<void> {
    const configPath = this.store.path;
    try {
      await chmod(configPath, 0o600); // owner read/write only
    } catch (error) {
      throw new ConfigPermissionError(configPath, error as Error);
    }
  }

  /**
   * Get API key for a specific service
   */
  getApiKey(service: AIService): string | undefined {
    const key = `${service}ApiKey` as keyof Config;
    return this.store.get(key) as string | undefined;
  }

  /**
   * Set API key for a specific service and re-enforce permissions
   */
  async setApiKey(service: AIService, apiKey: string): Promise<void> {
    const key = `${service}ApiKey` as keyof Config;
    this.store.set(key, apiKey);
    await this.enforceSecurePermissions(); // Re-enforce after write
  }

  /**
   * Get the last used AI service
   */
  getLastUsedService(): string {
    return this.store.get('lastUsedService');
  }

  /**
   * Set the last used AI service preference
   */
  async setLastUsedService(service: AIService): Promise<void> {
    this.store.set('lastUsedService', service);
    await this.enforceSecurePermissions();
  }

  /**
   * Get the config file path (useful for debugging)
   */
  getConfigPath(): string {
    return this.store.path;
  }
}

export default ConfigService;
