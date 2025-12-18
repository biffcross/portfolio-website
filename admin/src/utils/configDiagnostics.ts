/**
 * Configuration diagnostics and repair utilities
 * Helps diagnose and fix configuration issues
 */

import { constructConfigUrl } from './configurationSync';

export interface ConfigDiagnostics {
  configUrl: string;
  accessible: boolean;
  hasValidJson: boolean;
  jsonError?: string;
  rawContent?: string;
  contentLength: number;
  suggestions: string[];
}

/**
 * Diagnose configuration issues
 */
export async function diagnoseConfiguration(): Promise<ConfigDiagnostics> {
  const configUrl = constructConfigUrl();
  const diagnostics: ConfigDiagnostics = {
    configUrl,
    accessible: false,
    hasValidJson: false,
    contentLength: 0,
    suggestions: []
  };

  try {
    console.log(`Diagnosing configuration at: ${configUrl}`);
    
    // Try to fetch the configuration
    const response = await fetch(configUrl);
    
    if (!response.ok) {
      diagnostics.suggestions.push(`HTTP ${response.status}: ${response.statusText}`);
      
      if (response.status === 404) {
        diagnostics.suggestions.push('Configuration file does not exist in R2 storage');
        diagnostics.suggestions.push('Upload a valid configuration through the admin interface');
      } else {
        diagnostics.suggestions.push('Check R2 bucket permissions and public access settings');
      }
      
      return diagnostics;
    }
    
    diagnostics.accessible = true;
    
    // Get the raw content
    const rawContent = await response.text();
    diagnostics.rawContent = rawContent;
    diagnostics.contentLength = rawContent.length;
    
    console.log(`Configuration content length: ${rawContent.length} bytes`);
    console.log(`First 200 characters: ${rawContent.substring(0, 200)}`);
    
    // Try to parse JSON
    try {
      JSON.parse(rawContent);
      diagnostics.hasValidJson = true;
      diagnostics.suggestions.push('Configuration JSON is valid');
    } catch (jsonError) {
      diagnostics.hasValidJson = false;
      diagnostics.jsonError = jsonError instanceof Error ? jsonError.message : 'Unknown JSON error';
      
      // Analyze the JSON error
      if (diagnostics.jsonError.includes('position')) {
        const match = diagnostics.jsonError.match(/position (\d+)/);
        if (match) {
          const position = parseInt(match[1]);
          const problemArea = rawContent.substring(Math.max(0, position - 20), position + 20);
          diagnostics.suggestions.push(`JSON error at position ${position}: "${problemArea}"`);
        }
      }
      
      diagnostics.suggestions.push('Configuration contains invalid JSON');
      diagnostics.suggestions.push('The file may be corrupted or partially uploaded');
      diagnostics.suggestions.push('Try uploading a new configuration through the admin interface');
    }
    
  } catch (error) {
    diagnostics.suggestions.push(`Network error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    diagnostics.suggestions.push('Check internet connection and R2 service availability');
  }
  
  return diagnostics;
}

/**
 * Create a clean default configuration and upload it
 */
export async function repairConfiguration(uploadFunction: (config: any) => Promise<void>): Promise<boolean> {
  try {
    console.log('Creating clean default configuration...');
    
    const defaultConfig = {
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
    
    // Validate the JSON by stringifying and parsing
    const jsonString = JSON.stringify(defaultConfig, null, 2);
    JSON.parse(jsonString); // This will throw if there's an issue
    
    console.log('Uploading clean configuration...');
    await uploadFunction(defaultConfig);
    
    console.log('Configuration repaired successfully');
    return true;
    
  } catch (error) {
    console.error('Failed to repair configuration:', error);
    return false;
  }
}

/**
 * Log detailed diagnostics to console
 */
export function logDiagnostics(diagnostics: ConfigDiagnostics): void {
  console.log('\n=== Configuration Diagnostics ===');
  console.log(`URL: ${diagnostics.configUrl}`);
  console.log(`Accessible: ${diagnostics.accessible}`);
  console.log(`Valid JSON: ${diagnostics.hasValidJson}`);
  console.log(`Content Length: ${diagnostics.contentLength} bytes`);
  
  if (diagnostics.jsonError) {
    console.log(`JSON Error: ${diagnostics.jsonError}`);
  }
  
  if (diagnostics.rawContent && diagnostics.rawContent.length < 500) {
    console.log('Raw Content:');
    console.log(diagnostics.rawContent);
  }
  
  console.log('Suggestions:');
  diagnostics.suggestions.forEach((suggestion, index) => {
    console.log(`  ${index + 1}. ${suggestion}`);
  });
  
  console.log('=== End Diagnostics ===\n');
}