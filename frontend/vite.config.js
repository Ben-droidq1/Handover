import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // The API and the demo site both live on the Express server.
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
      '/demo': { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
})
