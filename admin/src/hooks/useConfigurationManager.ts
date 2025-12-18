import { useState, useCallback } from 'react';
import { useElectronR2 } from './useElectronR2';

export interface PortfolioConfig {
  site: {
    title: string;
    description: string;
    instagram: string;
  };
  categories: Array<{
    id: string;
    name: string;
    description: string;
    images: string[];
  }>;
  images: Record<string, {
    filename: string;
    caption: string;
    description?: string;
    category: string;
    order: number;
    dimensions: { width: number; height: number };
    uploadDate: string;
  }>;
  easterEggs: {
    fireworksEnabled: boolean;
    christmasOverride: boolean;
  };
}

export interface ConfigurationManagerState {
  config: PortfolioConfig | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  lastSaved: Date | null;
  hasUnsavedChanges: boolean;
}

export interface ConfigurationManagerActions {
  loadConfiguration: () => Promise<boolean>;
  saveConfiguration: (config?: PortfolioConfig) => Promise<boolean>;
  updateConfig: (updates: Partial<PortfolioConfig>) => void;
  resetConfig: () => void;
  exportConfigToFile: () => Promise<boolean>;
  importConfigFromFile: () => Promise<boolean>;
  createDefaultConfig: () => PortfolioConfig;
}

export interface UseConfigurationManagerReturn extends ConfigurationManagerState, ConfigurationManagerActions {}

/**
 * Default portfolio configuration template
 */
const createDefaultPortfolioConfig = (): PortfolioConfig => ({
  site: {
    title: "Biff Cross Photography",
    description: "Professional photography portfolio",
    instagram: "https://instagram.com/biffcross"
  },
  categories: [
    {
      id: "sports",
      name: "Sports",
      description: "Athletic and sports photography",
      images: []
    },
    {
      id: "music",
      name: "Music",
      description: "Concert and music photography",
      images: []
    },
    {
      id: "portraiture",
      name: "Portraiture",
      description: "Portrait photography",
      images: []
    },
    {
      id: "analogue",
      name: "Analogue",
      description: "Film photography",
      images: []
    },
    {
      id: "editorial",
      name: "Editorial",
      description: "Editorial and commercial photography",
      images: []
    }
  ],
  images: {},
  easterEggs: {
    fireworksEnabled: false,
    christmasOverride: false
  }
});

/**
 * React hook for managing portfolio configuration with R2 storage
 */
export function useConfigurationManager(): UseConfigurationManagerReturn {
  const { uploadConfig, downloadConfig } = useElectronR2();
  
  const [state, setState] = useState<ConfigurationManagerState>({
    config: null,
    isLoading: false,
    isSaving: false,
    error: null,
    lastSaved: null,
    hasUnsavedChanges: false,
  });

  const setError = useCallback((error: string | null) => {
    setState(prev => ({ ...prev, error }));
  }, []);

  const setLoading = useCallback((isLoading: boolean) => {
    setState(prev => ({ ...prev, isLoading }));
  }, []);

  const setSaving = useCallback((isSaving: boolean) => {
    setState(prev => ({ ...prev, isSaving }));
  }, []);

  const createDefaultConfig = useCallback((): PortfolioConfig => {
    return createDefaultPortfolioConfig();
  }, []);

  const loadConfiguration = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const config = await downloadConfig();
      
      if (config) {
        // Validate and merge with default config to ensure all required fields exist
        const defaultConfig = createDefaultPortfolioConfig();
        const mergedConfig: PortfolioConfig = {
          site: { ...defaultConfig.site, ...config.site },
          categories: config.categories || defaultConfig.categories,
          images: config.images || defaultConfig.images,
          easterEggs: { ...defaultConfig.easterEggs, ...config.easterEggs }
        };

        setState(prev => ({
          ...prev,
          config: mergedConfig,
          isLoading: false,
          hasUnsavedChanges: false,
          error: null
        }));

        return true;
      } else {
        // No configuration found, create default
        const defaultConfig = createDefaultPortfolioConfig();
        setState(prev => ({
          ...prev,
          config: defaultConfig,
          isLoading: false,
          hasUnsavedChanges: true, // Mark as unsaved since we need to upload the default
          error: null
        }));

        return true;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load configuration';
      setError(errorMessage);
      setLoading(false);
      return false;
    }
  }, [downloadConfig]);

  const saveConfiguration = useCallback(async (configToSave?: PortfolioConfig): Promise<boolean> => {
    const config = configToSave || state.config;
    
    if (!config) {
      setError('No configuration to save');
      return false;
    }

    setSaving(true);
    setError(null);

    try {
      const success = await uploadConfig(config);
      
      if (success) {
        setState(prev => ({
          ...prev,
          isSaving: false,
          lastSaved: new Date(),
          hasUnsavedChanges: false,
          error: null
        }));

        return true;
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save configuration';
      setError(errorMessage);
      setSaving(false);
      return false;
    }
  }, [state.config, uploadConfig]);

  const updateConfig = useCallback((updates: Partial<PortfolioConfig>) => {
    setState(prev => {
      if (!prev.config) return prev;

      const updatedConfig = {
        ...prev.config,
        ...updates,
        // Deep merge for nested objects
        site: updates.site ? { ...prev.config.site, ...updates.site } : prev.config.site,
        easterEggs: updates.easterEggs ? { ...prev.config.easterEggs, ...updates.easterEggs } : prev.config.easterEggs,
      };

      return {
        ...prev,
        config: updatedConfig,
        hasUnsavedChanges: true,
        error: null
      };
    });
  }, []);

  const resetConfig = useCallback(() => {
    setState({
      config: null,
      isLoading: false,
      isSaving: false,
      error: null,
      lastSaved: null,
      hasUnsavedChanges: false,
    });
  }, []);

  const exportConfigToFile = useCallback(async (): Promise<boolean> => {
    if (!state.config) {
      setError('No configuration to export');
      return false;
    }

    try {
      // Create a downloadable JSON file
      const configJson = JSON.stringify(state.config, null, 2);
      const blob = new Blob([configJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      // Create download link
      const link = document.createElement('a');
      link.href = url;
      link.download = `portfolio-config-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up
      URL.revokeObjectURL(url);
      
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to export configuration';
      setError(errorMessage);
      return false;
    }
  }, [state.config]);

  const importConfigFromFile = useCallback(async (): Promise<boolean> => {
    try {
      // Create file input
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      
      return new Promise((resolve) => {
        input.onchange = async (event) => {
          const file = (event.target as HTMLInputElement).files?.[0];
          if (!file) {
            resolve(false);
            return;
          }

          try {
            const text = await file.text();
            const importedConfig = JSON.parse(text);
            
            // Validate imported config structure
            if (!importedConfig.site || !importedConfig.categories || !importedConfig.images) {
              throw new Error('Invalid configuration file format');
            }

            // Merge with default config to ensure all required fields
            const defaultConfig = createDefaultPortfolioConfig();
            const mergedConfig: PortfolioConfig = {
              site: { ...defaultConfig.site, ...importedConfig.site },
              categories: importedConfig.categories || defaultConfig.categories,
              images: importedConfig.images || defaultConfig.images,
              easterEggs: { ...defaultConfig.easterEggs, ...importedConfig.easterEggs }
            };

            setState(prev => ({
              ...prev,
              config: mergedConfig,
              hasUnsavedChanges: true,
              error: null
            }));

            resolve(true);
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to import configuration';
            setError(errorMessage);
            resolve(false);
          }
        };

        input.click();
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to import configuration';
      setError(errorMessage);
      return false;
    }
  }, []);

  return {
    ...state,
    loadConfiguration,
    saveConfiguration,
    updateConfig,
    resetConfig,
    exportConfigToFile,
    importConfigFromFile,
    createDefaultConfig,
  };
}