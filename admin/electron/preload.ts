import { contextBridge, ipcRenderer } from 'electron';

// Progress callback type for upload tracking
export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

// Define the API that will be exposed to the renderer process
export interface ElectronAPI {
  // R2 Service methods
  r2: {
    uploadFile: (filePath: string, key: string, contentType?: string) => Promise<{ success: boolean; url?: string; size?: number; error?: string }>;
    uploadFileWithProgress: (filePath: string, key: string, contentType?: string) => Promise<{ success: boolean; url?: string; size?: number; error?: string }>;
    uploadConfiguration: (config: any) => Promise<{ success: boolean; error?: string }>;
    downloadConfiguration: () => Promise<{ success: boolean; config?: any; error?: string }>;
    deleteFile: (key: string) => Promise<{ success: boolean; error?: string }>;
    listFiles: (prefix?: string) => Promise<{ success: boolean; files?: string[]; error?: string }>;
    testConnection: () => Promise<{ success: boolean; connected?: boolean; error?: string }>;
    onUploadProgress: (callback: (data: { key: string; progress: UploadProgress }) => void) => any;
    removeUploadProgressListener: (handler: any) => void;
  };
  
  // File system operations
  fs: {
    selectFiles: (options?: { multiple?: boolean; filters?: any[] }) => Promise<string[]>;
    readFile: (filePath: string) => Promise<{ success: boolean; data?: Buffer; error?: string }>;
    writeFile: (filePath: string, data: Buffer) => Promise<{ success: boolean; error?: string }>;
  };
  
  // Application methods
  app: {
    getVersion: () => Promise<string>;
    quit: () => void;
    minimize: () => void;
    maximize: () => void;
    unmaximize: () => void;
    isMaximized: () => Promise<boolean>;
  };
  
  // Development utilities
  dev: {
    openDevTools: () => void;
    reload: () => void;
  };
}

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
const electronAPI: ElectronAPI = {
  r2: {
    uploadFile: (filePath: string, key: string, contentType?: string) => 
      ipcRenderer.invoke('r2:upload-file', filePath, key, contentType),
    uploadFileWithProgress: (filePath: string, key: string, contentType?: string) => 
      ipcRenderer.invoke('r2:upload-file-with-progress', filePath, key, contentType),
    uploadConfiguration: (config: any) => 
      ipcRenderer.invoke('r2:upload-config', config),
    downloadConfiguration: () => 
      ipcRenderer.invoke('r2:download-config'),
    deleteFile: (key: string) => 
      ipcRenderer.invoke('r2:delete-file', key),
    listFiles: (prefix?: string) => 
      ipcRenderer.invoke('r2:list-files', prefix),
    testConnection: () => 
      ipcRenderer.invoke('r2:test-connection'),
    onUploadProgress: (callback: (data: { key: string; progress: UploadProgress }) => void) => {
      const handler = (_event: any, data: { key: string; progress: UploadProgress }) => callback(data);
      ipcRenderer.on('r2:upload-progress', handler);
      return handler;
    },
    removeUploadProgressListener: (handler: any) => {
      ipcRenderer.removeListener('r2:upload-progress', handler);
    },
  },
  
  fs: {
    selectFiles: (options?: { multiple?: boolean; filters?: any[] }) => 
      ipcRenderer.invoke('fs:select-files', options),
    readFile: (filePath: string) => 
      ipcRenderer.invoke('fs:read-file', filePath),
    writeFile: (filePath: string, data: Buffer) => 
      ipcRenderer.invoke('fs:write-file', filePath, data),
  },
  
  app: {
    getVersion: () => ipcRenderer.invoke('app:get-version'),
    quit: () => ipcRenderer.send('app:quit'),
    minimize: () => ipcRenderer.send('app:minimize'),
    maximize: () => ipcRenderer.send('app:maximize'),
    unmaximize: () => ipcRenderer.send('app:unmaximize'),
    isMaximized: () => ipcRenderer.invoke('app:is-maximized'),
  },
  
  dev: {
    openDevTools: () => ipcRenderer.send('dev:open-devtools'),
    reload: () => ipcRenderer.send('dev:reload'),
  },
};

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electronAPI', electronAPI);
  } catch (error) {
    console.error('Failed to expose electronAPI:', error);
  }
} else {
  // @ts-ignore (define in dts file)
  window.electronAPI = electronAPI;
}

