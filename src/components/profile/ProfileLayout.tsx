import type { ReactNode } from "react";
import { Icon } from "../Icon";

type IconName = keyof typeof import("../Icons").Icons;

export function ProfileSectionHero({
  icon,
  title,
  description,
}: {
  icon: IconName;
  title: string;
  description: string;
}) {
  return (
    <div className="profile-hero">
      <div className="profile-hero__icon" aria-hidden="true">
        <Icon name={icon} className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <h1 className="profile-hero__title">{title}</h1>
        <p className="profile-hero__desc">{description}</p>
      </div>
    </div>
  );
}

export function ProfileCard({
  title,
  description,
  children,
  className = "",
  variant = "default",
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  variant?: "default" | "highlight" | "empty";
}) {
  return (
    <section
      className={`profile-settings-card ${
        variant === "highlight" ? "profile-settings-card--highlight" : ""
      } ${variant === "empty" ? "profile-settings-card--empty" : ""} ${className}`}
    >
      {title && <h3 className="profile-settings-card__title">{title}</h3>}
      {description && (
        <p className={`profile-settings-card__desc ${title ? "mt-1" : ""}`}>{description}</p>
      )}
      {children}
    </section>
  );
}

export function ProfileStatGrid({
  stats,
}: {
  stats: { label: string; value: string; mono?: boolean; tone?: "default" | "success" | "warning" }[];
}) {
  return (
    <dl className="profile-stat-grid">
      {stats.map((stat) => (
        <div key={stat.label} className="profile-stat-grid__item">
          <dt>{stat.label}</dt>
          <dd
            className={`${stat.mono ? "font-mono" : ""} ${
              stat.tone === "success"
                ? "text-[#16a34a]"
                : stat.tone === "warning"
                  ? "text-[#ca8a04]"
                  : ""
            }`}
          >
            {stat.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function ProfileFeatureList({
  items,
}: {
  items: { icon: IconName; title: string; description: string }[];
}) {
  return (
    <ul className="profile-feature-list">
      {items.map((item) => (
        <li key={item.title} className="profile-feature-list__item">
          <span className="profile-feature-list__icon" aria-hidden="true">
            <Icon name={item.icon} className="w-3.5 h-3.5" />
          </span>
          <span className="min-w-0">
            <span className="profile-feature-list__title">{item.title}</span>
            <span className="profile-feature-list__desc">{item.description}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function ProfileMetaList({
  rows,
}: {
  rows: { label: string; value: ReactNode; mono?: boolean }[];
}) {
  return (
    <dl className="profile-settings-meta">
      {rows.map((row) => (
        <div key={row.label} className="profile-settings-meta__row">
          <dt>{row.label}</dt>
          <dd className={row.mono ? "font-mono text-[11px] break-all" : ""}>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ProfileInlineAlert({
  tone,
  children,
}: {
  tone: "success" | "error";
  children: ReactNode;
}) {
  return (
    <div
      className={`profile-settings-alert ${
        tone === "success"
          ? "profile-settings-alert--success"
          : "profile-settings-alert--error"
      }`}
      role="status"
    >
      {children}
    </div>
  );
}
