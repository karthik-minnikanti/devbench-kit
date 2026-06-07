import { useCallback, useEffect, useMemo, useState } from "react";
import { getStoredToken, removeToken, verifyToken } from "../services/auth";
import { getSubscription, Subscription } from "../services/subscription";
import { LoginModal } from "./LoginModal";
import { LicenseModal } from "./LicenseModal";
import { Icon } from "./Icon";
import {
  ProfileCard,
  ProfileFeatureList,
  ProfileStatGrid,
} from "./profile/ProfileLayout";

function userInitial(email: string | null): string {
  if (!email) return "?";
  return email.charAt(0).toUpperCase();
}

function formatPlan(plan: Subscription["plan"] | undefined): string {
  switch (plan) {
    case "trial":
      return "Trial";
    case "annual":
      return "Annual";
    case "friend":
      return "Friend";
    default:
      return "Free";
  }
}

function formatDate(value: string | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

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
    void refreshAccount();
  }, [refreshAccount]);

  const handleLogout = () => {
    removeToken();
    setIsLoggedIn(false);
    setUserEmail(null);
    setSubscription(null);
  };

  const subscriptionActive = subscription?.status === "active";

  const accountStats = useMemo(
    () => [
      {
        label: "Plan",
        value: subscriptionActive ? formatPlan(subscription?.plan) : "Free",
      },
      {
        label: "Status",
        value: subscriptionActive ? "Active" : "Inactive",
        tone: subscriptionActive ? ("success" as const) : ("default" as const),
      },
      {
        label: "Renews",
        value: subscriptionActive ? formatDate(subscription?.endDate) : "—",
      },
    ],
    [subscription, subscriptionActive],
  );

  return (
    <>
      <div className="profile-settings-stack">
        {loading ? (
          <ProfileCard>
            <div className="profile-settings-skeleton">
              <div className="profile-settings-skeleton__avatar" />
              <div className="space-y-2 flex-1">
                <div className="profile-settings-skeleton__line w-40" />
                <div className="profile-settings-skeleton__line w-28" />
              </div>
            </div>
          </ProfileCard>
        ) : isLoggedIn ? (
          <>
            <ProfileCard variant="highlight">
              <div className="profile-account-header">
                <div className="profile-user-avatar" aria-hidden="true">
                  {userInitial(userEmail)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="profile-settings-card__title truncate">{userEmail}</h3>
                    <span
                      className={`profile-badge ${
                        subscriptionActive
                          ? "profile-badge--success"
                          : "profile-badge--muted"
                      }`}
                    >
                      {subscriptionActive ? "Subscribed" : "Free tier"}
                    </span>
                  </div>
                  <p className="profile-settings-card__desc mt-1">
                    Signed in with Google · DevBench cloud account
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void refreshAccount()}
                  className="profile-icon-button"
                  title="Refresh account"
                  aria-label="Refresh account"
                >
                  <Icon name="RefreshCw" className="w-3.5 h-3.5" />
                </button>
              </div>

              <ProfileStatGrid stats={accountStats} />

              <div className="profile-settings-actions mt-4">
                <button
                  type="button"
                  onClick={() => setShowLicense(true)}
                  className="btn-primary !h-8 !text-xs inline-flex items-center gap-1.5"
                >
                  <Icon name="Lock" className="w-3.5 h-3.5" aria-hidden="true" />
                  Manage license
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="btn-secondary !h-8 !text-xs inline-flex items-center gap-1.5"
                >
                  Sign out
                </button>
              </div>
            </ProfileCard>
          </>
        ) : (
          <ProfileCard variant="empty">
            <div className="profile-empty-icon" aria-hidden="true">
              <Icon name="User" className="w-6 h-6 text-[var(--color-text-tertiary)]" />
            </div>
            <h3 className="profile-settings-card__title">Sign in to DevBench</h3>
            <p className="profile-settings-card__desc max-w-md mx-auto">
              Connect your account to sync subscription status and unlock Pro features.
            </p>
            <button
              type="button"
              onClick={() => setShowLogin(true)}
              className="btn-primary !h-9 !text-sm mt-4 inline-flex items-center gap-2"
            >
              <Icon name="Globe" className="w-4 h-4" aria-hidden="true" />
              Sign in with Google
            </button>
          </ProfileCard>
        )}

        <ProfileCard title="Included with your account">
          <ProfileFeatureList
            items={[
              {
                icon: "Lock",
                title: "Subscription & license",
                description: "Keeps Pro access in sync on this device",
              },
              {
                icon: "Zap",
                title: "Pro feature access",
                description: "Unlocks premium tools when your plan is active",
              },
              {
                icon: "FileText",
                title: "Cloud sync (coming soon)",
                description: "Notes and settings backup across devices",
              },
            ]}
          />
        </ProfileCard>
      </div>

      <LoginModal
        isOpen={showLogin}
        onSuccess={() => {
          setShowLogin(false);
          void refreshAccount();
        }}
      />
      <LicenseModal isOpen={showLicense} onClose={() => setShowLicense(false)} />
    </>
  );
}
