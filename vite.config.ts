import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, (process as any).cwd(), '');
  
  // Prioritize system variables, then .env variables, checking common names
  // We also check VITE_ prefixed vars in case user followed standard Vite conventions
  const apiKey = env.API_KEY || env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY || process.env.API_KEY || process.env.GEMINI_API_KEY || '';

  return {
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
    // Define global constants replacement
    define: {
      // Safely replace process.env.API_KEY with the string value from the environment
      'process.env.API_KEY': JSON.stringify(apiKey),
      // Custom global for robust access
      '__GEMINI_KEY__': JSON.stringify(apiKey)
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
  };
});