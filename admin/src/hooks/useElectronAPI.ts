import { useEffect, useState } from 'react';

/**
 * Hook to access Electron API safely
 */
export const useElectronAPI = () => {
  const [electronAPI, setElectronAPI] = useState<typeof window.electronAPI | null>(null);

  useEffect(() => {
    // Check if we're running in Electron
    const checkElectron = () => {
      if (typeof window !== 'undefined' && window.electronAPI) {
        setElectronAPI(window.electronAPI);
      } else {
        setElectronAPI(null);
      }
    };

    checkElectron();

    // Listen for the API to become available
    const interval = setInterval(checkElectron, 100);
    
    // Clean up after 5 seconds
    const timeout = setTimeout(() => {
      clearInterval(interval);
    }, 5000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, []);

  // Return just the electronAPI for compatibility with new hooks
  return electronAPI;
};

/**
 * Hook to get Electron API status and details
 */
export const useElectronStatus = () => {
  const [isElectron, setIsElectron] = useState(false);
  const [electronAPI, setElectronAPI] = useState<typeof window.electronAPI | null>(null);

  useEffect(() => {
    // Check if we're running in Electron
    const checkElectron = () => {
      if (typeof window !== 'undefined' && window.electronAPI) {
        setIsElectron(true);
        setElectronAPI(window.electronAPI);
      } else {
        setIsElectron(false);
        setElectronAPI(null);
      }
    };

    checkElectron();

    // Listen for the API to become available
    const interval = setInterval(checkElectron, 100);
    
    // Clean up after 5 seconds
    const timeout = setTimeout(() => {
      clearInterval(interval);
    }, 5000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, []);

  return {
    isElectron,
    electronAPI,
    // Convenience methods
    isReady: isElectron && electronAPI !== null,
  };
};

/**
 * Hook specifically for R2 operations (legacy - use useElectronR2 from useElectronR2.ts instead)
 */
export const useElectronR2Legacy = () => {
  const { electronAPI, isReady } = useElectronStatus();

  return {
    isReady,
    uploadFile: electronAPI?.r2.uploadFile,
    uploadConfiguration: electronAPI?.r2.uploadConfiguration,
    downloadConfiguration: electronAPI?.r2.downloadConfiguration,
    deleteFile: electronAPI?.r2.deleteFile,
    listFiles: electronAPI?.r2.listFiles,
  };
};

/**
 * Hook for file system operations
 */
export const useElectronFS = () => {
  const { electronAPI, isReady } = useElectronStatus();

  return {
    isReady,
    selectFiles: electronAPI?.fs.selectFiles,
    readFile: electronAPI?.fs.readFile,
    writeFile: electronAPI?.fs.writeFile,
  };
};

/**
 * Hook for app operations
 */
export const useElectronApp = () => {
  const { electronAPI, isReady } = useElectronStatus();

  return {
    isReady,
    getVersion: electronAPI?.app.getVersion,
    quit: electronAPI?.app.quit,
    minimize: electronAPI?.app.minimize,
    maximize: electronAPI?.app.maximize,
    unmaximize: electronAPI?.app.unmaximize,
    isMaximized: electronAPI?.app.isMaximized,
  };
};