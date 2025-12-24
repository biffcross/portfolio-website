import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';

// Environment variable validation
interface R2Config {
  accessKeyId: string;
  secretAccessKey: string;
  endpoint: string;
  region: string;
  bucketName: string;
}

class R2ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'R2ConfigError';
  }
}

class R2UploadError extends Error {
  constructor(message: string, public originalError?: Error) {
    super(message);
    this.name = 'R2UploadError';
  }
}

// Validate and extract R2 configuration from environment variables
function validateR2Config(): R2Config {
  const accessKeyId = import.meta.env.VITE_R2_ACCESS_KEY_ID;
  const secretAccessKey = import.meta.env.VITE_R2_SECRET_ACCESS_KEY;
  const publicUrl = import.meta.env.VITE_R2_PUBLIC_URL;
  const accountId = import.meta.env.VITE_R2_ACCOUNT_ID;
  const bucketName = import.meta.env.VITE_R2_BUCKET_NAME;

  if (!accessKeyId) {
    throw new R2ConfigError('VITE_R2_ACCESS_KEY_ID environment variable is required');
  }

  if (!secretAccessKey) {
    throw new R2ConfigError('VITE_R2_SECRET_ACCESS_KEY environment variable is required');
  }

  if (!publicUrl) {
    throw new R2ConfigError('VITE_R2_PUBLIC_URL environment variable is required');
  }

  if (!accountId) {
    throw new R2ConfigError('VITE_R2_ACCOUNT_ID environment variable is required');
  }

  if (!bucketName) {
    throw new R2ConfigError('VITE_R2_BUCKET_NAME environment variable is required');
  }
  
  return {
    accessKeyId,
    secretAccessKey,
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    region: 'auto', // Cloudflare R2 uses 'auto' as region
    bucketName
  };
}

// Progress callback type for upload tracking
export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export type ProgressCallback = (progress: UploadProgress) => void;

// Upload result interface
export interface UploadResult {
  key: string;
  url: string;
  size: number;
}

class R2Service {
  private s3Client: S3Client;
  private config: R2Config;

  constructor() {
    try {
      this.config = validateR2Config();
      this.s3Client = new S3Client({
        region: this.config.region,
        endpoint: this.config.endpoint,
        credentials: {
          accessKeyId: this.config.accessKeyId,
          secretAccessKey: this.config.secretAccessKey,
        },
        // Force path-style addressing for R2 compatibility
        forcePathStyle: false,
      });
    } catch (error) {
      if (error instanceof R2ConfigError) {
        throw error;
      }
      throw new R2ConfigError(`Failed to initialize R2 service: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Upload a single file to R2 with progress tracking and retry logic
   */
  async uploadFile(
    file: File,
    key: string,
    onProgress?: ProgressCallback,
    maxRetries: number = 3
  ): Promise<UploadResult> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const upload = new Upload({
          client: this.s3Client,
          params: {
            Bucket: this.config.bucketName,
            Key: key,
            Body: file,
            ContentType: file.type || 'application/octet-stream',
            // Add metadata for tracking
            Metadata: {
              'original-name': file.name,
              'upload-timestamp': new Date().toISOString(),
            },
          },
          // Configure multipart upload for large files
          partSize: 1024 * 1024 * 10, // 10MB parts
          queueSize: 4, // Upload 4 parts concurrently
        });

        // Track upload progress
        if (onProgress) {
          upload.on('httpUploadProgress', (progress) => {
            if (progress.loaded !== undefined && progress.total !== undefined) {
              onProgress({
                loaded: progress.loaded,
                total: progress.total,
                percentage: Math.round((progress.loaded / progress.total) * 100),
              });
            }
          });
        }

        await upload.done();

        // Construct the public URL
        const publicUrl = `${import.meta.env.VITE_R2_PUBLIC_URL}/${key}`;

        return {
          key,
          url: publicUrl,
          size: file.size,
        };

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown upload error');
        
        if (attempt === maxRetries) {
          break;
        }

        // Exponential backoff: wait 2^attempt seconds before retry
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw new R2UploadError(
      `Failed to upload file "${file.name}" after ${maxRetries} attempts: ${lastError?.message}`,
      lastError || undefined
    );
  }

  /**
   * Upload multiple files with progress tracking
   */
  async uploadFiles(
    files: File[],
    keyGenerator: (file: File, index: number) => string,
    onProgress?: (fileIndex: number, progress: UploadProgress) => void,
    onFileComplete?: (fileIndex: number, result: UploadResult) => void,
    onFileError?: (fileIndex: number, error: Error) => void
  ): Promise<UploadResult[]> {
    const results: UploadResult[] = [];
    const errors: { index: number; error: Error }[] = [];

    // Upload files sequentially to avoid overwhelming the service
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const key = keyGenerator(file, i);

      try {
        const result = await this.uploadFile(
          file,
          key,
          onProgress ? (progress) => onProgress(i, progress) : undefined
        );

        results.push(result);
        onFileComplete?.(i, result);

      } catch (error) {
        const uploadError = error instanceof Error ? error : new Error('Unknown error');
        errors.push({ index: i, error: uploadError });
        onFileError?.(i, uploadError);
      }
    }

    if (errors.length > 0) {
      const errorMessage = `Failed to upload ${errors.length} out of ${files.length} files`;
      throw new R2UploadError(errorMessage);
    }

    return results;
  }

  /**
   * Delete a file from R2 storage
   */
  async deleteFile(key: string, maxRetries: number = 3): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Use fetch with DELETE method for R2 deletion
        // Note: This requires proper CORS configuration on R2 bucket
        const deleteUrl = `${this.config.endpoint}/${this.config.bucketName}/${key}`;
        
        const response = await fetch(deleteUrl, {
          method: 'DELETE',
          headers: {
            'Authorization': `AWS4-HMAC-SHA256 Credential=${this.config.accessKeyId}/${new Date().toISOString().slice(0, 10)}/auto/s3/aws4_request`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return; // Success

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown deletion error');
        
        if (attempt === maxRetries) {
          break;
        }

        // Exponential backoff: wait 2^attempt seconds before retry
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw new R2UploadError(
      `Failed to delete file "${key}" after ${maxRetries} attempts: ${lastError?.message}`,
      lastError || undefined
    );
  }

  /**
   * Delete multiple files from R2 storage
   */
  async deleteFiles(keys: string[], maxRetries: number = 3): Promise<{ success: string[], failed: { key: string, error: string }[] }> {
    const results = {
      success: [] as string[],
      failed: [] as { key: string, error: string }[]
    };

    // Delete files sequentially to avoid overwhelming the service
    for (const key of keys) {
      try {
        await this.deleteFile(key, maxRetries);
        results.success.push(key);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.failed.push({ key, error: errorMessage });
      }
    }

    return results;
  }

  /**
   * Upload configuration file (portfolio-config.json) to R2
   */
  async uploadConfig(config: object): Promise<UploadResult> {
    const configJson = JSON.stringify(config, null, 2);
    const configBlob = new Blob([configJson], { type: 'application/json' });
    const configFile = new File([configBlob], 'portfolio-config.json', { type: 'application/json' });

    return this.uploadFile(configFile, 'portfolio-config.json');
  }

  /**
   * Test the R2 connection and configuration
   */
  async testConnection(): Promise<boolean> {
    try {
      // Try to upload a small test file
      const testContent = 'R2 connection test';
      const testBlob = new Blob([testContent], { type: 'text/plain' });
      const testFile = new File([testBlob], 'connection-test.txt', { type: 'text/plain' });
      
      await this.uploadFile(testFile, 'test/connection-test.txt');
      return true;
    } catch (error) {
      console.error('R2 connection test failed:', error);
      return false;
    }
  }

  /**
   * Get the public URL for a given key
   */
  getPublicUrl(key: string): string {
    return `${import.meta.env.VITE_R2_PUBLIC_URL}/${key}`;
  }
}

// Export singleton instance
export const r2Service = new R2Service();
export { R2ConfigError, R2UploadError };