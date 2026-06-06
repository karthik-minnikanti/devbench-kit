import { useCallback, useEffect, useState } from "react";
import { getStoredToken, removeToken, verifyToken } from "../services/auth";
import { getSubscription, Subscription } from "../services/subscription";
import { LoginModal } from "./LoginModal";
import { LicenseModal } from "./LicenseModal";
import { API_URL } from "../config/api";

export function AccountSettings() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [showLicense, setShowLicense] = useState(false);
  const [loading, setLoading] = useState(true);

  const refreshAccount = useCallback(async () => {
    setLoading(true);
    const token = getStoredToken();
    if (!token) {
      setIsLoggedIn(false);
      setUserEmail(null);
      setSubscription(null);
      setLoading(false);
      return;
    }

    try {
      const user = await verifyToken(token);
      const sub = await getSubscription(token);
      setIsLoggedIn(true);
      setUserEmail(user.email);
      setSubscription(sub.subscription);
    } catch {
      removeToken();
      setIsLoggedIn(false);
      setUserEmail(null);
      setSubscription(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshAccount();
  }, [refreshAccount]);

  const handleLogout = () => {
    removeToken();
    setIsLoggedIn(false);
    setUserEmail(null);
    setSubscription(null);
  };

  return (
    <>
      <div className="px-4 py-3 border-b border-[var(--color-border)]">
        <div className="text-xs font-semibold text-[var(--color-text-primary)] uppercase tracking-wider mb-3">
          Account
        </div>
        {loading ? (
          <div className="text-xs text-[var(--color-text-tertiary)]">
            Loading account...
          </div>
        ) : isLoggedIn ? (
          <div className="space-y-3">
            <div>
              <div className="text-sm text-[var(--color-text-primary)]">
                {userEmail}
              </div>
              <div className="text-xs text-[var(--color-text-tertiary)] mt-1">
                {subscription?.status === "active"
                  ? `${subscription.plan} plan · active`
                  : "No active subscription"}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowLicense(true)}
                className="btn-secondary text-xs"
              >
                Manage License
              </button>
              <button onClick={handleLogout} className="btn-secondary text-xs">
                Sign Out
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-[var(--color-text-tertiary)]">
              Sign in to sync subscription and pro features.
            </p>
            <button
              onClick={() => setShowLogin(true)}
              className="btn-primary text-xs"
            >
              Sign In with Google
            </button>
          </div>
        )}
        <div className="text-[10px] text-[var(--color-text-tertiary)] mt-3">
          API: {API_URL}
        </div>
      </div>

      <LoginModal
        isOpen={showLogin}
        onSuccess={() => {
          setShowLogin(false);
          refreshAccount();
        }}
      />
      <LicenseModal
        isOpen={showLicense}
        onClose={() => setShowLicense(false)}
      />
    </>
  );
}
