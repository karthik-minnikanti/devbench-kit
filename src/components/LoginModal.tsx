import { useEffect, useState } from 'react';
import { loginWithGoogle, getStoredToken, storeToken, verifyToken, removeToken } from '../services/auth';
import { getSubscription } from '../services/subscription';
import { BrandLogo } from './BrandLogo';

interface LoginModalProps {
    isOpen: boolean;
    onSuccess: () => void;
}

export function LoginModal({ isOpen, onSuccess }: LoginModalProps) {
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        // Check if we're returning from OAuth callback (web flow)
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');

        if (token) {
            storeToken(token);
            // Clean up URL
            window.history.replaceState({}, document.title, window.location.pathname);
            // Verify and check subscription
            verifyToken(token).then(() => {
                getSubscription(token).then(subscription => {
                    if (subscription.isValid) {
                        onSuccess();
                    }
                });
            }).catch(() => {
                removeToken();
            });
        }
    }, [onSuccess]);

    // Check for stored token when modal opens (for Electron OAuth flow)
    useEffect(() => {
        if (isOpen) {
            const checkStoredToken = async () => {
                const token = getStoredToken();
                if (token) {
                    try {
                        await verifyToken(token);
                        const subscription = await getSubscription(token);
                        if (subscription.isValid) {
                            onSuccess();
                        } else {
                            removeToken();
                        }
                    } catch (error) {
                        // Token is invalid, remove it
                        removeToken();
                    }
                }
            };
            checkStoredToken();
        }
    }, [isOpen, onSuccess]);

    const handleGoogleLogin = async () => {
        setIsLoading(true);
        try {
            await loginWithGoogle();
            // For Electron, the token is already stored by loginWithGoogle
            // Small delay to ensure token is stored before checking
            await new Promise(resolve => setTimeout(resolve, 100));

            // Check if we got a token
            const token = getStoredToken();
            if (token) {
                try {
                    await verifyToken(token);
                    const subscription = await getSubscription(token);
                    if (subscription.isValid) {
                        onSuccess();
                    } else {
                        removeToken();
                        alert('Your subscription is not valid. Please contact support.');
                    }
                } catch (error) {
                    console.error('Token verification failed:', error);
                    removeToken();
                    alert('Authentication failed. Please try again.');
                }
            } else {
                console.error('No token received after OAuth');
                alert('Authentication failed. No token received.');
            }
        } catch (error: any) {
            console.error('Login failed:', error);
            alert(error?.message || 'Authentication failed. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-900 rounded-3xl p-10 max-w-md w-full mx-4 shadow-2xl border border-gray-100 dark:border-gray-800">
                <div className="text-center mb-8">
                    <div className="mb-6 flex justify-center">
                        <BrandLogo size="lg" showText={true} />
                    </div>
                    <h2 className="text-3xl font-bold mb-2 text-gray-900 dark:text-white">
                        Welcome to DevBench
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400">
                        Sign in to get started with your 1 month free trial
                    </p>
                </div>

                <div className="space-y-4">
                    <button
                        onClick={handleGoogleLogin}
                        disabled={isLoading}
                        className="w-full flex items-center justify-center gap-3 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white py-4 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? (
                            <>
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-900 dark:border-white"></div>
                                <span>Signing in...</span>
                            </>
                        ) : (
                            <>
                                <svg className="w-5 h-5" viewBox="0 0 24 24">
                                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                </svg>
                                Continue with Google
                            </>
                        )}
                    </button>

                    <div className="text-center text-xs text-gray-400 dark:text-gray-500 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <p className="mb-2">
                            By signing in, you automatically consent to our{' '}
                            <a href="https://devbench.in/terms" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-80 text-blue-600 dark:text-blue-400">
                                Terms and Conditions
                            </a>
                            {' '}and{' '}
                            <a href="https://devbench.in/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-80 text-blue-600 dark:text-blue-400">
                                Privacy Policy
                            </a>
                        </p>
                    </div>

                    <div className="text-center text-sm text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-200 dark:border-gray-700">
                        <p>Start your 1 month free trial</p>
                        <p className="mt-1">No credit card required</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
