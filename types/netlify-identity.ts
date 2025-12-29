// TypeScript types for Netlify Identity
// Based on: https://github.com/netlify/netlify-identity-widget

export interface NetlifyIdentityUser {
  id: string;
  aud: string;
  role: string;
  email: string;
  confirmed_at?: string;
  confirmation_sent_at?: string;
  app_metadata: {
    provider?: string;
    roles?: string[];
    [key: string]: any;
  };
  user_metadata: {
    full_name?: string;
    avatar_url?: string;
    [key: string]: any;
  };
  created_at: string;
  updated_at?: string;
  // JWT token method
  jwt: (force?: boolean) => Promise<string>;
  // User sub (subject) - unique identifier
  sub: string;
}

export interface NetlifyIdentityWidget {
  currentUser: () => NetlifyIdentityUser | null;
  on: (event: NetlifyIdentityEvent, callback: (user?: NetlifyIdentityUser) => void) => void;
  off: (event: NetlifyIdentityEvent, callback?: (user?: NetlifyIdentityUser) => void) => void;
  open: (tab?: 'login' | 'signup') => void;
  close: () => void;
  logout: () => Promise<void>;
  refresh: (force?: boolean) => Promise<NetlifyIdentityUser | null>;
  init: (config?: NetlifyIdentityConfig) => void;
  store?: {
    user: NetlifyIdentityUser | null;
    modal: {
      page: string;
    };
  };
}

export type NetlifyIdentityEvent = 
  | 'init'
  | 'login'
  | 'logout'
  | 'error'
  | 'open'
  | 'close';

export interface NetlifyIdentityConfig {
  APIUrl?: string;
  logo?: boolean;
  namePlaceholder?: string;
  locale?: string;
}

// Extend Window interface
declare global {
  interface Window {
    netlifyIdentity?: NetlifyIdentityWidget;
  }
}

