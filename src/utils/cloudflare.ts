// Cloudflare R2 URL construction utilities
import { safeLoadEnvironmentConfig } from './env'

// Load R2 configuration from environment variables
const getR2BaseUrl = (): string => {
  const config = safeLoadEnvironmentConfig()
  return config?.r2PublicUrl || 'https://pub-example.r2.dev'
}

export const R2_BASE_URL = getR2BaseUrl()

// Supported image formats
const VALID_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tiff', '.svg']
const MAX_FILENAME_LENGTH = 255

/**
 * Validates if a filename is a valid image file
 * @param filename - The filename to validate
 * @returns boolean indicating if the filename is valid
 */
export const validateImageFilename = (filename: string): boolean => {
  if (!filename || typeof filename !== 'string') {
    return false
  }

  // Check length
  if (filename.length === 0 || filename.length > MAX_FILENAME_LENGTH) {
    return false
  }

  // Check for valid extension
  const hasValidExtension = VALID_IMAGE_EXTENSIONS.some(ext => 
    filename.toLowerCase().endsWith(ext)
  )

  if (!hasValidExtension) {
    return false
  }

  // Check for invalid characters (basic validation)
  const invalidChars = /[<>:"|?*\x00-\x1f]/
  if (invalidChars.test(filename)) {
    return false
  }

  // Check for reserved names (Windows)
  const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)/i
  if (reservedNames.test(filename)) {
    return false
  }

  return true
}

/**
 * Constructs a full URL for an image stored in Cloudflare R2
 * @param filename - The image filename
 * @returns The complete URL or throws an error for invalid filenames
 */
export const constructImageUrl = (filename: string): string => {
  if (!validateImageFilename(filename)) {
    throw new Error(`Invalid image filename: ${filename}`)
  }

  // Ensure base URL doesn't end with slash and filename doesn't start with slash
  const baseUrl = R2_BASE_URL.replace(/\/$/, '')
  const cleanFilename = filename.replace(/^\//, '')
  
  return `${baseUrl}/${encodeURIComponent(cleanFilename)}`
}

/**
 * Constructs multiple image URLs from an array of filenames
 * @param filenames - Array of image filenames
 * @returns Array of URLs, filtering out invalid filenames
 */
export const constructImageUrls = (filenames: string[]): string[] => {
  return filenames
    .filter(validateImageFilename)
    .map(constructImageUrl)
}

/**
 * Extracts filename from a full R2 URL
 * @param url - The full R2 URL
 * @returns The filename or null if invalid URL
 */
export const extractFilenameFromUrl = (url: string): string | null => {
  try {
    const urlObj = new URL(url)
    const pathname = urlObj.pathname
    const filename = decodeURIComponent(pathname.split('/').pop() || '')
    
    return validateImageFilename(filename) ? filename : null
  } catch {
    return null
  }
}

/**
 * Validates if a URL is a valid R2 image URL
 * @param url - The URL to validate
 * @returns boolean indicating if the URL is valid
 */
export const validateImageUrl = (url: string): boolean => {
  try {
    const urlObj = new URL(url)
    
    // Check if it's from our R2 domain
    const baseUrlObj = new URL(R2_BASE_URL)
    if (urlObj.hostname !== baseUrlObj.hostname) {
      return false
    }

    // Extract and validate filename
    const filename = extractFilenameFromUrl(url)
    return filename !== null
  } catch {
    return false
  }
}

/**
 * Error class for R2 URL construction errors
 */
export class R2UrlError extends Error {
  constructor(message: string, public filename?: string) {
    super(message)
    this.name = 'R2UrlError'
  }
}

/**
 * Safe URL construction that returns null instead of throwing
 * @param filename - The image filename
 * @returns The URL or null if invalid
 */
export const safeConstructImageUrl = (filename: string): string | null => {
  try {
    return constructImageUrl(filename)
  } catch {
    return null
  }
}