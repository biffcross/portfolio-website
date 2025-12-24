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
    console.log('\n=== R2Service Initialization ===');
    console.log(`Endpoint: ${this.config.endpoint}`);
    console.log(`Bucket Name: ${this.config.bucketName}`);
    console.log(`Region: ${this.config.region}`);
    console.log(`Public URL: ${this.config.publicUrl}`);
    console.log(`Access Key ID: ${this.config.accessKeyId.substring(0, 8)}...`);
    console.log(`Secret Key Length: ${this.config.secretAccessKey.length} chars`);
    console.log('=== R2Service Ready ===\n');
    
    this.s3Client = new S3Client({
      region: this.config.region,
      endpoint: this.config.endpoint,
      credentials: {
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey,
      },
      forcePathStyle: false,
    });
    
    console.log('S3Client created with configuration:', {
      region: this.config.region,
      endpoint: this.config.endpoint,
      forcePathStyle: false,
      credentialsProvided: !!(this.config.accessKeyId && this.config.secretAccessKey)
    });
  }

  /**
   * Validate and extract R2 configuration from environment variables
   */
  private validateR2Config(): R2Config {
    // Import config utility here to avoid circular dependencies
    const { getElectronConfig } = require('../utils/config');
    
    try {
      console.log('\n--- R2 Configuration Validation ---');
      console.log('Loading R2 configuration from environment variables...');
      const electronConfig = getElectronConfig();
      
      console.log('Raw environment config loaded:', {
        r2AccountId: electronConfig.r2AccountId,
        r2BucketName: electronConfig.r2BucketName,
        r2PublicUrl: electronConfig.r2PublicUrl,
        r2AccessKeyId: electronConfig.r2AccessKeyId ? `${electronConfig.r2AccessKeyId.substring(0, 8)}...` : 'NOT SET',
        r2SecretAccessKey: electronConfig.r2SecretAccessKey ? `${electronConfig.r2SecretAccessKey.length} chars` : 'NOT SET',
        configFilename: electronConfig.configFilename
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
        publicUrl: config.publicUrl,
        accessKeyId: config.accessKeyId ? `${config.accessKeyId.substring(0, 8)}...` : 'NOT SET',
        secretAccessKey: config.secretAccessKey ? `${config.secretAccessKey.length} chars` : 'NOT SET'
      });
      console.log('--- Configuration Validation Complete ---\n');
      
      return config;
    } catch (error) {
      console.error('--- R2 Configuration Validation Failed ---');
      console.error('Error details:', error);
      console.error('--- Validation Error End ---\n');
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

    console.log(`\n--- R2 Buffer Upload Details ---`);
    console.log(`Key: ${key}`);
    console.log(`Buffer Size: ${buffer.length} bytes`);
    console.log(`Content Type: ${contentType || 'application/octet-stream'}`);
    console.log(`Max Retries: ${maxRetries}`);
    console.log(`S3 Client Config:`);
    console.log(`  - Region: ${this.config.region}`);
    console.log(`  - Endpoint: ${this.config.endpoint}`);
    console.log(`  - Bucket: ${this.config.bucketName}`);
    console.log(`  - Access Key: ${this.config.accessKeyId.substring(0, 8)}...`);
    console.log(`--- Starting Upload ---`);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`\nAttempt ${attempt}/${maxRetries}:`);
        
        const uploadParams = {
          Bucket: this.config.bucketName,
          Key: key,
          Body: buffer,
          ContentType: contentType || 'application/octet-stream',
          Metadata: {
            'upload-timestamp': new Date().toISOString(),
          },
        };
        
        console.log(`Upload Parameters:`);
        console.log(`  - Bucket: ${uploadParams.Bucket}`);
        console.log(`  - Key: ${uploadParams.Key}`);
        console.log(`  - ContentType: ${uploadParams.ContentType}`);
        console.log(`  - Body Size: ${uploadParams.Body.length} bytes`);
        console.log(`  - Metadata:`, uploadParams.Metadata);
        
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
              console.log(`Upload Progress: ${progress.loaded}/${progress.total} bytes (${Math.round((progress.loaded / progress.total) * 100)}%)`);
              onProgress({
                loaded: progress.loaded,
                total: progress.total,
                percentage: Math.round((progress.loaded / progress.total) * 100),
              });
            }
          });
        }

        console.log(`Executing upload with 30 second timeout...`);
        
        // Create a timeout promise
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Upload timeout after 30 seconds')), 30000);
        });
        
        // Race between upload and timeout
        await Promise.race([upload.done(), timeoutPromise]);
        
        console.log(`✓ Upload completed successfully on attempt ${attempt}`);

        // Construct the public URL
        const publicUrl = `${this.config.publicUrl}/${key}`;
        console.log(`Constructed Public URL: ${publicUrl}`);

        const result = {
          key,
          url: publicUrl,
          size: buffer.length,
        };
        
        console.log(`Final Result:`, result);
        return result;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown upload error');
        console.log(`✗ Upload attempt ${attempt} failed:`);
        console.log(`  Error Name: ${lastError.name}`);
        console.log(`  Error Message: ${lastError.message}`);
        console.log(`  Error Stack:`, lastError.stack);
        console.log(`  Bucket: ${this.config.bucketName}`);
        console.log(`  Endpoint: ${this.config.endpoint}`);
        console.log(`  Key: ${key}`);
        
        if (attempt === maxRetries) {
          break;
        }

        // Exponential backoff: wait 2^attempt seconds before retry
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    console.log(`\n--- Upload Failed After All Attempts ---`);
    console.log(`All ${maxRetries} attempts failed for buffer upload`);
    console.log(`Target bucket: ${this.config.bucketName}`);
    console.log(`Endpoint: ${this.config.endpoint}`);
    console.log(`Key: ${key}`);
    console.log(`Final error: ${lastError?.message}`);
    console.log(`--- End Upload Failure ---\n`);
    
    throw new R2UploadError(
      `Failed to upload buffer after ${maxRetries} attempts: ${lastError?.message}`,
      lastError || undefined
    );
  }

  /**
   * Upload portfolio configuration to R2
   */
  async uploadConfiguration(config: any): Promise<void> {
    try {
      const configJson = JSON.stringify(config, null, 2);
      const configBuffer = Buffer.from(configJson, 'utf-8');

      // Use configFilename from environment
      const { getElectronConfig } = require('../utils/config');
      const electronConfig = getElectronConfig();
      
      console.log(`\n=== Configuration Upload Debug ===`);
      console.log(`Target file: ${electronConfig.configFilename}`);
      console.log(`Config size: ${configBuffer.length} bytes`);
      console.log(`Bucket Name: ${this.config.bucketName}`);
      console.log(`Endpoint: ${this.config.endpoint}`);
      console.log(`Public URL Base: ${this.config.publicUrl}`);
      console.log(`Region: ${this.config.region}`);
      console.log(`Access Key ID: ${this.config.accessKeyId.substring(0, 8)}...`);
      console.log(`Full Upload URL: ${this.config.endpoint}/${this.config.bucketName}/${electronConfig.configFilename}`);
      console.log(`Expected Public URL: ${this.config.publicUrl}/${electronConfig.configFilename}`);
      console.log(`Config Preview:`, configJson.substring(0, 200) + '...');
      
      console.log(`🚀 Starting upload to R2...`);
      const result = await this.uploadFile(configBuffer, electronConfig.configFilename, 'application/json');
      
      console.log(`✅ UPLOAD SUCCESSFUL!`);
      console.log(`📁 File uploaded to: ${result.key}`);
      console.log(`🌐 Public URL: ${result.url}`);
      console.log(`📊 File Size: ${result.size} bytes`);
      
      // Verify the upload by trying to fetch the config from the public URL
      console.log(`🔍 Verifying upload by fetching from public URL...`);
      try {
        const verifyResponse = await fetch(result.url);
        if (verifyResponse.ok) {
          const verifyText = await verifyResponse.text();
          const verifyConfig = JSON.parse(verifyText);
          console.log(`✅ VERIFICATION SUCCESSFUL!`);
          console.log(`📋 Config verified - Easter eggs:`, verifyConfig.easterEggs);
          console.log(`📏 Verified config size: ${verifyText.length} bytes`);
        } else {
          console.log(`⚠️ Verification failed - HTTP ${verifyResponse.status}: ${verifyResponse.statusText}`);
          console.log(`🔗 Tried to fetch: ${result.url}`);
        }
      } catch (verifyError) {
        console.log(`⚠️ Verification error:`, verifyError instanceof Error ? verifyError.message : 'Unknown error');
        console.log(`🔗 Tried to fetch: ${result.url}`);
      }
      
      console.log(`=== Upload Complete ===\n`);
      
    } catch (error) {
      console.error(`\n❌ CONFIGURATION UPLOAD FAILED!`);
      console.error(`💥 Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error(`📚 Error Stack:`, error instanceof Error ? error.stack : 'No stack trace');
      console.error(`🪣 Bucket Name: ${this.config.bucketName}`);
      console.error(`🔗 Endpoint: ${this.config.endpoint}`);
      console.error(`🌐 Public URL Base: ${this.config.publicUrl}`);
      console.error(`🔑 Access Key ID: ${this.config.accessKeyId.substring(0, 8)}...`);
      console.error(`=== Upload Failed ===\n`);
      throw error;
    }
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
  async deleteFile(key: string, maxRetries: number = 3): Promise<void> {
    let lastError: Error | null = null;

    console.log(`\n=== R2 Delete Operation ===`);
    console.log(`Target Key: ${key}`);
    console.log(`Bucket: ${this.config.bucketName}`);
    console.log(`Max Retries: ${maxRetries}`);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`\n--- Delete Attempt ${attempt}/${maxRetries} ---`);
        
        const command = new DeleteObjectCommand({
          Bucket: this.config.bucketName,
          Key: key,
        });

        console.log(`Delete command parameters:`, {
          Bucket: this.config.bucketName,
          Key: key
        });

        await this.s3Client.send(command);
        console.log(`✓ Delete successful on attempt ${attempt}`);
        return;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown deletion error');
        console.log(`✗ Delete attempt ${attempt} failed:`, {
          error: lastError.message,
          errorName: lastError.name,
          bucket: this.config.bucketName,
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

    console.log(`\n=== Delete Failed ===`);
    console.log(`All ${maxRetries} attempts failed for key: ${key}`);
    console.log(`Target bucket: ${this.config.bucketName}`);
    console.log(`Final error: ${lastError?.message}`);
    
    throw new Error(`Failed to delete file "${key}" after ${maxRetries} attempts: ${lastError?.message}`);
  }

  /**
   * Delete multiple files from R2 storage
   */
  async deleteFiles(keys: string[], maxRetries: number = 3): Promise<{ success: string[], failed: { key: string, error: string }[] }> {
    console.log(`\n=== R2 Batch Delete Operation ===`);
    console.log(`Keys to delete: ${keys.length}`);
    console.log(`Keys:`, keys);

    const results = {
      success: [] as string[],
      failed: [] as { key: string, error: string }[]
    };

    // Delete files sequentially to avoid overwhelming the service
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      console.log(`\n--- Processing ${i + 1}/${keys.length}: ${key} ---`);
      
      try {
        await this.deleteFile(key, maxRetries);
        results.success.push(key);
        console.log(`✓ Successfully deleted: ${key}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.failed.push({ key, error: errorMessage });
        console.log(`✗ Failed to delete: ${key} - ${errorMessage}`);
      }
    }

    console.log(`\n=== Batch Delete Complete ===`);
    console.log(`Successful deletions: ${results.success.length}`);
    console.log(`Failed deletions: ${results.failed.length}`);
    
    if (results.failed.length > 0) {
      console.log(`Failed keys:`, results.failed.map(f => f.key));
    }

    return results;
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