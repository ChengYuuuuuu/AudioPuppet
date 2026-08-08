import type { Plugin } from 'vite'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import compression from 'vite-plugin-compression'

function removeUnusedOrtWasm(): Plugin {
  return {
    name: 'remove-unused-ort-wasm',
    generateBundle(_options, bundle) {
      for (const name of Object.keys(bundle)) {
        const base = name.split('/').pop() ?? name
        if (base.startsWith('ort-wasm-') && base.endsWith('.wasm')) {
          delete bundle[name]
          console.log('[cleanup] dropped unused wasm asset:', name)
        }
      }
    },
  }
}

export default defineConfig({
  server: {
    host: '127.0.0.1',
    allowedHosts: ['.trycloudflare.com'],
  },
  optimizeDeps: {
    exclude: ['onnxruntime-web'],
  },
  plugins: [
    react(),
    compression({ algorithm: 'brotliCompress' }),
    removeUnusedOrtWasm(),
  ],
  build: {
    sourcemap: false,
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'vendor';
          }
          if (id.includes('node_modules/onnxruntime-web')) {
            return 'ort';
          }
        },
      },
    },
  },
})
