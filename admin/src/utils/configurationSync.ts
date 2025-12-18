/**
 * Configuration synchronization utilities
 * Ensures both Portfolio_Website and Admin_Interface use identical configuration loading mechanisms
 */

import { PortfolioConfig } from '../hooks/useConfigurationManager';

/**
 * Configuration URL construction - matches portfolio website implementation
 */
export function constructConfigUrl(): string {
  const r2PublicUrl = import.meta.env.VITE_R2_PUBLIC_URL;
  const configFilename = import.meta.env.CONFIG_FILENAME || 'portfolio-config.json';
  
  if (!r2PublicUrl) {
    throw new Error('VITE_R2_PUBLIC_URL environment variable is required');
  }
  
  const baseUrl = r2PublicUrl.replace(/\/$/, '');
  return `${baseUrl}/${configFilename}`;
}

/**
 * Configuration validation - matches portfolio website validation
 */
export function validatePortfolioConfig(config: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check required top-level properties
  if (!config || typeof config !== 'object') {
    errors.push('Configuration must be an object');
    return { isValid: false, errors };
  }

  // Validate site section
  if (!config.site || typeof config.site !== 'object') {
    errors.push('Configuration must have a site section');
  } else {
    if (!config.site.title || typeof config.site.title !== 'string') {
      errors.push('Site title is required and must be a string');
    }
    if (!config.site.description || typeof config.site.description !== 'string') {
      errors.push('Site description is required and must be a string');
    }
    if (config.site.instagram && typeof config.site.instagram !== 'string') {
      errors.push('Instagram URL must be a string');
    }
  }

  // Validate categories section
  if (!Array.isArray(config.categories)) {
    errors.push('Categories must be an array');
  } else {
    const categoryIds = new Set<string>();
    config.categories.forEach((category: any, index: number) => {
      if (!category.id || typeof category.id !== 'string') {
        errors.push(`Category ${index} must have a valid id`);
      } else {
        if (categoryIds.has(category.id)) {
          errors.push(`Duplicate category ID: ${category.id}`);
        }
        categoryIds.add(category.id);
      }
      
      if (!category.name || typeof category.name !== 'string') {
        errors.push(`Category ${index} must have a valid name`);
      }
      
      if (!Array.isArray(category.images)) {
        errors.push(`Category ${index} must have an images array`);
      }
    });
  }

  // Validate images section
  if (!config.images || typeof config.images !== 'object') {
    errors.push('Images section must be an object');
  } else {
    Object.entries(config.images).forEach(([filename, imageData]: [string, any]) => {
      if (!imageData || typeof imageData !== 'object') {
        errors.push(`Image data for ${filename} must be an object`);
        return;
      }
      
      if (imageData.filename !== filename) {
        errors.push(`Image filename mismatch for ${filename}`);
      }
      
      if (!imageData.category || typeof imageData.category !== 'string') {
        errors.push(`Image ${filename} must have a valid category`);
      }
      
      if (typeof imageData.order !== 'number') {
        errors.push(`Image ${filename} must have a numeric order`);
      }
      
      if (!imageData.dimensions || typeof imageData.dimensions !== 'object' ||
          typeof imageData.dimensions.width !== 'number' ||
          typeof imageData.dimensions.height !== 'number') {
        errors.push(`Image ${filename} must have valid dimensions`);
      }
      
      if (!imageData.uploadDate || typeof imageData.uploadDate !== 'string') {
        errors.push(`Image ${filename} must have a valid upload date`);
      }
    });
  }

  // Validate easter eggs section (optional)
  if (config.easterEggs && typeof config.easterEggs !== 'object') {
    errors.push('Easter eggs section must be an object if present');
  } else if (config.easterEggs) {
    if (typeof config.easterEggs.fireworksEnabled !== 'boolean') {
      errors.push('Easter eggs fireworksEnabled must be a boolean');
    }
    if (typeof config.easterEggs.christmasOverride !== 'boolean') {
      errors.push('Easter eggs christmasOverride must be a boolean');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Default configuration - matches portfolio website defaults
 */
export function createDefaultConfig(): PortfolioConfig {
  return {
    site: {
      title: "Biff Cross Photography",
      description: "Professional photography portfolio",
      instagram: "https://instagram.com/biffcross"
    },
    categories: [
      {
        id: "sports",
        name: "Sports",
        description: "Athletic and sports photography",
        images: []
      },
      {
        id: "music",
        name: "Music",
        description: "Concert and music photography",
        images: []
      },
      {
        id: "portraiture",
        name: "Portraiture",
        description: "Portrait photography",
        images: []
      },
      {
        id: "analogue",
        name: "Analogue",
        description: "Film photography",
        images: []
      },
      {
        id: "editorial",
        name: "Editorial",
        description: "Editorial and commercial photography",
        images: []
      }
    ],
    images: {},
    easterEggs: {
      fireworksEnabled: false,
      christmasOverride: false
    }
  };
}

/**
 * Configuration loading with retry mechanism - matches portfolio website implementation
 */
export async function loadConfigurationFromR2(
  maxRetries: number = 3,
  retryDelay: number = 1000
): Promise<PortfolioConfig> {
  const configUrl = constructConfigUrl();
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Loading configuration from R2 (attempt ${attempt}/${maxRetries}): ${configUrl}`);
      
      const response = await fetch(configUrl);
      
      if (!response.ok) {
        if (response.status === 404) {
          console.warn('Configuration not found in R2, using default configuration');
          return createDefaultConfig();
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const configText = await response.text();
      const parsedConfig = JSON.parse(configText);
      
      // Validate configuration
      const validation = validatePortfolioConfig(parsedConfig);
      if (!validation.isValid) {
        throw new Error(`Configuration validation failed: ${validation.errors.join(', ')}`);
      }
      
      // Merge with default config to ensure all required fields exist
      const defaultConfig = createDefaultConfig();
      const mergedConfig: PortfolioConfig = {
        site: { ...defaultConfig.site, ...parsedConfig.site },
        categories: parsedConfig.categories || defaultConfig.categories,
        images: parsedConfig.images || defaultConfig.images,
        easterEggs: { ...defaultConfig.easterEggs, ...parsedConfig.easterEggs }
      };
      
      console.log('Configuration loaded successfully from R2');
      return mergedConfig;
      
    } catch (error) {
      console.warn(`Configuration load attempt ${attempt} failed:`, error);
      
      if (attempt < maxRetries) {
        console.log(`Retrying in ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        retryDelay *= 2; // Exponential backoff
      }
    }
  }
  
  console.error('All configuration load attempts failed, using default configuration');
  return createDefaultConfig();
}

/**
 * Configuration upload with validation
 */
export async function uploadConfigurationToR2(
  config: PortfolioConfig,
  uploadFunction: (config: any) => Promise<void>
): Promise<void> {
  // Validate configuration before upload
  const validation = validatePortfolioConfig(config);
  if (!validation.isValid) {
    throw new Error(`Cannot upload invalid configuration: ${validation.errors.join(', ')}`);
  }
  
  console.log('Uploading configuration to R2...');
  await uploadFunction(config);
  console.log('Configuration uploaded successfully to R2');
}

/**
 * Error class for configuration sync operations
 */
export class ConfigurationSyncError extends Error {
  constructor(message: string, public originalError?: Error) {
    super(message);
    this.name = 'ConfigurationSyncError';
  }
}

/**
 * Utility to test if configuration URL is accessible
 */
export async function testConfigurationAccess(): Promise<{ accessible: boolean; error?: string }> {
  try {
    const configUrl = constructConfigUrl();
    const response = await fetch(configUrl, { method: 'HEAD' });
    
    return {
      accessible: response.ok || response.status === 404, // 404 is acceptable (no config yet)
      error: response.ok || response.status === 404 ? undefined : `HTTP ${response.status}: ${response.statusText}`
    };
  } catch (error) {
    return {
      accessible: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Utility to compare two configurations for differences
 */
export function compareConfigurations(
  config1: PortfolioConfig,
  config2: PortfolioConfig
): { identical: boolean; differences: string[] } {
  const differences: string[] = [];
  
  // Compare site configuration
  if (JSON.stringify(config1.site) !== JSON.stringify(config2.site)) {
    differences.push('Site configuration differs');
  }
  
  // Compare categories
  if (JSON.stringify(config1.categories) !== JSON.stringify(config2.categories)) {
    differences.push('Categories configuration differs');
  }
  
  // Compare images
  if (JSON.stringify(config1.images) !== JSON.stringify(config2.images)) {
    differences.push('Images configuration differs');
  }
  
  // Compare easter eggs
  if (JSON.stringify(config1.easterEggs) !== JSON.stringify(config2.easterEggs)) {
    differences.push('Easter eggs configuration differs');
  }
  
  return {
    identical: differences.length === 0,
    differences
  };
}