/**
 * Logging Utility for BlueTag
 * 
 * Provides conditional logging based on environment
 * In production, only errors are logged to reduce console noise
 */

const IS_DEVELOPMENT = import.meta.env.DEV || import.meta.env.MODE === 'development';
const IS_DEBUG = import.meta.env.VITE_DEBUG === 'true';

export const logger = {
  /**
   * Log debug information (only in development or when DEBUG flag is set)
   */
  debug: (...args: any[]) => {
    if (IS_DEVELOPMENT || IS_DEBUG) {
      console.log('[DEBUG]', ...args);
    }
  },

  /**
   * Log general information (only in development or when DEBUG flag is set)
   */
  info: (...args: any[]) => {
    if (IS_DEVELOPMENT || IS_DEBUG) {
      console.info('[INFO]', ...args);
    }
  },

  /**
   * Log warnings (always logged)
   */
  warn: (...args: any[]) => {
    console.warn('[WARN]', ...args);
  },

  /**
   * Log errors (always logged)
   */
  error: (...args: any[]) => {
    console.error('[ERROR]', ...args);
  },

  /**
   * Log a message regardless of environment (use sparingly)
   */
  always: (...args: any[]) => {
    console.log(...args);
  }
};

// For backwards compatibility, export individual functions
export const { debug, info, warn, error } = logger;

export default logger;


