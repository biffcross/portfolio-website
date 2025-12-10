/**
 * Environment variable configuration utilities
 * Provides type-safe access to environment variables with validation
 */

/**
 * Environment configuration interface
 */
export interface EnvironmentConfig {
  // Deployment Configuration
  customDomain: string
  
  // Cloudflare R2 Configuration
  r2PublicUrl: string
  r2AccessKeyId: string
  r2SecretAccessKey: string
  r2ApiToken: string
}

/**
 * Required environment variable names
 */
const REQUIRED_ENV_VARS = [
  'VITE_CUSTOM_DOMAIN',
  'VITE_R2_PUBLIC_URL',
  'VITE_R2_ACCESS_KEY_ID',
  'VITE_R2_SECRET_ACCESS_KEY',
  'VITE_R2_API_TOKEN'
] as const

/**
 * Environment variable validation error
 */
export class EnvironmentValidationError extends Error {
  constructor(message: string, public missingVars?: string[]) {
    super(message)
    this.name = 'EnvironmentValidationError'
  }
}

/**
 * Validates if a URL is properly formatted
 */
const isValidUrl = (url: string): boolean => {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

/**
 * Validates if a string is non-empty and properly formatted
 */
const isValidString = (value: string): boolean => {
  return typeof value === 'string' && value.trim().length > 0
}

/**
 * Validates environment variable values
 */
const validateEnvironmentValues = (config: Record<string, string>): void => {
  const errors: string[] = []

  // Validate custom domain URL
  if (!isValidUrl(config.VITE_CUSTOM_DOMAIN)) {
    errors.push('VITE_CUSTOM_DOMAIN must be a valid URL')
  }

  // Validate R2 public URL
  if (!isValidUrl(config.VITE_R2_PUBLIC_URL)) {
    errors.push('VITE_R2_PUBLIC_URL must be a valid URL')
  }

  // Validate R2 credentials are non-empty strings
  if (!isValidString(config.VITE_R2_ACCESS_KEY_ID)) {
    errors.push('VITE_R2_ACCESS_KEY_ID must be a non-empty string')
  }

  if (!isValidString(config.VITE_R2_SECRET_ACCESS_KEY)) {
    errors.push('VITE_R2_SECRET_ACCESS_KEY must be a non-empty string')
  }

  if (!isValidString(config.VITE_R2_API_TOKEN)) {
    errors.push('VITE_R2_API_TOKEN must be a non-empty string')
  }

  if (errors.length > 0) {
    throw new EnvironmentValidationError(
      `Environment validation failed: ${errors.join(', ')}`
    )
  }
}

/**
 * Loads and validates environment variables
 * @returns Validated environment configuration
 * @throws EnvironmentValidationError if validation fails
 */
export const loadEnvironmentConfig = (): EnvironmentConfig => {
  // Check for missing environment variables
  const missingVars: string[] = []
  const envVars: Record<string, string> = {}

  for (const varName of REQUIRED_ENV_VARS) {
    const value = import.meta.env[varName]
    if (!value) {
      missingVars.push(varName)
    } else {
      envVars[varName] = value
    }
  }

  if (missingVars.length > 0) {
    throw new EnvironmentValidationError(
      `Missing required environment variables: ${missingVars.join(', ')}`,
      missingVars
    )
  }

  // Validate environment variable values
  validateEnvironmentValues(envVars)

  // Return typed configuration
  return {
    customDomain: envVars.VITE_CUSTOM_DOMAIN,
    r2PublicUrl: envVars.VITE_R2_PUBLIC_URL,
    r2AccessKeyId: envVars.VITE_R2_ACCESS_KEY_ID,
    r2SecretAccessKey: envVars.VITE_R2_SECRET_ACCESS_KEY,
    r2ApiToken: envVars.VITE_R2_API_TOKEN
  }
}

/**
 * Safe environment loading that returns null instead of throwing
 * @returns Environment configuration or null if validation fails
 */
export const safeLoadEnvironmentConfig = (): EnvironmentConfig | null => {
  try {
    return loadEnvironmentConfig()
  } catch {
    return null
  }
}

/**
 * Checks if all required environment variables are present
 * @returns boolean indicating if environment is properly configured
 */
export const isEnvironmentConfigured = (): boolean => {
  return REQUIRED_ENV_VARS.every(varName => {
    const value = import.meta.env[varName]
    return value && typeof value === 'string' && value.trim().length > 0
  })
}

/**
 * Gets missing environment variables
 * @returns Array of missing environment variable names
 */
export const getMissingEnvironmentVars = (): string[] => {
  return REQUIRED_ENV_VARS.filter(varName => {
    const value = import.meta.env[varName]
    return !value || typeof value !== 'string' || value.trim().length === 0
  })
}

/**
 * Development helper to log environment configuration status
 * Only logs in development mode
 */
export const logEnvironmentStatus = (): void => {
  if (import.meta.env.DEV) {
    const missing = getMissingEnvironmentVars()
    if (missing.length > 0) {
      console.warn('Missing environment variables:', missing)
    } else {
      console.log('All required environment variables are configured')
    }
  }
}