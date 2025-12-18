/**
 * Configuration utilities for Electron main process
 * Handles environment variables for both development and production
 */

import { isDev } from './environment';

interface ElectronConfig {
  r2AccessKeyId: string;
  r2SecretAccessKey: string;
  r2PublicUrl: string;
  r2AccountId: string;
  r2BucketName: string;
  r2ApiToken?: string;
  configFilename: string;
}

/**
 * Load configuration for Electron main process
 * In development: loads from .env file
 * In production: uses compiled environment variables
 */
export function loadElectronConfig(): ElectronConfig {
  // In development, load from .env file
  if (isDev) {
    try {
      const path = require('path');
      require('dotenv').config({ path: path.join(__dirname, '../../.env') });
      console.log('Development: Loaded .env file for Electron main process');
    } catch (error) {
      console.warn('Development: Could not load .env file:', error);
    }
  }

  // Get environment variables (works for both dev and production)
  const config: ElectronConfig = {
    r2AccessKeyId: process.env.VITE_R2_ACCESS_KEY_ID || '',
    r2SecretAccessKey: process.env.VITE_R2_SECRET_ACCESS_KEY || '',
    r2PublicUrl: process.env.VITE_R2_PUBLIC_URL || '',
    r2AccountId: process.env.VITE_R2_ACCOUNT_ID || '',
    r2BucketName: process.env.VITE_R2_BUCKET_NAME || '',
    r2ApiToken: process.env.VITE_R2_API_TOKEN,
    configFilename: process.env.CONFIG_FILENAME || 'portfolio-config.json',
  };

  // Validate required configuration
  const requiredFields = ['r2AccessKeyId', 'r2SecretAccessKey', 'r2PublicUrl', 'r2AccountId', 'r2BucketName', 'configFilename'];
  const missingFields = requiredFields.filter(field => !config[field as keyof ElectronConfig]);
  
  if (missingFields.length > 0) {
    const mode = isDev ? 'development' : 'production';
    throw new Error(
      `Missing required R2 configuration in ${mode} mode: ${missingFields.join(', ')}. ` +
      (isDev 
        ? 'Please check your .env file.' 
        : 'Please ensure environment variables are set during build.')
    );
  }

  return config;
}

// Export singleton config
let electronConfig: ElectronConfig | null = null;

export function getElectronConfig(): ElectronConfig {
  if (!electronConfig) {
    electronConfig = loadElectronConfig();
  }
  return electronConfig;
}