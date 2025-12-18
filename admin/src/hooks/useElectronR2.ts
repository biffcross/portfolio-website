import { useState, useCallback, useEffect } from 'react';
import { useElectronAPI } from './useElectronAPI';

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface UploadResult {
  key: string;
  url: string;
  size: number;
}

export interface UseElectronR2State {
  isUploading: boolean;
  progress: Record<string, UploadProgress>;
  results: UploadResult[];
  errors: Record<string, Error>;
  totalProgress: number;
}

export interface UseElectronR2Actions {
  uploadFiles: (filePaths: string[], keyGenerator?: (filePath: string, index: number) => string) => Promise<void>;
  uploadSingleFile: (filePath: string, key?: string, contentType?: string) => Promise<UploadResult | null>;
  uploadConfig: (config: object) => Promise<boolean>;
  downloadConfig: () => Promise<any>;
  testConnection: () => Promise<boolean>;
  reset: () => void;
}

export interface UseElectronR2Return extends UseElectronR2State, UseElectronR2Actions {}

/**
 * React hook for R2 file uploads through Electron with progress tracking and error handling
 */
export function useElectronR2(): UseElectronR2Return {
  const electronAPI = useElectronAPI();
  
  const [state, setState] = useState<UseElectronR2State>({
    isUploading: false,
    progress: {},
    results: [],
    errors: {},
    totalProgress: 0,
  });

  // Set up progress listener
  useEffect(() => {
    if (!electronAPI) return;

    const handleProgress = (data: { key: string; progress: UploadProgress }) => {
      setState(prev => ({
        ...prev,
        progress: { ...prev.progress, [data.key]: data.progress },
      }));
    };

    const handler = electronAPI.r2.onUploadProgress(handleProgress);

    return () => {
      electronAPI.r2.removeUploadProgressListener(handler);
    };
  }, [electronAPI]);

  const reset = useCallback(() => {
    setState({
      isUploading: false,
      progress: {},
      results: [],
      errors: {},
      totalProgress: 0,
    });
  }, []);

  const calculateTotalProgress = useCallback((progressMap: Record<string, UploadProgress>, fileCount: number) => {
    const progressValues = Object.values(progressMap);
    if (progressValues.length === 0) return 0;
    
    const totalPercentage = progressValues.reduce((sum, p) => sum + p.percentage, 0);
    return Math.round(totalPercentage / fileCount);
  }, []);

  const uploadFiles = useCallback(async (
    filePaths: string[],
    keyGenerator: (filePath: string, index: number) => string = (filePath, index) => {
      const fileName = filePath.split(/[\\/]/).pop() || 'unknown';
      return `images/${Date.now()}-${index}-${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    }
  ) => {
    if (!electronAPI || filePaths.length === 0) return;

    setState(prev => ({
      ...prev,
      isUploading: true,
      progress: {},
      results: [],
      errors: {},
      totalProgress: 0,
    }));

    const results: UploadResult[] = [];
    const errors: Record<string, Error> = {};

    // Upload files sequentially to avoid overwhelming the service
    for (let i = 0; i < filePaths.length; i++) {
      const filePath = filePaths[i];
      const key = keyGenerator(filePath, i);

      try {
        // Determine content type based on file extension
        const extension = filePath.split('.').pop()?.toLowerCase();
        let contentType = 'application/octet-stream';
        
        if (extension) {
          const imageTypes: Record<string, string> = {
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'webp': 'image/webp',
            'svg': 'image/svg+xml',
          };
          contentType = imageTypes[extension] || contentType;
        }

        const result = await electronAPI.r2.uploadFileWithProgress(filePath, key, contentType);
        
        if (result.success && result.url && result.size !== undefined) {
          const uploadResult: UploadResult = {
            key,
            url: result.url,
            size: result.size,
          };
          results.push(uploadResult);
          
          setState(prev => ({
            ...prev,
            results: [...prev.results, uploadResult],
          }));
        } else {
          throw new Error(result.error || 'Upload failed');
        }

      } catch (error) {
        const uploadError = error instanceof Error ? error : new Error('Unknown error');
        errors[key] = uploadError;
        
        setState(prev => ({
          ...prev,
          errors: { ...prev.errors, [key]: uploadError },
        }));
      }
    }

    setState(prev => ({
      ...prev,
      isUploading: false,
      totalProgress: Object.keys(errors).length === 0 ? 100 : 0,
    }));

    if (Object.keys(errors).length > 0) {
      throw new Error(`Failed to upload ${Object.keys(errors).length} out of ${filePaths.length} files`);
    }
  }, [electronAPI, calculateTotalProgress]);

  const uploadSingleFile = useCallback(async (
    filePath: string,
    key?: string,
    contentType?: string
  ): Promise<UploadResult | null> => {
    if (!electronAPI) return null;

    const fileName = filePath.split(/[\\/]/).pop() || 'unknown';
    const fileKey = key || `images/${Date.now()}-${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

    // Determine content type if not provided
    if (!contentType) {
      const extension = filePath.split('.').pop()?.toLowerCase();
      if (extension) {
        const imageTypes: Record<string, string> = {
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'png': 'image/png',
          'gif': 'image/gif',
          'webp': 'image/webp',
          'svg': 'image/svg+xml',
        };
        contentType = imageTypes[extension] || 'application/octet-stream';
      }
    }

    setState(prev => ({
      ...prev,
      isUploading: true,
      progress: {},
      errors: {},
    }));

    try {
      const result = await electronAPI.r2.uploadFileWithProgress(filePath, fileKey, contentType);
      
      if (result.success && result.url && result.size !== undefined) {
        const uploadResult: UploadResult = {
          key: fileKey,
          url: result.url,
          size: result.size,
        };

        setState(prev => ({
          ...prev,
          isUploading: false,
          results: [uploadResult],
          totalProgress: 100,
        }));

        return uploadResult;
      } else {
        throw new Error(result.error || 'Upload failed');
      }

    } catch (error) {
      setState(prev => ({
        ...prev,
        isUploading: false,
        errors: { [fileKey]: error instanceof Error ? error : new Error('Upload failed') },
      }));
      return null;
    }
  }, [electronAPI]);

  const uploadConfig = useCallback(async (config: object): Promise<boolean> => {
    if (!electronAPI) return false;

    setState(prev => ({
      ...prev,
      isUploading: true,
      progress: {},
      errors: {},
    }));

    try {
      const result = await electronAPI.r2.uploadConfiguration(config);

      setState(prev => ({
        ...prev,
        isUploading: false,
        totalProgress: 100,
      }));

      return result.success;

    } catch (error) {
      setState(prev => ({
        ...prev,
        isUploading: false,
        errors: { config: error instanceof Error ? error : new Error('Config upload failed') },
      }));
      return false;
    }
  }, [electronAPI]);

  const downloadConfig = useCallback(async (): Promise<any> => {
    if (!electronAPI) return null;

    try {
      const result = await electronAPI.r2.downloadConfiguration();
      
      if (result.success) {
        return result.config;
      } else {
        throw new Error(result.error || 'Config download failed');
      }

    } catch (error) {
      console.error('Config download failed:', error);
      return null;
    }
  }, [electronAPI]);

  const testConnection = useCallback(async (): Promise<boolean> => {
    if (!electronAPI) return false;

    try {
      const result = await electronAPI.r2.testConnection();
      return result.success && result.connected === true;
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }, [electronAPI]);

  return {
    ...state,
    uploadFiles,
    uploadSingleFile,
    uploadConfig,
    downloadConfig,
    testConnection,
    reset,
  };
}

/**
 * Hook for checking R2 configuration validity through Electron
 */
export function useElectronR2Config() {
  const electronAPI = useElectronAPI();
  
  const [configStatus, setConfigStatus] = useState<{
    isValid: boolean;
    error: string | null;
    isChecking: boolean;
  }>({
    isValid: false,
    error: null,
    isChecking: true,
  });

  const checkConfig = useCallback(async () => {
    if (!electronAPI) {
      setConfigStatus({
        isValid: false,
        error: 'Electron API not available',
        isChecking: false,
      });
      return;
    }

    setConfigStatus(prev => ({ ...prev, isChecking: true }));

    try {
      const result = await electronAPI.r2.testConnection();
      
      if (result.success && result.connected) {
        setConfigStatus({
          isValid: true,
          error: null,
          isChecking: false,
        });
      } else {
        setConfigStatus({
          isValid: false,
          error: result.error || 'Connection test failed',
          isChecking: false,
        });
      }
    } catch (error) {
      setConfigStatus({
        isValid: false,
        error: error instanceof Error ? error.message : 'Unknown configuration error',
        isChecking: false,
      });
    }
  }, [electronAPI]);

  // Check config when electronAPI becomes available
  useEffect(() => {
    if (electronAPI) {
      checkConfig();
    }
  }, [electronAPI, checkConfig]);

  return {
    ...configStatus,
    recheckConfig: checkConfig,
  };
}