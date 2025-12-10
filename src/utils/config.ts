// Configuration types and utilities

export interface SiteConfig {
  title: string
  description: string
  instagram: string
  domain: string
}

export interface CategoryConfig {
  id: string
  name: string
  description: string
  images: string[]
}

export interface ImageConfig {
  filename: string
  caption: string
  category: string
  order: number
  dimensions: {
    width: number
    height: number
  }
  uploadDate: string
}

export interface PortfolioConfig {
  site: SiteConfig
  categories: CategoryConfig[]
  images: Record<string, ImageConfig>
}

// Type guards for runtime validation
export function isSiteConfig(obj: any): obj is SiteConfig {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.title === 'string' &&
    typeof obj.description === 'string' &&
    typeof obj.instagram === 'string' &&
    typeof obj.domain === 'string'
  )
}

export function isCategoryConfig(obj: any): obj is CategoryConfig {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    typeof obj.description === 'string' &&
    Array.isArray(obj.images) &&
    obj.images.every((img: any) => typeof img === 'string')
  )
}

export function isImageConfig(obj: any): obj is ImageConfig {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.filename === 'string' &&
    typeof obj.caption === 'string' &&
    typeof obj.category === 'string' &&
    typeof obj.order === 'number' &&
    typeof obj.dimensions === 'object' &&
    obj.dimensions !== null &&
    typeof obj.dimensions.width === 'number' &&
    typeof obj.dimensions.height === 'number' &&
    typeof obj.uploadDate === 'string'
  )
}

export function isPortfolioConfig(obj: any): obj is PortfolioConfig {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    isSiteConfig(obj.site) &&
    Array.isArray(obj.categories) &&
    obj.categories.every(isCategoryConfig) &&
    typeof obj.images === 'object' &&
    obj.images !== null &&
    Object.values(obj.images).every(isImageConfig)
  )
}

// Configuration validation functions
export function validateSiteConfig(config: SiteConfig): string[] {
  const errors: string[] = []
  
  if (!config.title.trim()) {
    errors.push('Site title cannot be empty')
  }
  
  if (!config.description.trim()) {
    errors.push('Site description cannot be empty')
  }
  
  // Basic URL validation for Instagram
  if (config.instagram && !config.instagram.match(/^https?:\/\/.+/)) {
    errors.push('Instagram URL must be a valid HTTP/HTTPS URL')
  }
  
  // Basic URL validation for domain
  if (config.domain && !config.domain.match(/^https?:\/\/.+/)) {
    errors.push('Domain must be a valid HTTP/HTTPS URL')
  }
  
  return errors
}

export function validateCategoryConfig(config: CategoryConfig): string[] {
  const errors: string[] = []
  
  if (!config.id.trim()) {
    errors.push('Category ID cannot be empty')
  }
  
  if (!config.name.trim()) {
    errors.push('Category name cannot be empty')
  }
  
  if (!config.description.trim()) {
    errors.push('Category description cannot be empty')
  }
  
  // Validate category ID format (alphanumeric and hyphens only)
  if (!/^[a-z0-9-]+$/.test(config.id)) {
    errors.push('Category ID must contain only lowercase letters, numbers, and hyphens')
  }
  
  return errors
}

export function validateImageConfig(config: ImageConfig): string[] {
  const errors: string[] = []
  
  if (!config.filename.trim()) {
    errors.push('Image filename cannot be empty')
  }
  
  if (!config.category.trim()) {
    errors.push('Image category cannot be empty')
  }
  
  if (config.order < 0) {
    errors.push('Image order must be a non-negative number')
  }
  
  if (config.dimensions.width <= 0 || config.dimensions.height <= 0) {
    errors.push('Image dimensions must be positive numbers')
  }
  
  // Basic date validation
  if (!config.uploadDate || isNaN(Date.parse(config.uploadDate))) {
    errors.push('Upload date must be a valid ISO date string')
  }
  
  return errors
}

export function validatePortfolioConfig(config: PortfolioConfig): string[] {
  const errors: string[] = []
  
  // Validate site config
  errors.push(...validateSiteConfig(config.site))
  
  // Validate categories
  const categoryIds = new Set<string>()
  config.categories.forEach((category, index) => {
    const categoryErrors = validateCategoryConfig(category)
    errors.push(...categoryErrors.map(err => `Category ${index}: ${err}`))
    
    // Check for duplicate category IDs
    if (categoryIds.has(category.id)) {
      errors.push(`Duplicate category ID: ${category.id}`)
    }
    categoryIds.add(category.id)
  })
  
  // Validate images
  Object.entries(config.images).forEach(([filename, imageConfig]) => {
    const imageErrors = validateImageConfig(imageConfig)
    errors.push(...imageErrors.map(err => `Image ${filename}: ${err}`))
    
    // Ensure filename matches the key
    if (imageConfig.filename !== filename) {
      errors.push(`Image ${filename}: filename property must match object key`)
    }
    
    // Ensure image category exists
    if (!categoryIds.has(imageConfig.category)) {
      errors.push(`Image ${filename}: references non-existent category '${imageConfig.category}'`)
    }
  })
  
  // Validate that category images reference existing image objects
  config.categories.forEach(category => {
    category.images.forEach(imageName => {
      if (!config.images[imageName]) {
        errors.push(`Category ${category.id}: references non-existent image '${imageName}'`)
      }
    })
  })
  
  return errors
}

// Configuration loading and parsing utilities

export class ConfigurationError extends Error {
  constructor(message: string, public validationErrors?: string[]) {
    super(message)
    this.name = 'ConfigurationError'
  }
}

// Default fallback configuration
const DEFAULT_CONFIG: PortfolioConfig = {
  site: {
    title: 'Biff Cross Photography',
    description: 'Professional photography portfolio',
    instagram: 'https://instagram.com/biffcross',
    domain: 'https://biffcross.com'
  },
  categories: [
    {
      id: 'featured',
      name: 'Featured',
      description: 'Featured photography work',
      images: []
    }
  ],
  images: {}
}

export async function loadPortfolioConfig(configPath = '/portfolio-config.json'): Promise<PortfolioConfig> {
  try {
    // Attempt to fetch the configuration file
    const response = await fetch(configPath)
    
    if (!response.ok) {
      console.warn(`Failed to load configuration from ${configPath}: ${response.status} ${response.statusText}`)
      return getValidatedConfig(DEFAULT_CONFIG)
    }
    
    const configText = await response.text()
    return parsePortfolioConfig(configText)
    
  } catch (error) {
    console.error('Error loading portfolio configuration:', error)
    console.warn('Falling back to default configuration')
    return getValidatedConfig(DEFAULT_CONFIG)
  }
}

export function parsePortfolioConfig(configJson: string): PortfolioConfig {
  try {
    // Parse JSON
    const parsedConfig = JSON.parse(configJson)
    
    // Validate structure using type guard
    if (!isPortfolioConfig(parsedConfig)) {
      throw new ConfigurationError('Configuration does not match expected schema')
    }
    
    // Perform detailed validation
    const validationErrors = validatePortfolioConfig(parsedConfig)
    if (validationErrors.length > 0) {
      throw new ConfigurationError('Configuration validation failed', validationErrors)
    }
    
    return parsedConfig
    
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new ConfigurationError('Invalid JSON format in configuration file')
    }
    
    if (error instanceof ConfigurationError) {
      throw error
    }
    
    throw new ConfigurationError('Unknown error parsing configuration', [String(error)])
  }
}

export function getValidatedConfig(config: PortfolioConfig): PortfolioConfig {
  const validationErrors = validatePortfolioConfig(config)
  if (validationErrors.length > 0) {
    console.warn('Configuration validation warnings:', validationErrors)
    // For fallback configs, we'll still return them but log warnings
  }
  return config
}

// Utility to safely load configuration with retry mechanism
export async function loadPortfolioConfigWithRetry(
  configPath = '/portfolio-config.json',
  maxRetries = 3,
  retryDelay = 1000
): Promise<PortfolioConfig> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await loadPortfolioConfig(configPath)
    } catch (error) {
      console.warn(`Configuration load attempt ${attempt} failed:`, error)
      
      if (attempt < maxRetries) {
        console.log(`Retrying in ${retryDelay}ms...`)
        await new Promise(resolve => setTimeout(resolve, retryDelay))
        retryDelay *= 2 // Exponential backoff
      }
    }
  }
  
  console.error('All configuration load attempts failed, using default configuration')
  return getValidatedConfig(DEFAULT_CONFIG)
}

// Utility to merge partial configuration updates
export function mergePortfolioConfig(
  baseConfig: PortfolioConfig,
  updates: Partial<PortfolioConfig>
): PortfolioConfig {
  const merged: PortfolioConfig = {
    site: { ...baseConfig.site, ...updates.site },
    categories: updates.categories || baseConfig.categories,
    images: { ...baseConfig.images, ...updates.images }
  }
  
  const validationErrors = validatePortfolioConfig(merged)
  if (validationErrors.length > 0) {
    throw new ConfigurationError('Merged configuration is invalid', validationErrors)
  }
  
  return merged
}