#!/usr/bin/env node

/**
 * Generate runtime configuration from environment variables
 * This script runs during build to embed environment variables into the build
 */

import fs from 'fs'
import path from 'path'

const generateConfig = () => {
  const config = {
    r2PublicUrl: process.env.VITE_R2_PUBLIC_URL || 'https://pub-example.r2.dev',
    customDomain: process.env.VITE_CUSTOM_DOMAIN || 'https://localhost:5173',
    buildTime: new Date().toISOString()
  }

  // Ensure public directory exists
  const publicDir = path.join(process.cwd(), 'public')
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true })
  }

  // Write runtime config as JSON file
  const configPath = path.join(publicDir, 'runtime-config.json')
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2))

  // Also create a JavaScript file that can be included in HTML
  const jsConfigPath = path.join(publicDir, 'runtime-config.js')
  const jsContent = `window.__RUNTIME_CONFIG__ = ${JSON.stringify(config, null, 2)};`
  fs.writeFileSync(jsConfigPath, jsContent)

  console.log('Generated runtime configuration:', config)
  console.log('Config written to:', configPath)
  console.log('JS Config written to:', jsConfigPath)
}

generateConfig()