import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const API_TARGET = process.env.API_TARGET || 'http://localhost:3045';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: { '/api': API_TARGET },
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 600,
  },
});
