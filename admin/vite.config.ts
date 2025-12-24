import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '')
  
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
    define: {
      // Explicitly define environment variables for production builds
      'import.meta.env.VITE_R2_ACCESS_KEY_ID': JSON.stringify(env.VITE_R2_ACCESS_KEY_ID),
      'import.meta.env.VITE_R2_SECRET_ACCESS_KEY': JSON.stringify(env.VITE_R2_SECRET_ACCESS_KEY),
      'import.meta.env.VITE_R2_PUBLIC_URL': JSON.stringify(env.VITE_R2_PUBLIC_URL),
      'import.meta.env.VITE_R2_ACCOUNT_ID': JSON.stringify(env.VITE_R2_ACCOUNT_ID),
      'import.meta.env.VITE_R2_BUCKET_NAME': JSON.stringify(env.VITE_R2_BUCKET_NAME),
    }
  }
})