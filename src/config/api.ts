const isDev = import.meta.env.DEV;

export const API_URL =
  import.meta.env.VITE_API_URL ||
  (isDev ? 'http://localhost:3001' : 'https://dev-api.devbench.in');

export const OAUTH_REDIRECT_URL =
  import.meta.env.VITE_OAUTH_REDIRECT_URL ||
  (isDev ? 'http://localhost:5173/auth/callback' : 'devbench://auth/callback');
