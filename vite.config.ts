
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
    }
  },
  publicDir: 'public', 
  build: {
    outDir: 'dist',
  },
  server: {
    host: '0.0.0.0',
    port: process.env.PORT ? Number(process.env.PORT) : 8080,
  },
  preview: {
    host: '0.0.0.0',
    port: process.env.PORT ? Number(process.env.PORT) : 8080,
    allowedHosts: true,
  }
});
