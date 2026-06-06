interface BrandLogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  className?: string;
}

const MARK_SIZES = { sm: 22, md: 26, lg: 40 } as const;

const TEXT_CLASSES = {
  sm: "text-[13px] font-semibold tracking-[-0.02em] leading-none",
  md: "text-sm font-semibold tracking-tight leading-none",
  lg: "text-lg font-semibold tracking-tight leading-none",
} as const;

function DevBenchMark({ size }: { size: keyof typeof MARK_SIZES }) {
  const dim = MARK_SIZES[size];

  return (
    <svg
      width={dim}
      height={dim}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="flex-shrink-0"
      aria-hidden
    >
      <rect
        x="0.5"
        y="0.5"
        width="23"
        height="23"
        rx="6"
        fill="var(--color-card)"
        stroke="var(--color-border)"
      />
      <path
        d="M8 8.5L5.5 12L8 15.5"
        stroke="var(--color-primary)"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 8.5L18.5 12L16 15.5"
        stroke="var(--color-primary)"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13.2 7.5L10.8 16.5"
        stroke="var(--color-text-tertiary)"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function DevBenchWordmark({ size }: { size: keyof typeof TEXT_CLASSES }) {
  return (
    <span className={`${TEXT_CLASSES[size]} text-[var(--color-text-primary)]`}>
      Dev<span className="text-[var(--color-primary)]">Bench</span>
    </span>
  );
}

export function BrandLogo({
  size = "md",
  showText = true,
  className = "",
}: BrandLogoProps) {
  const gap = size === "lg" ? "gap-3" : "gap-2.5";

  return (
    <div className={`flex items-center ${gap} ${className} select-none`}>
      <DevBenchMark size={size} />
      {showText && <DevBenchWordmark size={size} />}
    </div>
  );
}

export function BrandMark({ size = "md" }: { size?: keyof typeof MARK_SIZES }) {
  return <DevBenchMark size={size} />;
}

/** Large faded logo for page backgrounds */
export function BrandWatermark({ className = "" }: { className?: string }) {
  return (
    <div
      className={`pointer-events-none select-none ${className}`}
      aria-hidden
    >
      <div className="flex flex-col items-center gap-5 opacity-[0.05] dark:opacity-[0.07]">
        <svg
          width={140}
          height={140}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect
            x="0.5"
            y="0.5"
            width="23"
            height="23"
            rx="6"
            fill="var(--color-card)"
            stroke="var(--color-border)"
          />
          <path
            d="M8 8.5L5.5 12L8 15.5"
            stroke="var(--color-primary)"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M16 8.5L18.5 12L16 15.5"
            stroke="var(--color-primary)"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M13.2 7.5L10.8 16.5"
            stroke="var(--color-text-tertiary)"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
        <span className="text-5xl font-semibold tracking-[-0.03em] text-[var(--color-text-primary)]">
          Dev<span className="text-[var(--color-primary)]">Bench</span>
        </span>
      </div>
    </div>
  );
}
