import { useState } from "react";
import { Icon } from "./Icon";
import { BrandLogo } from "./BrandLogo";
import { GitSettings } from "./GitSettings";
import { AccountSettings } from "./AccountSettings";
import {
  ProfileCard,
  ProfileMetaList,
  ProfileSectionHero,
} from "./profile/ProfileLayout";
import { ToolToolbar } from "./ui/ToolChrome";
import { API_URL } from "../config/api";
import pkg from "../../package.json";

const CONTACT_EMAIL = "contact@devbench.in";
const GITHUB_ISSUES_URL =
  "https://github.com/karthik-minnikanti/devbench-kit/issues/new";
const GITHUB_RELEASES_URL =
  "https://github.com/karthik-minnikanti/devbench-kit/releases/latest";

type ProfileSection = "account" | "git" | "about";

const SECTIONS: {
  id: ProfileSection;
  label: string;
  icon: keyof typeof import("./Icons").Icons;
  hint: string;
  description: string;
}[] = [
  {
    id: "account",
    label: "Account",
    icon: "User",
    hint: "Sign in & license",
    description: "Sign in, subscription, and license management",
  },
  {
    id: "git",
    label: "Git sync",
    icon: "Code",
    hint: "Repo & sync",
    description: "Repository path, status, and sync actions",
  },
  {
    id: "about",
    label: "About",
    icon: "Globe",
    hint: "Version & API",
    description: "App version and environment details",
  },
];

function ProfileNav({
  section,
  onChange,
}: {
  section: ProfileSection;
  onChange: (section: ProfileSection) => void;
}) {
  return (
    <aside className="profile-nav" aria-label="Settings">
      <div className="profile-nav__header">
        <div className="profile-nav__brand">
          <span className="profile-nav__brand-icon" aria-hidden="true">
            <Icon name="User" className="w-4 h-4 text-[var(--color-primary)]" />
          </span>
          <div className="min-w-0">
            <p className="profile-nav__brand-title">Profile</p>
            <p className="profile-nav__brand-desc">Preferences & account</p>
          </div>
        </div>
      </div>

      <nav className="profile-nav__list">
        {SECTIONS.map((entry) => {
          const active = section === entry.id;
          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => onChange(entry.id)}
              className={`profile-nav__item ${active ? "profile-nav__item--active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              <span className="profile-nav__icon" aria-hidden="true">
                <Icon name={entry.icon} className="w-3.5 h-3.5" />
              </span>
              <span className="min-w-0 text-left">
                <span className="profile-nav__label">{entry.label}</span>
                <span className="profile-nav__hint">{entry.hint}</span>
              </span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

function ProfileAbout() {
  const copyApiUrl = async () => {
    try {
      await navigator.clipboard.writeText(API_URL);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="profile-settings-stack">
      <ProfileCard variant="highlight">
        <div className="profile-about-hero">
          <BrandLogo size="md" showText={false} />
          <div className="min-w-0">
            <h3 className="profile-settings-card__title">DevBench Desktop</h3>
            <p className="profile-settings-card__desc mt-1">
              Developer workbench for APIs, data tools, shells, and planning.
            </p>
            <span className="profile-badge profile-badge--muted mt-2">v{pkg.version}</span>
          </div>
        </div>
      </ProfileCard>

      <ProfileCard title="Application">
        <ProfileMetaList
          rows={[
            { label: "Version", value: pkg.version },
            { label: "License", value: pkg.license ?? "MIT" },
            { label: "Author", value: pkg.author?.name ?? "DevBench" },
            {
              label: "Website",
              value: pkg.homepage ? (
                <a
                  href={pkg.homepage}
                  target="_blank"
                  rel="noreferrer"
                  className="profile-settings-link"
                >
                  {pkg.homepage.replace(/^https?:\/\//, "")}
                </a>
              ) : (
                "—"
              ),
            },
          ]}
        />
      </ProfileCard>

      <ProfileCard title="Environment" description="Cloud sync and subscription services.">
        <ProfileMetaList rows={[{ label: "API endpoint", value: API_URL, mono: true }]} />
        <button
          type="button"
          onClick={() => void copyApiUrl()}
          className="btn-secondary !h-8 !text-xs mt-3 inline-flex items-center gap-1.5"
        >
          <Icon name="Copy" className="w-3.5 h-3.5" aria-hidden="true" />
          Copy API URL
        </button>
      </ProfileCard>

      <ProfileCard
        title="Support & feedback"
        description="Report bugs, request features, or share ideas."
      >
        <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
          Email{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="profile-settings-link">
            {CONTACT_EMAIL}
          </a>{" "}
          or{" "}
          <a
            href={GITHUB_ISSUES_URL}
            target="_blank"
            rel="noreferrer"
            className="profile-settings-link"
          >
            create an issue on GitHub
          </a>
          .
        </p>
        <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed mt-3">
          On macOS, we are working on an Apple Developer signature and
          notarization. If the app is blocked on first launch, right-click
          DevBench → Open → Open again. Downloads are available from{" "}
          <a
            href={GITHUB_RELEASES_URL}
            target="_blank"
            rel="noreferrer"
            className="profile-settings-link"
          >
            GitHub Releases
          </a>
          .
        </p>
      </ProfileCard>
    </div>
  );
}

export function Profile() {
  const [section, setSection] = useState<ProfileSection>("account");
  const activeSection = SECTIONS.find((entry) => entry.id === section) ?? SECTIONS[0];

  return (
    <div className="h-full flex flex-col bg-[var(--color-background)] profile-root">
      <ToolToolbar title="Profile & settings" />

      <div className="flex flex-1 min-h-0">
        <ProfileNav section={section} onChange={setSection} />

        <div className="flex-1 min-w-0 overflow-auto profile-content">
          <ProfileSectionHero
            icon={activeSection.icon}
            title={activeSection.label}
            description={activeSection.description}
          />

          {section === "account" && <AccountSettings />}
          {section === "git" && <GitSettings embedded />}
          {section === "about" && <ProfileAbout />}
        </div>
      </div>
    </div>
  );
}
