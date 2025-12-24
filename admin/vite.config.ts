import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'
import { join } from 'path'

// Load environment variables from .env file
function loadEnvVars() {
  try {
    const envPath = join(__dirname, '.env')
    const envContent = readFileSync(envPath, 'utf8')
    const envVars: Record<string, string> = {}
    
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=')
        if (key && valueParts.length > 0) {
          envVars[key.trim()] = valueParts.join('=').trim()
        }
      }
    })
    
    return envVars
  } catch (error) {
    console.warn('Could not load .env file:', error)
    return {}
  }
}

// https://vitejs.dev/config/
export default defineConfig(() => {
  const envVars = loadEnvVars()
  
  console.log('🔍 Vite config - loaded env vars:', Object.keys(envVars))
  console.log('🔍 Environment variables being defined:')
  console.log('  - VITE_R2_ACCESS_KEY_ID:', envVars.VITE_R2_ACCESS_KEY_ID ? `${envVars.VITE_R2_ACCESS_KEY_ID.substring(0, 10)}...` : 'MISSING')
  console.log('  - VITE_R2_SECRET_ACCESS_KEY:', envVars.VITE_R2_SECRET_ACCESS_KEY ? `${envVars.VITE_R2_SECRET_ACCESS_KEY.substring(0, 10)}...` : 'MISSING')
  console.log('  - VITE_R2_PUBLIC_URL:', envVars.VITE_R2_PUBLIC_URL || 'MISSING')
  console.log('  - VITE_R2_ACCOUNT_ID:', envVars.VITE_R2_ACCOUNT_ID || 'MISSING')
  console.log('  - VITE_R2_BUCKET_NAME:', envVars.VITE_R2_BUCKET_NAME || 'MISSING')
  
  const defineVars = {
    'import.meta.env.VITE_R2_ACCESS_KEY_ID': JSON.stringify(envVars.VITE_R2_ACCESS_KEY_ID || process.env.VITE_R2_ACCESS_KEY_ID),
    'import.meta.env.VITE_R2_SECRET_ACCESS_KEY': JSON.stringify(envVars.VITE_R2_SECRET_ACCESS_KEY || process.env.VITE_R2_SECRET_ACCESS_KEY),
    'import.meta.env.VITE_R2_PUBLIC_URL': JSON.stringify(envVars.VITE_R2_PUBLIC_URL || process.env.VITE_R2_PUBLIC_URL),
    'import.meta.env.VITE_R2_ACCOUNT_ID': JSON.stringify(envVars.VITE_R2_ACCOUNT_ID || process.env.VITE_R2_ACCOUNT_ID),
    'import.meta.env.VITE_R2_BUCKET_NAME': JSON.stringify(envVars.VITE_R2_BUCKET_NAME || process.env.VITE_R2_BUCKET_NAME),
  }
  
  console.log('🔍 Define object values:')
  Object.entries(defineVars).forEach(([key, value]) => {
    console.log(`  - ${key}: ${value}`)
  })
  
  return {
    plugins: [react()],
    server: {
      port: 8080,
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
    },
    base: './', // Use relative paths for Electron
    define: defineVars
  }
})