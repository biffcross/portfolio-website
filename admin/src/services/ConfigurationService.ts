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
  categories: string[];
  order: number;
  categoryOrders?: Record<string, number>; // Per-category ordering
  dimensions: { width: number; height: number };
  uploadDate: string;
  is_featured: boolean;
  // Legacy support for migration
  category?: string;
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
  deleteFile: (key: string) => Promise<void>;
  deleteFiles: (keys: string[]) => Promise<{ success: string[], failed: { key: string, error: string }[] }>;
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
   * Get the next order number for a category
   */
  private getNextOrderForCategory(categoryId: string): number {
    if (!this.config) return 0;

    // Find all images in this category and get the highest order
    const categoryImages = Object.values(this.config.images).filter(img => {
      const imgCategories = img.categories || (img.category ? [img.category] : []);
      return imgCategories.includes(categoryId);
    });

    if (categoryImages.length === 0) return 0;

    // Use categoryOrders if available, otherwise fall back to global order
    const orders = categoryImages.map(img => {
      if (img.categoryOrders && img.categoryOrders[categoryId] !== undefined) {
        return img.categoryOrders[categoryId];
      }
      return img.order;
    });

    return Math.max(...orders) + 1;
  }

  /**
   * Update category orders for an image
   */
  private updateCategoryOrders(imageMetadata: ImageMetadata, categories: string[]): ImageMetadata {
    const categoryOrders = imageMetadata.categoryOrders ? { ...imageMetadata.categoryOrders } : {};

    // Set order for each category
    categories.forEach(categoryId => {
      if (categoryOrders[categoryId] === undefined) {
        categoryOrders[categoryId] = this.getNextOrderForCategory(categoryId);
      }
    });

    // Remove orders for categories no longer assigned
    Object.keys(categoryOrders).forEach(categoryId => {
      if (!categories.includes(categoryId)) {
        delete categoryOrders[categoryId];
      }
    });

    return {
      ...imageMetadata,
      categoryOrders
    };
  }

  /**
   * Migrate legacy single-category configuration to multi-category format
   */
  private migrateConfigurationToMultiCategory(config: any): PortfolioConfig {
    // If already migrated, return as-is
    if (config.images && Object.values(config.images).every((img: any) => img.categories && img.is_featured !== undefined)) {
      return config as PortfolioConfig
    }

    // Create migrated configuration
    const migratedConfig = { ...config }
    
    // Migrate images from single category to categories array and add is_featured property
    if (migratedConfig.images) {
      Object.keys(migratedConfig.images).forEach(filename => {
        const image = migratedConfig.images[filename]
        if (image.category && !image.categories) {
          // Migrate single category to categories array
          image.categories = [image.category]
          // Keep legacy category field for backward compatibility during transition
        }
        // Add is_featured property with default value of false for existing images
        if (image.is_featured === undefined) {
          image.is_featured = false
        }
      })
    }

    return migratedConfig as PortfolioConfig
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
          // Migrate legacy configuration to multi-category format
          const migratedConfig = this.migrateConfigurationToMultiCategory(configData);
          
          // Validate the loaded configuration
          const validation = this.validateConfiguration(migratedConfig);
          
          if (!validation.isValid) {
            const errorMessage = `Configuration validation failed: ${validation.errors.join(', ')}`;
            this.notifyError(errorMessage);
            return { success: false, error: errorMessage };
          }

          // Merge with default config to ensure all required fields exist
          const defaultConfig = this.createDefaultConfig();
          const mergedConfig: PortfolioConfig = {
            site: { ...defaultConfig.site, ...migratedConfig.site },
            categories: migratedConfig.categories || defaultConfig.categories,
            images: migratedConfig.images || defaultConfig.images,
            easterEggs: { ...defaultConfig.easterEggs, ...migratedConfig.easterEggs }
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
    categories: string[],
    caption: string = '',
    description: string = '',
    dimensions: { width: number; height: number } = { width: 0, height: 0 }
  ): Promise<ConfigurationUpdateResult> {
    if (!this.config) {
      const error = 'Configuration not loaded';
      this.notifyError(error);
      return { success: false, error };
    }

    // Validate categories exist
    const invalidCategories = categories.filter(category => 
      !this.config!.categories.some(cat => cat.id === category)
    );
    if (invalidCategories.length > 0) {
      const error = `Categories do not exist: ${invalidCategories.join(', ')}`;
      this.notifyError(error);
      return { success: false, error };
    }

    // Check if image already exists
    if (this.config.images[filename]) {
      const error = `Image "${filename}" already exists in configuration`;
      this.notifyError(error);
      return { success: false, error };
    }

    // Calculate order for the new image (global order for backward compatibility)
    const allImages = Object.values(this.config.images);
    const nextGlobalOrder = allImages.length > 0 
      ? Math.max(...allImages.map(img => img.order)) + 1 
      : 0;

    // Create initial image metadata
    let imageMetadata: ImageMetadata = {
      filename,
      caption: caption || '', // Ensure caption is never undefined
      description,
      categories: [...categories], // Create a copy of the array
      order: nextGlobalOrder,
      dimensions,
      uploadDate: new Date().toISOString(),
      is_featured: false // Default value for new images
    };

    // Update category orders
    imageMetadata = this.updateCategoryOrders(imageMetadata, categories);

    // Update configuration
    this.config.images[filename] = imageMetadata;
    
    // Add to category images arrays
    categories.forEach(categoryId => {
      const categoryData = this.config!.categories.find(cat => cat.id === categoryId);
      if (categoryData && !categoryData.images.includes(filename)) {
        categoryData.images.push(filename);
      }
    });

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

    // Handle categories change
    if (updates.categories) {
      // Validate new categories exist
      const invalidCategories = updates.categories.filter(category => 
        !this.config!.categories.some(cat => cat.id === category)
      );
      if (invalidCategories.length > 0) {
        const error = `Categories do not exist: ${invalidCategories.join(', ')}`;
        this.notifyError(error);
        return { success: false, error };
      }

      // Get current categories (handle both new and legacy format)
      const currentCategories = existingImage.categories || (existingImage.category ? [existingImage.category] : []);
      
      // Remove from old categories
      currentCategories.forEach(categoryId => {
        const category = this.config!.categories.find(cat => cat.id === categoryId);
        if (category) {
          category.images = category.images.filter(img => img !== filename);
        }
      });

      // Add to new categories
      updates.categories.forEach(categoryId => {
        const category = this.config!.categories.find(cat => cat.id === categoryId);
        if (category && !category.images.includes(filename)) {
          category.images.push(filename);
        }
      });
    }

    // Handle legacy category update (for backward compatibility)
    if (updates.category && !updates.categories) {
      // Convert single category to categories array
      updates.categories = [updates.category];
      delete updates.category; // Remove legacy field from updates
    }

    // Update image metadata
    let updatedImageMetadata = {
      ...existingImage,
      ...updates,
      filename, // Ensure filename doesn't change
      uploadDate: existingImage.uploadDate, // Preserve original upload date
      caption: updates.caption !== undefined ? updates.caption : existingImage.caption || '', // Ensure caption is always a string
      dimensions: updates.dimensions || existingImage.dimensions || { width: 0, height: 0 }, // Ensure dimensions is always defined
      is_featured: updates.is_featured !== undefined ? updates.is_featured : existingImage.is_featured || false // Ensure is_featured is always defined
    };

    // Update category orders if categories changed
    if (updates.categories) {
      updatedImageMetadata = this.updateCategoryOrders(updatedImageMetadata, updates.categories);
    }

    this.config.images[filename] = updatedImageMetadata;

    this.hasUnsavedChanges = true;
    this.notifyChange(this.config);

    // Automatically save configuration
    return await this.saveConfiguration();
  }

  /**
   * Remove image from configuration with automatic sync and R2 deletion
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

    try {
      // Delete from R2 storage first
      const imageKey = `images/${filename}`;
      await this.r2Service.deleteFile(imageKey);

      // Remove from configuration
      delete this.config.images[filename];

      // Remove from category images arrays (handle both new and legacy format)
      const imageCategories = existingImage.categories || (existingImage.category ? [existingImage.category] : []);
      imageCategories.forEach(categoryId => {
        const category = this.config!.categories.find(cat => cat.id === categoryId);
        if (category) {
          category.images = category.images.filter(img => img !== filename);
        }
      });

      this.hasUnsavedChanges = true;
      this.notifyChange(this.config);

      // Automatically save configuration
      return await this.saveConfiguration();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete image';
      this.notifyError(errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Remove multiple images from configuration with automatic sync and R2 deletion
   */
  async removeImages(filenames: string[]): Promise<ConfigurationUpdateResult> {
    if (!this.config) {
      const error = 'Configuration not loaded';
      this.notifyError(error);
      return { success: false, error };
    }

    // Validate all images exist
    const missingImages = filenames.filter(filename => !this.config!.images[filename]);
    if (missingImages.length > 0) {
      const error = `Images not found: ${missingImages.join(', ')}`;
      this.notifyError(error);
      return { success: false, error };
    }

    try {
      // Delete from R2 storage first
      const imageKeys = filenames.map(filename => `images/${filename}`);
      const deleteResults = await this.r2Service.deleteFiles(imageKeys);

      // Check if any deletions failed
      if (deleteResults.failed.length > 0) {
        const failedFilenames = deleteResults.failed.map(f => f.key.replace('images/', ''));
        const error = `Failed to delete some images from R2: ${failedFilenames.join(', ')}`;
        this.notifyError(error);
        return { success: false, error };
      }

      // Remove from configuration
      filenames.forEach(filename => {
        const existingImage = this.config!.images[filename];
        if (existingImage) {
          // Remove from images object
          delete this.config!.images[filename];

          // Remove from category images arrays (handle both new and legacy format)
          const imageCategories = existingImage.categories || (existingImage.category ? [existingImage.category] : []);
          imageCategories.forEach(categoryId => {
            const category = this.config!.categories.find(cat => cat.id === categoryId);
            if (category) {
              category.images = category.images.filter(img => img !== filename);
            }
          });
        }
      });

      this.hasUnsavedChanges = true;
      this.notifyChange(this.config);

      // Automatically save configuration
      return await this.saveConfiguration();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete images';
      this.notifyError(errorMessage);
      return { success: false, error: errorMessage };
    }
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
      
      // Check if image belongs to the category (handle both new and legacy format)
      const imageCategories = image.categories || (image.category ? [image.category] : []);
      if (!imageCategories.includes(category)) {
        const error = `Image "${filename}" does not belong to category "${category}"`;
        this.notifyError(error);
        return { success: false, error };
      }
    }

    // Update category-specific order for each image
    const updatedImages = { ...this.config.images };
    orderedFilenames.forEach((filename, index) => {
      const image = updatedImages[filename];
      if (image) {
        const categoryOrders = image.categoryOrders ? { ...image.categoryOrders } : {};
        categoryOrders[category] = index;
        updatedImages[filename] = {
          ...image,
          categoryOrders
        };
      }
    });

    // Update category images array to match the new order
    categoryData.images = orderedFilenames;

    this.hasUnsavedChanges = true;
    this.notifyChange(this.config);

    // Update the configuration
    this.config.images = updatedImages;

    // Automatically save configuration
    return await this.saveConfiguration();
  }

  /**
   * Update featured status of an image with automatic sync
   */
  async updateImageFeaturedStatus(
    filename: string,
    is_featured: boolean
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

    // Update the featured status
    this.config.images[filename] = {
      ...existingImage,
      is_featured
    };

    this.hasUnsavedChanges = true;
    this.notifyChange(this.config);

    // Automatically save configuration
    return await this.saveConfiguration();
  }

  /**
   * Update featured status of multiple images with automatic sync
   */
  async updateMultipleImagesFeaturedStatus(
    updates: Array<{ filename: string; is_featured: boolean }>
  ): Promise<ConfigurationUpdateResult> {
    if (!this.config) {
      const error = 'Configuration not loaded';
      this.notifyError(error);
      return { success: false, error };
    }

    // Validate all images exist
    const missingImages = updates.filter(update => !this.config!.images[update.filename]);
    if (missingImages.length > 0) {
      const error = `Images not found: ${missingImages.map(u => u.filename).join(', ')}`;
      this.notifyError(error);
      return { success: false, error };
    }

    // Update all featured statuses
    updates.forEach(({ filename, is_featured }) => {
      const existingImage = this.config!.images[filename];
      if (existingImage) {
        this.config!.images[filename] = {
          ...existingImage,
          is_featured
        };
      }
    });

    this.hasUnsavedChanges = true;
    this.notifyChange(this.config);

    // Automatically save configuration
    return await this.saveConfiguration();
  }

  /**
   * Get all featured images
   */
  getFeaturedImages(): ImageMetadata[] {
    if (!this.config) return [];
    
    return Object.values(this.config.images)
      .filter(image => image.is_featured)
      .map(image => ({
        ...image,
        caption: image.caption || '', // Ensure caption is always a string
        dimensions: image.dimensions || { width: 0, height: 0 }, // Ensure dimensions is always defined
        is_featured: image.is_featured || false // Ensure is_featured is always defined
      }));
  }

  /**
   * Get count of featured images
   */
  getFeaturedImageCount(): number {
    return this.getFeaturedImages().length;
  }
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
   * Add a new category to the configuration with automatic sync
   */
  async addCategory(
    categoryData: CategoryData
  ): Promise<ConfigurationUpdateResult> {
    if (!this.config) {
      const error = 'Configuration not loaded';
      this.notifyError(error);
      return { success: false, error };
    }

    // Validate category ID is unique
    const existingCategory = this.config.categories.find(cat => cat.id === categoryData.id);
    if (existingCategory) {
      const error = `Category with ID "${categoryData.id}" already exists`;
      this.notifyError(error);
      return { success: false, error };
    }

    // Validate required fields
    if (!categoryData.id.trim() || !categoryData.name.trim() || !categoryData.description.trim()) {
      const error = 'Category ID, name, and description are required';
      this.notifyError(error);
      return { success: false, error };
    }

    // Validate ID format
    if (!/^[a-z0-9-]+$/.test(categoryData.id)) {
      const error = 'Category ID can only contain lowercase letters, numbers, and hyphens';
      this.notifyError(error);
      return { success: false, error };
    }

    // Add new category
    const newCategory: CategoryData = {
      id: categoryData.id.trim(),
      name: categoryData.name.trim(),
      description: categoryData.description.trim(),
      images: []
    };

    this.config.categories.push(newCategory);

    this.hasUnsavedChanges = true;
    this.notifyChange(this.config);

    // Automatically save configuration
    return await this.saveConfiguration();
  }

  /**
   * Update an existing category with automatic sync
   */
  async updateCategory(
    categoryId: string,
    updates: Partial<Omit<CategoryData, 'id' | 'images'>>
  ): Promise<ConfigurationUpdateResult> {
    if (!this.config) {
      const error = 'Configuration not loaded';
      this.notifyError(error);
      return { success: false, error };
    }

    const categoryIndex = this.config.categories.findIndex(cat => cat.id === categoryId);
    if (categoryIndex === -1) {
      const error = `Category "${categoryId}" not found`;
      this.notifyError(error);
      return { success: false, error };
    }

    // Validate required fields if provided
    if (updates.name !== undefined && !updates.name.trim()) {
      const error = 'Category name cannot be empty';
      this.notifyError(error);
      return { success: false, error };
    }

    if (updates.description !== undefined && !updates.description.trim()) {
      const error = 'Category description cannot be empty';
      this.notifyError(error);
      return { success: false, error };
    }

    // Update category
    this.config.categories[categoryIndex] = {
      ...this.config.categories[categoryIndex],
      ...updates,
      name: updates.name?.trim() || this.config.categories[categoryIndex].name,
      description: updates.description?.trim() || this.config.categories[categoryIndex].description
    };

    this.hasUnsavedChanges = true;
    this.notifyChange(this.config);

    // Automatically save configuration
    return await this.saveConfiguration();
  }

  /**
   * Remove a category from the configuration with automatic sync
   * Handles images assigned to the deleted category by moving them to uncategorized
   */
  async removeCategory(
    categoryId: string,
    moveImagesToUncategorized: boolean = true
  ): Promise<ConfigurationUpdateResult> {
    if (!this.config) {
      const error = 'Configuration not loaded';
      this.notifyError(error);
      return { success: false, error };
    }

    const categoryIndex = this.config.categories.findIndex(cat => cat.id === categoryId);
    if (categoryIndex === -1) {
      const error = `Category "${categoryId}" not found`;
      this.notifyError(error);
      return { success: false, error };
    }

    const category = this.config.categories[categoryIndex];

    // Handle images assigned to this category
    if (category.images.length > 0) {
      if (moveImagesToUncategorized) {
        // Ensure "uncategorized" category exists
        let uncategorizedCategory = this.config.categories.find(cat => cat.id === 'uncategorized');
        if (!uncategorizedCategory) {
          uncategorizedCategory = {
            id: 'uncategorized',
            name: 'Uncategorized',
            description: 'Images without a specific category',
            images: []
          };
          this.config.categories.push(uncategorizedCategory);
        }

        // Move images to uncategorized
        category.images.forEach(imageId => {
          const image = this.config!.images[imageId];
          if (image) {
            // Update image categories (remove deleted category, add uncategorized if not present)
            const currentCategories = image.categories || (image.category ? [image.category] : []);
            const updatedCategories = currentCategories.filter(cat => cat !== categoryId);
            
            if (!updatedCategories.includes('uncategorized')) {
              updatedCategories.push('uncategorized');
            }

            // Update image metadata
            this.config!.images[imageId] = {
              ...image,
              categories: updatedCategories
            };

            // Add to uncategorized category if not already there
            if (!uncategorizedCategory!.images.includes(imageId)) {
              uncategorizedCategory!.images.push(imageId);
            }
          }
        });
      } else {
        // Remove category from all images without moving to uncategorized
        category.images.forEach(imageId => {
          const image = this.config!.images[imageId];
          if (image) {
            const currentCategories = image.categories || (image.category ? [image.category] : []);
            const updatedCategories = currentCategories.filter(cat => cat !== categoryId);

            this.config!.images[imageId] = {
              ...image,
              categories: updatedCategories
            };
          }
        });
      }
    }

    // Remove the category
    this.config.categories.splice(categoryIndex, 1);

    this.hasUnsavedChanges = true;
    this.notifyChange(this.config);

    // Automatically save configuration
    return await this.saveConfiguration();
  }

  /**
   * Get all existing category IDs for validation
   */
  getCategoryIds(): string[] {
    return this.config ? this.config.categories.map(cat => cat.id) : [];
  }

  /**
   * Get category by ID
   */
  getCategory(categoryId: string): CategoryData | null {
    return this.config ? this.config.categories.find(cat => cat.id === categoryId) || null : null;
  }

  /**
   * Get images count for a category
   */
  getCategoryImageCount(categoryId: string): number {
    const category = this.getCategory(categoryId);
    return category ? category.images.length : 0;
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