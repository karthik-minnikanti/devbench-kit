import axios from 'axios';

// Ensure API URL is always localhost:3001 for desktop app
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface User {
    id: string;
    email: string;
    name?: string;
    avatar?: string;
}

export async function loginWithGoogle(): Promise<void> {
    // If we're in Electron, use the Electron OAuth window
    if (typeof window !== 'undefined' && window.electronAPI?.auth?.openOAuth) {
        try {
            // For Electron, use a special redirect URL that the OAuth window can catch
            // The backend will redirect to this URL with the token
            const redirectUrl = 'http://localhost:5173/auth/callback';
            const oauthUrl = `${API_URL}/api/auth/google?redirect=${encodeURIComponent(redirectUrl)}`;
            
            const token = await window.electronAPI.auth.openOAuth(oauthUrl);
            // Store the token
            storeToken(token);
            // The LoginModal will handle the rest via the token check
            return;
        } catch (error) {
            console.error('OAuth failed:', error);
            throw error;
        }
    }
    
    // Fallback for web: redirect to backend Google OAuth
    const oauthUrl = `${API_URL}/api/auth/google`;
    window.location.href = oauthUrl;
}

export async function verifyToken(token: string): Promise<User> {
    try {
        const response = await axios.get(`${API_URL}/api/auth/verify`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data.user;
    } catch (error: any) {
        if (error.response) {
            console.error(`Failed to verify token: ${error.response.status} ${error.response.statusText}`, error.response.data);
        } else {
            console.error('Failed to verify token:', error.message);
        }
        throw new Error('Invalid token');
    }
}

export function getStoredToken(): string | null {
    return localStorage.getItem('devbench_token');
}

export function storeToken(token: string): void {
    localStorage.setItem('devbench_token', token);
}

export function removeToken(): void {
    localStorage.removeItem('devbench_token');
}

export async function checkMultipleDevices(): Promise<boolean> {
    try {
        const token = getStoredToken();
        if (!token) return false;

        const response = await axios.get(`${API_URL}/api/auth/devices/check-multiple`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data.hasMultipleDevices || false;
    } catch (error: any) {
        // If check fails (401, network error, etc.), default to false (no polling)
        // This is safe - polling will be disabled if we can't verify multiple devices
        if (error.response?.status !== 401) {
            // Only log non-auth errors (401 is expected if token is invalid/expired)
            console.error('Failed to check multiple devices:', error);
        }
        return false;
    }
}
