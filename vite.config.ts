import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import legacy from '@vitejs/plugin-legacy';
import { fileURLToPath, URL } from 'node:url';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    legacy({
      targets: ['Chrome >= 70', 'Android >= 7'],
      modernPolyfills: true,
      additionalLegacyPolyfills: ['regenerator-runtime/runtime'],
    }),
  ],
  build: {
    target: ['es2015', 'chrome70'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
