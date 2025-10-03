import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // FIX: __dirname is not available in ES modules. Using a relative path from the project root.
      // Also corrected alias to point to the 'src' directory.
      '@': path.resolve('./src')
    }
  }
})