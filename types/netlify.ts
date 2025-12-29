/**
 * TypeScript type definitions for Netlify Functions and Identity
 */

export interface NetlifyUser {
  sub: string; // Unique user ID
  email?: string;
  user_metadata?: {
    full_name?: string;
    avatar_url?: string;
    [key: string]: any;
  };
  app_metadata?: {
    provider?: string;
    roles?: string[];
    [key: string]: any;
  };
}

export interface NetlifyClientContext {
  identity?: {
    url: string;
    token: string;
  };
  user?: NetlifyUser;
}

export interface NetlifyFunctionEvent {
  path: string;
  httpMethod: string;
  headers: { [key: string]: string };
  queryStringParameters: { [key: string]: string } | null;
  body: string | null;
  isBase64Encoded: boolean;
}

export interface NetlifyFunctionContext {
  callbackWaitsForEmptyEventLoop?: boolean;
  clientContext?: NetlifyClientContext;
}

export interface NetlifyFunctionResponse {
  statusCode: number;
  headers?: { [key: string]: string };
  body: string;
  isBase64Encoded?: boolean;
}

export type NetlifyFunctionHandler = (
  event: NetlifyFunctionEvent,
  context: NetlifyFunctionContext
) => Promise<NetlifyFunctionResponse> | NetlifyFunctionResponse;

// Netlify Identity Widget types for window object
export interface NetlifyIdentityWidget {
  currentUser: () => NetlifyUser | null;
  init: (config?: any) => void;
  open: (tab?: 'login' | 'signup') => void;
  close: () => void;
  logout: () => void;
  refresh: (force?: boolean) => Promise<NetlifyUser | null>;
  on: (event: 'init' | 'login' | 'logout' | 'error' | 'open' | 'close', callback: (user?: NetlifyUser) => void) => void;
  off: (event: string, callback?: Function) => void;
  setLocale: (locale: string) => void;
}

declare global {
  interface Window {
    netlifyIdentity?: NetlifyIdentityWidget;
  }
}


