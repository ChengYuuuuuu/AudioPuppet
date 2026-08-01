import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import compression from 'vite-plugin-compression'
import { viteStaticCopy } from 'vite-plugin-static-copy'

export default defineConfig({
  server: {
    host: '127.0.0.1',
    allowedHosts: ['.trycloudflare.com'],
    proxy: {
      '/analyze': 'http://localhost:8001',
      '/log-alignment': 'http://localhost:8001',
    },
  },
  optimizeDeps: {
    exclude: ['onnxruntime-web'],
  },
  plugins: [
    react(),
    compression({ algorithm: 'brotliCompress' }),
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded*.{mjs,wasm}',
          dest: 'wasm',
          rename: { stripBase: true },
        },
      ],
    }),
  ],
  build: {
    sourcemap: false,
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
