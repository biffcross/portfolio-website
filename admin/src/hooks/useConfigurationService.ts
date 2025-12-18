import { useState, useEffect, useCallback, useRef } from 'react';
import { ConfigurationService, ConfigurationUpdateResult, R2ServiceInterface } from '../services/ConfigurationService';
import { PortfolioConfig } from './useConfigurationManager';
import { useElectronAPI } from './useElectronAPI';

/**
 * R2 Service adapter for Electron API
 */
class ElectronR2ServiceAdapter implements R2ServiceInterface {
  constructor(private electronAPI: any) {}

  async uploadConfiguration(config: any): Promise<void> {
    const result = await this.electronAPI.r2.uploadConfiguration(config);
    if (!result.success) {
      throw new Error(result.error || 'Failed to upload configuration');
    }
  }

  async downloadConfiguration(): Promise<any> {
    const result = await this.electronAPI.r2.downloadConfiguration();
    if (!result.success) {
      if (result.error?.includes('not found') || result.error?.includes('NoSuchKey')) {
        return null; // No configuration exists yet - matches portfolio website behavior
      }
      throw new Error(result.error || 'Failed to download configuration');
    }
    return result.config;
  }

  async testConnection(): Promise<boolean> {
    const result = await this.electronAPI.r2.testConnection();
    return result.success && result.connected === true;
  }
}

export interface UseConfigurationServiceState {
  config: PortfolioConfig | null;
  isLoaded: boolean;
  isLoading: boolean;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  lastSaved: Date | null;
  error: string | null;
  connectionStatus: 'unknown' | 'connected' | 'disconnected' | 'testing';
}

export interface UseConfigurationServiceActions {
  loadConfiguration: () => Promise<boolean>;
  addImage: (
    filename: string,
    category: string,
    caption?: string,
    description?: string,
    dimensions?: { width: number; height: number }
  ) => Promise<boolean>;
  updateImage: (
    filename: string,
    updates: {
      caption?: string;
      description?: string;
      category?: string;
      order?: number;
    }
  ) => Promise<boolean>;
  removeImage: (filename: string) => Promise<boolean>;
  reorderImagesInCategory: (category: string, orderedFilenames: string[]) => Promise<boolean>;
  updateEasterEggSettings: (settings: Partial<PortfolioConfig['easterEggs']>) => Promise<boolean>;
  testConnection: () => Promise<boolean>;
  refreshConfiguration: () => Promise<boolean>;
  getDiagnostics: () => any;
}

export interface UseConfigurationServiceReturn extends UseConfigurationServiceState, UseConfigurationServiceActions {}

/**
 * React hook for using the ConfigurationService with automatic R2 sync
 * This hook provides a clean interface for configuration management without exposing JSON operations
 */
export function useConfigurationService(): UseConfigurationServiceReturn {
  const electronAPI = useElectronAPI();
  const configServiceRef = useRef<ConfigurationService | null>(null);
  
  const [state, setState] = useState<UseConfigurationServiceState>({
    config: null,
    isLoaded: false,
    isLoading: false,
    isSaving: false,
    hasUnsavedChanges: false,
    lastSaved: null,
    error: null,
    connectionStatus: 'unknown'
  });

  // Initialize configuration service when Electron API is available
  useEffect(() => {
    if (electronAPI && !configServiceRef.current) {
      const r2Adapter = new ElectronR2ServiceAdapter(electronAPI);
      configServiceRef.current = new ConfigurationService(r2Adapter);

      // Set up event listeners
      const unsubscribeChange = configServiceRef.current.onConfigurationChange((config) => {
        setState(prev => ({ ...prev, config }));
      });

      const unsubscribeError = configServiceRef.current.onError((error) => {
        setState(prev => ({ ...prev, error }));
      });

      const unsubscribeSave = configServiceRef.current.onSave((success) => {
        if (success) {
          setState(prev => ({ ...prev, error: null }));
        }
      });

      // Cleanup function
      return () => {
        unsubscribeChange();
        unsubscribeError();
        unsubscribeSave();
      };
    }
  }, [electronAPI]);

  // Update state when configuration service status changes
  useEffect(() => {
    if (configServiceRef.current) {
      const updateStatus = () => {
        const status = configServiceRef.current!.getStatus();
        setState(prev => ({
          ...prev,
          isLoaded: status.isLoaded,
          isLoading: status.isLoading,
          isSaving: status.isSaving,
          hasUnsavedChanges: status.hasUnsavedChanges,
          lastSaved: status.lastSaved
        }));
      };

      // Update status periodically
      const interval = setInterval(updateStatus, 1000);
      updateStatus(); // Initial update

      return () => clearInterval(interval);
    }
  }, [configServiceRef.current]);

  const handleResult = useCallback((result: ConfigurationUpdateResult): boolean => {
    if (result.success) {
      setState(prev => ({ ...prev, error: null }));
      return true;
    } else {
      setState(prev => ({ ...prev, error: result.error || 'Operation failed' }));
      return false;
    }
  }, []);

  const loadConfiguration = useCallback(async (): Promise<boolean> => {
    if (!configServiceRef.current) {
      setState(prev => ({ ...prev, error: 'Configuration service not initialized' }));
      return false;
    }

    setState(prev => ({ ...prev, error: null }));
    
    try {
      const result = await configServiceRef.current.loadConfiguration();
      return handleResult(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load configuration';
      setState(prev => ({ ...prev, error: errorMessage }));
      return false;
    }
  }, [handleResult]);

  const addImage = useCallback(async (
    filename: string,
    category: string,
    caption: string = '',
    description: string = '',
    dimensions: { width: number; height: number } = { width: 0, height: 0 }
  ): Promise<boolean> => {
    if (!configServiceRef.current) {
      setState(prev => ({ ...prev, error: 'Configuration service not initialized' }));
      return false;
    }

    setState(prev => ({ ...prev, error: null }));

    try {
      const result = await configServiceRef.current.addImage(
        filename,
        category,
        caption,
        description,
        dimensions
      );
      return handleResult(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to add image';
      setState(prev => ({ ...prev, error: errorMessage }));
      return false;
    }
  }, [handleResult]);

  const updateImage = useCallback(async (
    filename: string,
    updates: {
      caption?: string;
      description?: string;
      category?: string;
      order?: number;
    }
  ): Promise<boolean> => {
    if (!configServiceRef.current) {
      setState(prev => ({ ...prev, error: 'Configuration service not initialized' }));
      return false;
    }

    setState(prev => ({ ...prev, error: null }));

    try {
      const result = await configServiceRef.current.updateImage(filename, updates);
      return handleResult(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update image';
      setState(prev => ({ ...prev, error: errorMessage }));
      return false;
    }
  }, [handleResult]);

  const removeImage = useCallback(async (filename: string): Promise<boolean> => {
    if (!configServiceRef.current) {
      setState(prev => ({ ...prev, error: 'Configuration service not initialized' }));
      return false;
    }

    setState(prev => ({ ...prev, error: null }));

    try {
      const result = await configServiceRef.current.removeImage(filename);
      return handleResult(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to remove image';
      setState(prev => ({ ...prev, error: errorMessage }));
      return false;
    }
  }, [handleResult]);

  const reorderImagesInCategory = useCallback(async (
    category: string,
    orderedFilenames: string[]
  ): Promise<boolean> => {
    if (!configServiceRef.current) {
      setState(prev => ({ ...prev, error: 'Configuration service not initialized' }));
      return false;
    }

    setState(prev => ({ ...prev, error: null }));

    try {
      const result = await configServiceRef.current.reorderImagesInCategory(category, orderedFilenames);
      return handleResult(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to reorder images';
      setState(prev => ({ ...prev, error: errorMessage }));
      return false;
    }
  }, [handleResult]);

  const updateEasterEggSettings = useCallback(async (
    settings: Partial<PortfolioConfig['easterEggs']>
  ): Promise<boolean> => {
    if (!configServiceRef.current) {
      setState(prev => ({ ...prev, error: 'Configuration service not initialized' }));
      return false;
    }

    setState(prev => ({ ...prev, error: null }));

    try {
      const result = await configServiceRef.current.updateEasterEggSettings(settings);
      return handleResult(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update easter egg settings';
      setState(prev => ({ ...prev, error: errorMessage }));
      return false;
    }
  }, [handleResult]);

  const testConnection = useCallback(async (): Promise<boolean> => {
    if (!configServiceRef.current) {
      setState(prev => ({ ...prev, connectionStatus: 'disconnected' }));
      return false;
    }

    setState(prev => ({ ...prev, connectionStatus: 'testing' }));

    try {
      const isConnected = await configServiceRef.current.testConnection();
      setState(prev => ({ 
        ...prev, 
        connectionStatus: isConnected ? 'connected' : 'disconnected' 
      }));
      return isConnected;
    } catch (error) {
      setState(prev => ({ ...prev, connectionStatus: 'disconnected' }));
      return false;
    }
  }, []);

  const refreshConfiguration = useCallback(async (): Promise<boolean> => {
    // Same as loadConfiguration but explicitly named for clarity
    return await loadConfiguration();
  }, [loadConfiguration]);

  const getDiagnostics = useCallback(() => {
    if (!configServiceRef.current) {
      return {
        error: 'Configuration service not initialized',
        configUrl: 'unknown',
        environmentValid: false
      };
    }
    
    return configServiceRef.current.getDiagnostics();
  }, []);

  return {
    ...state,
    loadConfiguration,
    addImage,
    updateImage,
    removeImage,
    reorderImagesInCategory,
    updateEasterEggSettings,
    testConnection,
    refreshConfiguration,
    getDiagnostics
  };
}

/**
 * Hook for getting configuration data in a read-only manner
 * Useful for components that only need to display configuration data
 */
export function useConfigurationData(): {
  config: PortfolioConfig | null;
  isLoaded: boolean;
  isLoading: boolean;
  error: string | null;
} {
  const { config, isLoaded, isLoading, error } = useConfigurationService();
  
  return {
    config,
    isLoaded,
    isLoading,
    error
  };
}