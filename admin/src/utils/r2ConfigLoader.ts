/**
 * R2 Configuration Loader
 * Ensures both Portfolio_Website and Admin_Interface use identical configuration loading mechanism
 * This module provides the same configuration loading logic as the portfolio website
 */

import { PortfolioConfig } from '../hooks/useConfigurationManager';
import { 
  constructConfigUrl, 
  loadConfigurationFromR2, 
  testConfigurationAccess,
  ConfigurationSyncError 
} from './configurationSync';

/**
 * Configuration loader that matches the portfolio website implementation exactly
 * This ensures both applications load from the same R2 URL with identical error handling
 */
export class R2ConfigLoader {
  private configUrl: string;
  private maxRetries: number;
  private retryDelay: number;

  constructor(maxRetries: number = 3, retryDelay: number = 1000) {
    this.configUrl = constructConfigUrl();
    this.maxRetries = maxRetries;
    this.retryDelay = retryDelay;
  }

  /**
   * Load configuration using the same mechanism as Portfolio_Website
   * This method replicates the exact loading behavior from src/utils/config.ts
   */
  async loadConfiguration(): Promise<PortfolioConfig> {
    console.log(`Loading configuration from R2 URL: ${this.configUrl}`);
    
    try {
      // Use the same loading mechanism as the portfolio website
      return await loadConfigurationFromR2(this.maxRetries, this.retryDelay);
    } catch (error) {
      console.error('R2 configuration loading failed:', error);
      throw new ConfigurationSyncError(
        'Failed to load configuration from R2',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Test if the configuration URL is accessible
   * Matches the portfolio website's connectivity testing approach
   */
  async testAccess(): Promise<{ accessible: boolean; error?: string }> {
    console.log(`Testing configuration access at: ${this.configUrl}`);
    
    try {
      return await testConfigurationAccess();
    } catch (error) {
      console.error('Configuration access test failed:', error);
      return {
        accessible: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get the configuration URL being used
   * Useful for debugging and ensuring consistency
   */
  getConfigUrl(): string {
    return this.configUrl;
  }

  /**
   * Validate that the environment is properly configured for R2 access
   */
  validateEnvironment(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check required environment variables
    if (!import.meta.env.VITE_R2_PUBLIC_URL) {
      errors.push('VITE_R2_PUBLIC_URL environment variable is required');
    }

    // Validate URL format
    try {
      new URL(this.configUrl);
    } catch {
      errors.push('Invalid R2 public URL format');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

/**
 * Singleton instance for consistent usage across the application
 */
export const r2ConfigLoader = new R2ConfigLoader();

/**
 * Convenience function for loading configuration with consistent error handling
 */
export async function loadPortfolioConfigFromR2(): Promise<PortfolioConfig> {
  return await r2ConfigLoader.loadConfiguration();
}

/**
 * Convenience function for testing R2 configuration access
 */
export async function testR2ConfigAccess(): Promise<boolean> {
  const result = await r2ConfigLoader.testAccess();
  return result.accessible;
}

/**
 * Get the R2 configuration URL being used by both applications
 */
export function getR2ConfigUrl(): string {
  return r2ConfigLoader.getConfigUrl();
}

/**
 * Validate that the environment is properly set up for R2 configuration loading
 */
export function validateR2Environment(): { valid: boolean; errors: string[] } {
  return r2ConfigLoader.validateEnvironment();
}