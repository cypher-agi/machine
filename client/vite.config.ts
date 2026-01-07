import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // React core
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Data fetching & state
          'vendor-data': ['@tanstack/react-query', 'zustand'],
          // Terminal (xterm is heavy)
          'vendor-terminal': ['@xterm/xterm', '@xterm/addon-fit', '@xterm/addon-web-links'],
          // UI libraries
          'vendor-ui': ['framer-motion', 'lucide-react'],
          // Utilities
          'vendor-utils': ['date-fns', 'clsx'],
        },
      },
    },
  },
});
