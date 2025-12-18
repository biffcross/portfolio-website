import { PortfolioConfig } from '../hooks/useConfigurationManager';
import { 
  validatePortfolioConfig, 
  createDefaultConfig, 
  uploadConfigurationToR2,
  ConfigurationSyncError 
} from '../utils/configurationSync';
import { r2ConfigLoader } from '../utils/r2ConfigLoader';
import { diagnoseConfiguration, repairConfiguration, logDiagnostics } from '../utils/configDiagnostics';

/**
 * Configuration Service for internal JSON management
 * This service abstracts all configuration operations and provides automatic R2 sync
 * without exposing JSON editing capabilities to users
 */

export interface ImageMetadata {
  filename: string;
  caption: string;
  description?: string;
  category: string;
  order: number;
  dimensions: { width: number; height: number };
  uploadDate: string;
}

export interface CategoryData {
  id: string;
  name: string;
  description: string;
  images: string[];
}

export interface ConfigurationUpdateResult {
  success: boolean;
  error?: string;
  config?: PortfolioConfig;
}

export interface ConfigurationValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * R2 Service interface for dependency injection
 */
export interface R2ServiceInterface {
  uploadConfiguration: (config: any) => Promise<void>;
  downloadConfiguration: () => Promise<any>;
  testConnection: () => Promise<boolean>;
}

/**
 * Configuration Service class for internal JSON management
 * Handles all configuration operations without exposing JSON editing to users
 */
export class ConfigurationService {
  private config: PortfolioConfig | null = null;
  private r2Service: R2ServiceInterface;
  private isLoading = false;
  private isSaving = false;
  private lastSaved: Date | null = null;
  private hasUnsavedChanges = false;

  // Event listeners for configuration changes
  private changeListeners: Array<(config: PortfolioConfig) => void> = [];
  private errorListeners: Array<(error: string) => void> = [];
  private saveListeners: Array<(success: boolean) => void> = [];

  constructor(r2Service: R2ServiceInterface) {
    this.r2Service = r2Service;
  }

  /**
   * Create default portfolio configuration - uses sync utility for consistency
   */
  private createDefaultConfig(): PortfolioConfig {
    return createDefaultConfig();
  }

  /**
   * Validate configuration structure and data integrity - uses sync utility for consistency
   */
  private validateConfiguration(config: any): ConfigurationValidationResult {
    const validation = validatePortfolioConfig(config);
    return {
      isValid: validation.isValid,
      errors: validation.errors,
      warnings: [] // Sync utility doesn't separate warnings, but we maintain interface compatibility
    };
  }

  /**
   * Load configuration from R2 storage using the same mechanism as Portfolio_Website
   */
  async loadConfiguration(): Promise<ConfigurationUpdateResult> {
    if (this.isLoading) {
      return { success: false, error: 'Configuration is already being loaded' };
    }

    this.isLoading = true;

    try {
      // First, try to load using the same mechanism as the portfolio website
      // This ensures both applications use identical loading logic
      console.log('Loading configuration using Portfolio_Website-compatible loader...');
      
      try {
        const config = await r2ConfigLoader.loadConfiguration();
        
        this.config = config;
        this.hasUnsavedChanges = false;
        this.notifyChange(config);

        console.log('Configuration loaded successfully using website-compatible method');
        return { success: true, config };
        
      } catch (websiteLoaderError) {
        console.warn('Website-compatible loader failed, diagnosing issue:', websiteLoaderError);
        
        // Diagnose the configuration issue
        try {
          const diagnostics = await diagnoseConfiguration();
          logDiagnostics(diagnostics);
          
          // If the configuration is accessible but has invalid JSON, try to repair it
          if (diagnostics.accessible && !diagnostics.hasValidJson) {
            console.log('Attempting to repair corrupted configuration...');
            const repaired = await repairConfiguration((config) => this.r2Service.uploadConfiguration(config));
            
            if (repaired) {
              console.log('Configuration repaired, retrying load...');
              const config = await r2ConfigLoader.loadConfiguration();
              this.config = config;
              this.hasUnsavedChanges = false;
              this.notifyChange(config);
              return { success: true, config };
            }
          }
        } catch (diagnosticError) {
          console.warn('Diagnostics failed:', diagnosticError);
        }
        
        // Fallback to Electron R2 service for cases where fetch might not work
        const configData = await this.r2Service.downloadConfiguration();
        
        if (configData) {
          // Validate the loaded configuration
          const validation = this.validateConfiguration(configData);
          
          if (!validation.isValid) {
            const errorMessage = `Configuration validation failed: ${validation.errors.join(', ')}`;
            this.notifyError(errorMessage);
            return { success: false, error: errorMessage };
          }

          // Merge with default config to ensure all required fields exist
          const defaultConfig = this.createDefaultConfig();
          const mergedConfig: PortfolioConfig = {
            site: { ...defaultConfig.site, ...configData.site },
            categories: configData.categories || defaultConfig.categories,
            images: configData.images || defaultConfig.images,
            easterEggs: { ...defaultConfig.easterEggs, ...configData.easterEggs }
          };

          this.config = mergedConfig;
          this.hasUnsavedChanges = false;
          this.notifyChange(mergedConfig);

          console.log('Configuration loaded successfully using Electron R2 service fallback');
          return { success: true, config: mergedConfig };
        } else {
          // No configuration found, create default
          const defaultConfig = this.createDefaultConfig();
          this.config = defaultConfig;
          this.hasUnsavedChanges = true; // Mark as unsaved since we need to upload the default
          this.notifyChange(defaultConfig);

          console.log('No configuration found, using default configuration');
          return { success: true, config: defaultConfig };
        }
      }
    } catch (error) {
      const errorMessage = error instanceof ConfigurationSyncError 
        ? error.message 
        : error instanceof Error 
          ? error.message 
          : 'Failed to load configuration';
      
      console.error('Configuration loading failed:', error);
      this.notifyError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Save configuration to R2 storage with automatic sync - uses sync utility for consistency
   */
  async saveConfiguration(): Promise<ConfigurationUpdateResult> {
    if (!this.config) {
      const error = 'No configuration to save';
      this.notifyError(error);
      return { success: false, error };
    }

    if (this.isSaving) {
      return { success: false, error: 'Configuration is already being saved' };
    }

    this.isSaving = true;

    try {
      // Use sync utility for consistent validation and upload
      await uploadConfigurationToR2(this.config, (config) => this.r2Service.uploadConfiguration(config));
      
      this.lastSaved = new Date();
      this.hasUnsavedChanges = false;
      this.notifySave(true);

      return { success: true, config: this.config };
    } catch (error) {
      const errorMessage = error instanceof ConfigurationSyncError 
        ? error.message 
        : error instanceof Error 
          ? error.message 
          : 'Failed to save configuration';
      
      this.notifyError(errorMessage);
      this.notifySave(false);
      return { success: false, error: errorMessage };
    } finally {
      this.isSaving = false;
    }
  }

  /**
   * Add a new image to the configuration with automatic category assignment
   */
  async addImage(
    filename: string,
    category: string,
    caption: string = '',
    description: string = '',
    dimensions: { width: number; height: number } = { width: 0, height: 0 }
  ): Promise<ConfigurationUpdateResult> {
    if (!this.config) {
      const error = 'Configuration not loaded';
      this.notifyError(error);
      return { success: false, error };
    }

    // Validate category exists
    const categoryExists = this.config.categories.some(cat => cat.id === category);
    if (!categoryExists) {
      const error = `Category "${category}" does not exist`;
      this.notifyError(error);
      return { success: false, error };
    }

    // Check if image already exists
    if (this.config.images[filename]) {
      const error = `Image "${filename}" already exists in configuration`;
      this.notifyError(error);
      return { success: false, error };
    }

    // Calculate order for the new image in the category
    const categoryImages = Object.values(this.config.images)
      .filter(img => img.category === category)
      .sort((a, b) => a.order - b.order);
    
    const nextOrder = categoryImages.length > 0 
      ? Math.max(...categoryImages.map(img => img.order)) + 1 
      : 0;

    // Add image metadata
    const imageMetadata: ImageMetadata = {
      filename,
      caption,
      description,
      category,
      order: nextOrder,
      dimensions,
      uploadDate: new Date().toISOString()
    };

    // Update configuration
    this.config.images[filename] = imageMetadata;
    
    // Add to category images array
    const categoryData = this.config.categories.find(cat => cat.id === category);
    if (categoryData && !categoryData.images.includes(filename)) {
      categoryData.images.push(filename);
    }

    this.hasUnsavedChanges = true;
    this.notifyChange(this.config);

    // Automatically save configuration
    return await this.saveConfiguration();
  }

  /**
   * Update image metadata with automatic configuration sync
   */
  async updateImage(
    filename: string,
    updates: Partial<Omit<ImageMetadata, 'filename' | 'uploadDate'>>
  ): Promise<ConfigurationUpdateResult> {
    if (!this.config) {
      const error = 'Configuration not loaded';
      this.notifyError(error);
      return { success: false, error };
    }

    const existingImage = this.config.images[filename];
    if (!existingImage) {
      const error = `Image "${filename}" not found in configuration`;
      this.notifyError(error);
      return { success: false, error };
    }

    // Handle category change
    if (updates.category && updates.category !== existingImage.category) {
      // Validate new category exists
      const categoryExists = this.config.categories.some(cat => cat.id === updates.category);
      if (!categoryExists) {
        const error = `Category "${updates.category}" does not exist`;
        this.notifyError(error);
        return { success: false, error };
      }

      // Remove from old category
      const oldCategory = this.config.categories.find(cat => cat.id === existingImage.category);
      if (oldCategory) {
        oldCategory.images = oldCategory.images.filter(img => img !== filename);
      }

      // Add to new category
      const newCategory = this.config.categories.find(cat => cat.id === updates.category);
      if (newCategory && !newCategory.images.includes(filename)) {
        newCategory.images.push(filename);
      }

      // Recalculate order for new category
      if (updates.order === undefined) {
        const categoryImages = Object.values(this.config.images)
          .filter(img => img.category === updates.category && img.filename !== filename)
          .sort((a, b) => a.order - b.order);
        
        updates.order = categoryImages.length > 0 
          ? Math.max(...categoryImages.map(img => img.order)) + 1 
          : 0;
      }
    }

    // Update image metadata
    this.config.images[filename] = {
      ...existingImage,
      ...updates,
      filename, // Ensure filename doesn't change
      uploadDate: existingImage.uploadDate // Preserve original upload date
    };

    this.hasUnsavedChanges = true;
    this.notifyChange(this.config);

    // Automatically save configuration
    return await this.saveConfiguration();
  }

  /**
   * Remove image from configuration with automatic sync
   */
  async removeImage(filename: string): Promise<ConfigurationUpdateResult> {
    if (!this.config) {
      const error = 'Configuration not loaded';
      this.notifyError(error);
      return { success: false, error };
    }

    const existingImage = this.config.images[filename];
    if (!existingImage) {
      const error = `Image "${filename}" not found in configuration`;
      this.notifyError(error);
      return { success: false, error };
    }

    // Remove from images object
    delete this.config.images[filename];

    // Remove from category images array
    const category = this.config.categories.find(cat => cat.id === existingImage.category);
    if (category) {
      category.images = category.images.filter(img => img !== filename);
    }

    this.hasUnsavedChanges = true;
    this.notifyChange(this.config);

    // Automatically save configuration
    return await this.saveConfiguration();
  }

  /**
   * Reorder images within a category with automatic sync
   */
  async reorderImagesInCategory(
    category: string,
    orderedFilenames: string[]
  ): Promise<ConfigurationUpdateResult> {
    if (!this.config) {
      const error = 'Configuration not loaded';
      this.notifyError(error);
      return { success: false, error };
    }

    // Validate category exists
    const categoryData = this.config.categories.find(cat => cat.id === category);
    if (!categoryData) {
      const error = `Category "${category}" does not exist`;
      this.notifyError(error);
      return { success: false, error };
    }

    // Validate all filenames exist and belong to the category
    for (const filename of orderedFilenames) {
      const image = this.config.images[filename];
      if (!image) {
        const error = `Image "${filename}" not found in configuration`;
        this.notifyError(error);
        return { success: false, error };
      }
      if (image.category !== category) {
        const error = `Image "${filename}" does not belong to category "${category}"`;
        this.notifyError(error);
        return { success: false, error };
      }
    }

    // Update order for each image
    orderedFilenames.forEach((filename, index) => {
      if (this.config!.images[filename]) {
        this.config!.images[filename].order = index;
      }
    });

    // Update category images array to match the new order
    categoryData.images = orderedFilenames;

    this.hasUnsavedChanges = true;
    this.notifyChange(this.config);

    // Automatically save configuration
    return await this.saveConfiguration();
  }

  /**
   * Update easter egg settings with automatic sync
   */
  async updateEasterEggSettings(
    settings: Partial<PortfolioConfig['easterEggs']>
  ): Promise<ConfigurationUpdateResult> {
    if (!this.config) {
      const error = 'Configuration not loaded';
      this.notifyError(error);
      return { success: false, error };
    }

    this.config.easterEggs = {
      ...this.config.easterEggs,
      ...settings
    };

    this.hasUnsavedChanges = true;
    this.notifyChange(this.config);

    // Automatically save configuration
    return await this.saveConfiguration();
  }

  /**
   * Get current configuration (read-only)
   */
  getConfiguration(): PortfolioConfig | null {
    return this.config ? { ...this.config } : null;
  }

  /**
   * Get configuration status
   */
  getStatus() {
    return {
      isLoaded: this.config !== null,
      isLoading: this.isLoading,
      isSaving: this.isSaving,
      hasUnsavedChanges: this.hasUnsavedChanges,
      lastSaved: this.lastSaved
    };
  }

  /**
   * Get diagnostic information about configuration sync
   */
  getDiagnostics() {
    const envValidation = r2ConfigLoader.validateEnvironment();
    
    return {
      configUrl: r2ConfigLoader.getConfigUrl(),
      environmentValid: envValidation.valid,
      environmentErrors: envValidation.errors,
      isLoaded: this.config !== null,
      isLoading: this.isLoading,
      isSaving: this.isSaving,
      hasUnsavedChanges: this.hasUnsavedChanges,
      lastSaved: this.lastSaved,
      configSize: this.config ? JSON.stringify(this.config).length : 0
    };
  }

  /**
   * Test R2 connection using the same URL as Portfolio_Website
   */
  async testConnection(): Promise<boolean> {
    try {
      // Test using the same configuration URL as the portfolio website
      const websiteAccessTest = await r2ConfigLoader.testAccess();
      
      if (websiteAccessTest.accessible) {
        console.log('R2 configuration URL is accessible (same as Portfolio_Website)');
        return true;
      }
      
      console.warn('Website configuration URL test failed, trying Electron R2 service:', websiteAccessTest.error);
      
      // Fallback to Electron R2 service test
      const electronTest = await this.r2Service.testConnection();
      
      if (electronTest) {
        console.log('Electron R2 service connection successful');
        return true;
      }
      
      console.error('Both configuration URL and Electron R2 service tests failed');
      return false;
      
    } catch (error) {
      console.error('R2 connection test failed:', error);
      return false;
    }
  }

  // Event listener management
  onConfigurationChange(listener: (config: PortfolioConfig) => void): () => void {
    this.changeListeners.push(listener);
    return () => {
      const index = this.changeListeners.indexOf(listener);
      if (index > -1) {
        this.changeListeners.splice(index, 1);
      }
    };
  }

  onError(listener: (error: string) => void): () => void {
    this.errorListeners.push(listener);
    return () => {
      const index = this.errorListeners.indexOf(listener);
      if (index > -1) {
        this.errorListeners.splice(index, 1);
      }
    };
  }

  onSave(listener: (success: boolean) => void): () => void {
    this.saveListeners.push(listener);
    return () => {
      const index = this.saveListeners.indexOf(listener);
      if (index > -1) {
        this.saveListeners.splice(index, 1);
      }
    };
  }

  // Private notification methods
  private notifyChange(config: PortfolioConfig): void {
    this.changeListeners.forEach(listener => {
      try {
        listener(config);
      } catch (error) {
        console.error('Error in configuration change listener:', error);
      }
    });
  }

  private notifyError(error: string): void {
    this.errorListeners.forEach(listener => {
      try {
        listener(error);
      } catch (err) {
        console.error('Error in error listener:', err);
      }
    });
  }

  private notifySave(success: boolean): void {
    this.saveListeners.forEach(listener => {
      try {
        listener(success);
      } catch (error) {
        console.error('Error in save listener:', error);
      }
    });
  }
}