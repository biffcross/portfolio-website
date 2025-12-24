#!/usr/bin/env node

/**
 * Build script for Electron production builds
 * Handles environment variable injection for production
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔧 Building Electron app for production...');

// Load environment variables from .env file
const envPath = path.join(__dirname, '../.env');
const envVars = {};

if (fs.existsSync(envPath)) {
  console.log('📄 Loading environment variables from .env file...');
  const envContent = fs.readFileSync(envPath, 'utf8');
  
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        envVars[key.trim()] = valueParts.join('=').trim();
      }
    }
  });
  
  console.log(`✅ Loaded ${Object.keys(envVars).length} environment variables`);
} else {
  console.warn('⚠️  No .env file found, using system environment variables');
}

// Set environment variables for the build process
const requiredVars = [
  'VITE_R2_ACCESS_KEY_ID',
  'VITE_R2_SECRET_ACCESS_KEY', 
  'VITE_R2_PUBLIC_URL',
  'VITE_R2_ACCOUNT_ID',
  'VITE_R2_BUCKET_NAME'
];

console.log('🔍 Validating required environment variables...');
const missingVars = requiredVars.filter(varName => {
  const value = envVars[varName] || process.env[varName];
  if (!value) {
    return true;
  }
  // Set the environment variable for the build process
  process.env[varName] = value;
  console.log(`✓ ${varName}: ${value.substring(0, 10)}...`);
  return false;
});

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingVars.join(', '));
  console.error('Please ensure these are set in your .env file or system environment');
  process.exit(1);
}

console.log('✅ All required environment variables are present');

try {
  // Run the standard build process
  console.log('🏗️  Building React app...');
  execSync('npm run build', { 
    stdio: 'inherit',
    env: { ...process.env } // Ensure environment variables are passed
  });
  
  console.log('🔧 Compiling Electron TypeScript...');
  execSync('tsc -p tsconfig.electron.json', { stdio: 'inherit' });
  
  console.log('📦 Building Electron app...');
  execSync('electron-builder', { stdio: 'inherit' });
  
  console.log('🎉 Electron build completed successfully!');
  
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}