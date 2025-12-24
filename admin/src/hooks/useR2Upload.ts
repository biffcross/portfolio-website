import { useState, useCallback } from 'react';
import { r2Service, UploadProgress, UploadResult, R2UploadError, R2ConfigError } from '../services/r2Service';

export interface UseR2UploadState {
  isUploading: boolean;
  progress: Record<number, UploadProgress>;
  results: UploadResult[];
  errors: Record<number, Error>;
  totalProgress: number;
}

export interface UseR2UploadActions {
  uploadFiles: (files: File[], keyGenerator?: (file: File, index: number) => string) => Promise<void>;
  uploadSingleFile: (file: File, key?: string) => Promise<UploadResult | null>;
  uploadConfig: (config: object) => Promise<UploadResult | null>;
  testConnection: () => Promise<boolean>;
  reset: () => void;
}

export interface UseR2UploadReturn extends UseR2UploadState, UseR2UploadActions {}

/**
 * React hook for R2 file uploads with progress tracking and error handling
 */
export function useR2Upload(): UseR2UploadReturn {
  const [state, setState] = useState<UseR2UploadState>({
    isUploading: false,
    progress: {},
    results: [],
    errors: {},
    totalProgress: 0,
  });

  const reset = useCallback(() => {
    setState({
      isUploading: false,
      progress: {},
      results: [],
      errors: {},
      totalProgress: 0,
    });
  }, []);

  const calculateTotalProgress = useCallback((progressMap: Record<number, UploadProgress>, fileCount: number) => {
    const progressValues = Object.values(progressMap);
    if (progressValues.length === 0) return 0;
    
    const totalPercentage = progressValues.reduce((sum, p) => sum + p.percentage, 0);
    return Math.round(totalPercentage / fileCount);
  }, []);

  const uploadFiles = useCallback(async (
    files: File[],
    keyGenerator: (file: File, index: number) => string = (file) => 
      `images/${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
  ) => {
    if (files.length === 0) return;

    setState(prev => ({
      ...prev,
      isUploading: true,
      progress: {},
      results: [],
      errors: {},
      totalProgress: 0,
    }));

    try {
      const results = await r2Service.uploadFiles(
        files,
        keyGenerator,
        // Progress callback
        (fileIndex, progress) => {
          setState(prev => {
            const newProgress = { ...prev.progress, [fileIndex]: progress };
            return {
              ...prev,
              progress: newProgress,
              totalProgress: calculateTotalProgress(newProgress, files.length),
            };
          });
        },
        // File complete callback
        (_, result) => {
          setState(prev => ({
            ...prev,
            results: [...prev.results, result],
          }));
        },
        // File error callback
        (fileIndex, error) => {
          setState(prev => ({
            ...prev,
            errors: { ...prev.errors, [fileIndex]: error },
          }));
        }
      );

      setState(prev => ({
        ...prev,
        isUploading: false,
        results,
        totalProgress: 100,
      }));

    } catch (error) {
      setState(prev => ({
        ...prev,
        isUploading: false,
        errors: { ...prev.errors, general: error instanceof Error ? error : new Error('Upload failed') },
      }));
    }
  }, [calculateTotalProgress]);

  const uploadSingleFile = useCallback(async (
    file: File,
    key?: string
  ): Promise<UploadResult | null> => {
    const fileKey = key || `images/${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

    setState(prev => ({
      ...prev,
      isUploading: true,
      progress: {},
      errors: {},
    }));

    try {
      const result = await r2Service.uploadFile(
        file,
        fileKey,
        (progress) => {
          setState(prev => ({
            ...prev,
            progress: { 0: progress },
            totalProgress: progress.percentage,
          }));
        }
      );

      setState(prev => ({
        ...prev,
        isUploading: false,
        results: [result],
        totalProgress: 100,
      }));

      return result;

    } catch (error) {
      setState(prev => ({
        ...prev,
        isUploading: false,
        errors: { 0: error instanceof Error ? error : new Error('Upload failed') },
      }));
      return null;
    }
  }, []);

  const uploadConfig = useCallback(async (config: object): Promise<UploadResult | null> => {
    setState(prev => ({
      ...prev,
      isUploading: true,
      progress: {},
      errors: {},
    }));

    try {
      const result = await r2Service.uploadConfig(config);

      setState(prev => ({
        ...prev,
        isUploading: false,
        results: [result],
        totalProgress: 100,
      }));

      return result;

    } catch (error) {
      setState(prev => ({
        ...prev,
        isUploading: false,
        errors: { config: error instanceof Error ? error : new Error('Config upload failed') },
      }));
      return null;
    }
  }, []);

  const testConnection = useCallback(async (): Promise<boolean> => {
    try {
      return await r2Service.testConnection();
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }, []);

  return {
    ...state,
    uploadFiles,
    uploadSingleFile,
    uploadConfig,
    testConnection,
    reset,
  };
}

/**
 * Hook for checking R2 configuration validity
 */
export function useR2Config() {
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
    setConfigStatus(prev => ({ ...prev, isChecking: true }));

    try {
      // Try to create the service (this validates environment variables)
      await r2Service.testConnection();
      setConfigStatus({
        isValid: true,
        error: null,
        isChecking: false,
      });
    } catch (error) {
      let errorMessage = 'Unknown configuration error';
      
      if (error instanceof R2ConfigError) {
        errorMessage = error.message;
      } else if (error instanceof R2UploadError) {
        errorMessage = `Upload service error: ${error.message}`;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      setConfigStatus({
        isValid: false,
        error: errorMessage,
        isChecking: false,
      });
    }
  }, []);

  // Check config on mount
  useState(() => {
    checkConfig();
  });

  return {
    ...configStatus,
    recheckConfig: checkConfig,
  };
}