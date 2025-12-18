/**
 * Environment utilities for Electron main process
 */
import { app } from 'electron';

export const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

export const isProduction = !isDev;

export const getAppDataPath = (): string => {
  return app.getPath('userData');
};

export const getAppVersion = (): string => {
  return app.getVersion();
};

export const getPlatform = (): NodeJS.Platform => {
  return process.platform;
};

export const isWindows = (): boolean => {
  return process.platform === 'win32';
};

export const isMacOS = (): boolean => {
  return process.platform === 'darwin';
};

export const isLinux = (): boolean => {
  return process.platform === 'linux';
};