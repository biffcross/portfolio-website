import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { readFile } from 'fs/promises';

/**
 * R2 Service for Electron main process
 * This service handles Cloudflare R2 operations without CORS restrictions
 */

interface R2Config {
  accessKeyId: string;
  secretAccessKey: string;
  endpoint: string;
  region: string;
  bucketName: string;
  publicUrl: string;
}

interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

interface UploadResult {
  key: string;
  url: string;
  size: number;
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

export class R2Service {
  private s3Client: S3Client;
  private config: R2Config;

  constructor() {
    this.config = this.validateR2Config();
    
    // Log configuration details (without sensitive data)
    console.log('R2Service initialized with configuration:');
    console.log(`  Endpoint: ${this.config.endpoint}`);
    console.log(`  Bucket Name: ${this.config.bucketName}`);
    console.log(`  Region: ${this.config.region}`);
    console.log(`  Public URL: ${this.config.publicUrl}`);
    console.log(`  Access Key ID: ${this.config.accessKeyId.substring(0, 8)}...`);
    
    this.s3Client = new S3Client({
      region: this.config.region,
      endpoint: this.config.endpoint,
      credentials: {
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey,
      },
      forcePathStyle: false,
    });
  }

  /**
   * Validate and extract R2 configuration from environment variables
   */
  private validateR2Config(): R2Config {
    // Import config utility here to avoid circular dependencies
    const { getElectronConfig } = require('../utils/config');
    
    try {
      console.log('Loading R2 configuration from environment variables...');
      const electronConfig = getElectronConfig();
      
      console.log('Raw environment config loaded:', {
        r2AccountId: electronConfig.r2AccountId,
        r2BucketName: electronConfig.r2BucketName,
        r2PublicUrl: electronConfig.r2PublicUrl,
        r2AccessKeyId: electronConfig.r2AccessKeyId ? `${electronConfig.r2AccessKeyId.substring(0, 8)}...` : 'NOT SET'
      });
      
      const config = {
        accessKeyId: electronConfig.r2AccessKeyId,
        secretAccessKey: electronConfig.r2SecretAccessKey,
        endpoint: `https://${electronConfig.r2AccountId}.r2.cloudflarestorage.com`,
        region: 'auto', // Cloudflare R2 uses 'auto' as region
        bucketName: electronConfig.r2BucketName,
        publicUrl: electronConfig.r2PublicUrl
      };
      
      console.log('Final R2 config constructed:', {
        endpoint: config.endpoint,
        bucketName: config.bucketName,
        region: config.region,
        publicUrl: config.publicUrl
      });
      
      return config;
    } catch (error) {
      console.error('R2 configuration validation failed:', error);
      if (error instanceof Error) {
        throw new R2ConfigError(`R2 configuration error: ${error.message}`);
      }
      throw new R2ConfigError('Unknown R2 configuration error');
    }
  }

  /**
   * Upload a file to R2 storage from file path
   */
  async uploadFileFromPath(
    filePath: string,
    key: string,
    contentType?: string,
    maxRetries: number = 3,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadResult> {
    let lastError: Error | null = null;

    // Log upload attempt details
    console.log(`\n=== R2 Upload Attempt ===`);
    console.log(`File Path: ${filePath}`);
    console.log(`Target Key: ${key}`);
    console.log(`Bucket Name: ${this.config.bucketName}`);
    console.log(`Endpoint: ${this.config.endpoint}`);
    console.log(`Content Type: ${contentType || 'application/octet-stream'}`);
    console.log(`Max Retries: ${maxRetries}`);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`\n--- Upload Attempt ${attempt}/${maxRetries} ---`);
        
        const fileBuffer = await readFile(filePath);
        console.log(`File size: ${fileBuffer.length} bytes`);
        
        const uploadParams = {
          Bucket: this.config.bucketName,
          Key: key,
          Body: fileBuffer,
          ContentType: contentType || 'application/octet-stream',
          Metadata: {
            'upload-timestamp': new Date().toISOString(),
          },
        };
        
        console.log(`Upload parameters:`, {
          Bucket: uploadParams.Bucket,
          Key: uploadParams.Key,
          ContentType: uploadParams.ContentType,
          BodySize: uploadParams.Body.length,
          Metadata: uploadParams.Metadata
        });
        
        const upload = new Upload({
          client: this.s3Client,
          params: uploadParams,
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
        console.log(`✓ Upload successful on attempt ${attempt}`);

        // Construct the public URL
        const publicUrl = `${this.config.publicUrl}/${key}`;
        console.log(`Public URL: ${publicUrl}`);

        return {
          key,
          url: publicUrl,
          size: fileBuffer.length,
        };

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown upload error');
        console.log(`✗ Upload attempt ${attempt} failed:`, {
          error: lastError.message,
          errorName: lastError.name,
          bucket: this.config.bucketName,
          endpoint: this.config.endpoint,
          key: key
        });
        
        if (attempt === maxRetries) {
          break;
        }

        // Exponential backoff: wait 2^attempt seconds before retry
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    console.log(`\n=== Upload Failed ===`);
    console.log(`All ${maxRetries} attempts failed for file: ${filePath}`);
    console.log(`Target bucket: ${this.config.bucketName}`);
    console.log(`Endpoint: ${this.config.endpoint}`);
    console.log(`Final error: ${lastError?.message}`);
    
    throw new R2UploadError(
      `Failed to upload file "${filePath}" to bucket "${this.config.bucketName}" at endpoint "${this.config.endpoint}" after ${maxRetries} attempts: ${lastError?.message}`,
      lastError || undefined
    );
  }

  /**
   * Upload a file to R2 storage from buffer
   */
  async uploadFile(
    buffer: Buffer,
    key: string,
    contentType?: string,
    maxRetries: number = 3,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadResult> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const upload = new Upload({
          client: this.s3Client,
          params: {
            Bucket: this.config.bucketName,
            Key: key,
            Body: buffer,
            ContentType: contentType || 'application/octet-stream',
            Metadata: {
              'upload-timestamp': new Date().toISOString(),
            },
          },
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
        const publicUrl = `${this.config.publicUrl}/${key}`;

        return {
          key,
          url: publicUrl,
          size: buffer.length,
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
      `Failed to upload buffer after ${maxRetries} attempts: ${lastError?.message}`,
      lastError || undefined
    );
  }

  /**
   * Upload portfolio configuration to R2
   */
  async uploadConfiguration(config: any): Promise<void> {
    const configJson = JSON.stringify(config, null, 2);
    const configBuffer = Buffer.from(configJson, 'utf-8');

    // Use configFilename from environment
    const { getElectronConfig } = require('../utils/config');
    const electronConfig = getElectronConfig();
    
    console.log(`Uploading configuration to: ${electronConfig.configFilename}`);
    await this.uploadFile(configBuffer, electronConfig.configFilename, 'application/json');
  }

  /**
   * Download portfolio configuration from R2
   * Uses the same loading mechanism as the Portfolio_Website for consistency
   */
  async downloadConfiguration(): Promise<any> {
    // Get configFilename from environment
    const { getElectronConfig } = require('../utils/config');
    const electronConfig = getElectronConfig();
    
    try {
      console.log('Downloading configuration from R2...');
      console.log(`Bucket: ${this.config.bucketName}`);
      console.log(`Key: ${electronConfig.configFilename}`);
      
      const command = new GetObjectCommand({
        Bucket: this.config.bucketName,
        Key: electronConfig.configFilename,
      });

      const response = await this.s3Client.send(command);
      
      if (!response.Body) {
        throw new Error('No configuration data received');
      }

      // Convert stream to string
      const chunks: Uint8Array[] = [];
      const reader = response.Body.transformToWebStream().getReader();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      const configData = Buffer.concat(chunks).toString('utf-8');
      console.log(`Configuration data size: ${configData.length} bytes`);
      
      const parsedConfig = JSON.parse(configData);
      console.log('Configuration parsed successfully');
      
      return parsedConfig;

    } catch (error) {
      if (error instanceof Error && (error.name === 'NoSuchKey' || error.message.includes('NoSuchKey'))) {
        console.log('Portfolio configuration not found in R2 storage - this is normal for first-time setup');
        return null; // Return null instead of throwing, matching portfolio website behavior
      }
      
      console.error('Failed to download configuration from R2:', error);
      throw new Error(`Failed to download configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete a file from R2 storage
   */
  async deleteFile(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.config.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
    } catch (error) {
      throw new Error(`Failed to delete file "${key}": ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * List files in R2 storage
   */
  async listFiles(prefix?: string): Promise<string[]> {
    try {
      const command = new ListObjectsV2Command({
        Bucket: this.config.bucketName,
        Prefix: prefix,
        MaxKeys: 1000, // Limit to prevent overwhelming responses
      });

      const response = await this.s3Client.send(command);
      
      return response.Contents?.map(obj => obj.Key || '') || [];
    } catch (error) {
      throw new Error(`Failed to list files: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Test the R2 connection and configuration
   */
  async testConnection(): Promise<boolean> {
    try {
      // Try to upload a small test file
      const testContent = 'R2 connection test';
      const testBuffer = Buffer.from(testContent, 'utf-8');
      
      await this.uploadFile(testBuffer, 'test/connection-test.txt', 'text/plain');
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
    return `${this.config.publicUrl}/${key}`;
  }
}