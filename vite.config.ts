import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import compression from 'vite-plugin-compression'

export default defineConfig({
  server: {
    host: '127.0.0.1',
    allowedHosts: ['.trycloudflare.com'],
    proxy: {
      '/analyze': 'http://localhost:8001',
    },
  },
  plugins: [
    react(),
    compression({ algorithm: 'brotliCompress' }),
  ],
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
        },
      },
    },
  },
})
