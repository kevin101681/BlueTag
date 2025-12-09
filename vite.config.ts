
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
  
  // Prioritize GEMINI_API_KEY as per README, then API_KEY, then VITE_ prefixes
  const apiKey = env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY || env.API_KEY || env.VITE_API_KEY || process.env.GEMINI_API_KEY || process.env.API_KEY || '';

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
      // Inject the key via a custom global for reliability
      '__GEMINI_KEY__': JSON.stringify(apiKey),
      // Polyfill process.env for code that expects it (preventing crash on access)
      'process.env': JSON.stringify({
          API_KEY: apiKey,
          GEMINI_API_KEY: apiKey,
          NODE_ENV: mode
      }),
      // explicit replacement for process.env.API_KEY in case of direct usage match
      'process.env.API_KEY': JSON.stringify(apiKey)
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
