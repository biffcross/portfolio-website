import { ipcMain, dialog, BrowserWindow, app } from 'electron';
import { readFile, writeFile } from 'fs/promises';
import { R2Service } from '../services/r2Service';

// Lazy-load R2 service to avoid startup errors
let r2Service: R2Service | null = null;

const getR2Service = (): R2Service => {
  if (!r2Service) {
    r2Service = new R2Service();
  }
  return r2Service;
};

/**
 * Register all IPC handlers
 */
export const registerIpcHandlers = (): void => {
  // R2 Service handlers
  ipcMain.handle('r2:upload-file', async (_event, filePath: string, key: string, contentType?: string) => {
    try {
      const service = getR2Service();
      const result = await service.uploadFileFromPath(filePath, key, contentType);
      return { success: true, url: result.url, size: result.size };
    } catch (error) {
      console.error('R2 upload error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Upload failed' };
    }
  });

  ipcMain.handle('r2:upload-file-with-progress', async (event, filePath: string, key: string, contentType?: string) => {
    try {
      const service = getR2Service();
      const result = await service.uploadFileFromPath(
        filePath, 
        key, 
        contentType,
        3, // maxRetries
        (progress) => {
          // Send progress updates to renderer
          event.sender.send('r2:upload-progress', { key, progress });
        }
      );
      return { success: true, url: result.url, size: result.size };
    } catch (error) {
      console.error('R2 upload with progress error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Upload failed' };
    }
  });

  ipcMain.handle('r2:upload-config', async (_event, config: any) => {
    try {
      const service = getR2Service();
      await service.uploadConfiguration(config);
      return { success: true };
    } catch (error) {
      console.error('R2 config upload error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Config upload failed' };
    }
  });

  ipcMain.handle('r2:download-config', async (_event) => {
    try {
      const service = getR2Service();
      const config = await service.downloadConfiguration();
      return { success: true, config };
    } catch (error) {
      console.error('R2 config download error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Config download failed' };
    }
  });

  ipcMain.handle('r2:delete-file', async (_event, key: string) => {
    try {
      const service = getR2Service();
      await service.deleteFile(key);
      return { success: true };
    } catch (error) {
      console.error('R2 delete error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Delete failed' };
    }
  });

  ipcMain.handle('r2:delete-files', async (_event, keys: string[]) => {
    try {
      const service = getR2Service();
      const results = await service.deleteFiles(keys);
      return { success: true, results };
    } catch (error) {
      console.error('R2 batch delete error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Batch delete failed' };
    }
  });

  ipcMain.handle('r2:list-files', async (_event, prefix?: string) => {
    try {
      const service = getR2Service();
      const files = await service.listFiles(prefix);
      return { success: true, files };
    } catch (error) {
      console.error('R2 list error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'List failed' };
    }
  });

  ipcMain.handle('r2:test-connection', async (_event) => {
    try {
      const service = getR2Service();
      const isConnected = await service.testConnection();
      return { success: true, connected: isConnected };
    } catch (error) {
      console.error('R2 connection test error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Connection test failed' };
    }
  });

  // File system handlers
  ipcMain.handle('fs:select-files', async (_event, options?: { multiple?: boolean; filters?: any[] }) => {
    try {
      const result = await dialog.showOpenDialog({
        properties: options?.multiple ? ['openFile', 'multiSelections'] : ['openFile'],
        filters: options?.filters || [
          { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      return result.canceled ? [] : result.filePaths;
    } catch (error) {
      console.error('File selection error:', error);
      return [];
    }
  });

  ipcMain.handle('fs:read-file', async (_event, filePath: string) => {
    try {
      const data = await readFile(filePath);
      return { success: true, data };
    } catch (error) {
      console.error('File read error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Read failed' };
    }
  });

  ipcMain.handle('fs:write-file', async (_event, filePath: string, data: Buffer) => {
    try {
      await writeFile(filePath, data);
      return { success: true };
    } catch (error) {
      console.error('File write error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Write failed' };
    }
  });

  // Application handlers
  ipcMain.handle('app:get-version', () => {
    return app.getVersion();
  });

  ipcMain.on('app:quit', () => {
    app.quit();
  });

  ipcMain.on('app:minimize', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    window?.minimize();
  });

  ipcMain.on('app:maximize', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window?.isMaximized()) {
      window.unmaximize();
    } else {
      window?.maximize();
    }
  });

  ipcMain.on('app:unmaximize', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    window?.unmaximize();
  });

  ipcMain.handle('app:is-maximized', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    return window?.isMaximized() || false;
  });

  // Development handlers
  ipcMain.on('dev:open-devtools', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    window?.webContents.openDevTools();
  });

  ipcMain.on('dev:reload', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    window?.webContents.reload();
  });
};

/**
 * Unregister all IPC handlers
 */
export const unregisterIpcHandlers = (): void => {
  // Remove all listeners
  ipcMain.removeAllListeners('r2:upload-file');
  ipcMain.removeAllListeners('r2:upload-file-with-progress');
  ipcMain.removeAllListeners('r2:upload-config');
  ipcMain.removeAllListeners('r2:download-config');
  ipcMain.removeAllListeners('r2:delete-file');
  ipcMain.removeAllListeners('r2:delete-files');
  ipcMain.removeAllListeners('r2:list-files');
  ipcMain.removeAllListeners('r2:test-connection');
  ipcMain.removeAllListeners('fs:select-files');
  ipcMain.removeAllListeners('fs:read-file');
  ipcMain.removeAllListeners('fs:write-file');
  ipcMain.removeAllListeners('app:get-version');
  ipcMain.removeAllListeners('app:quit');
  ipcMain.removeAllListeners('app:minimize');
  ipcMain.removeAllListeners('app:maximize');
  ipcMain.removeAllListeners('app:unmaximize');
  ipcMain.removeAllListeners('app:is-maximized');
  ipcMain.removeAllListeners('dev:open-devtools');
  ipcMain.removeAllListeners('dev:reload');
};