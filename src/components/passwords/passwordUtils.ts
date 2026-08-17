export type PasswordStrength = "weak" | "fair" | "good" | "strong";

const LOWER = "abcdefghijkmnopqrstuvwxyz";
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const NUMBERS = "23456789";
const SYMBOLS = "!@#$%^&*()-_=+[]{}";
const AMBIGUOUS = "Il1O0";

export interface GeneratorOptions {
  length: number;
  lowercase: boolean;
  uppercase: boolean;
  numbers: boolean;
  symbols: boolean;
  excludeAmbiguous: boolean;
}

export const DEFAULT_GENERATOR: GeneratorOptions = {
  length: 20,
  lowercase: true,
  uppercase: true,
  numbers: true,
  symbols: true,
  excludeAmbiguous: true,
};

function charsetFor(options: GeneratorOptions): string {
  let set = "";
  if (options.lowercase) set += LOWER;
  if (options.uppercase) set += UPPER;
  if (options.numbers) set += NUMBERS;
  if (options.symbols) set += SYMBOLS;
  if (!options.excludeAmbiguous) set += AMBIGUOUS;
  return set || LOWER;
}

export function generatePassword(options: GeneratorOptions = DEFAULT_GENERATOR): string {
  const length = Math.min(64, Math.max(8, options.length || 20));
  const pools: string[] = [];
  if (options.lowercase) pools.push(LOWER);
  if (options.uppercase) pools.push(UPPER);
  if (options.numbers) pools.push(NUMBERS);
  if (options.symbols) pools.push(SYMBOLS);
  if (pools.length === 0) pools.push(LOWER);
  const all = charsetFor(options);
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  const chars: string[] = [];
  pools.forEach((pool, index) => {
    chars[index] = pool[bytes[index] % pool.length];
  });
  for (let i = pools.length; i < length; i++) {
    chars[i] = all[bytes[i] % all.length];
  }
  for (let i = chars.length - 1; i > 0; i--) {
    const j = bytes[i] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

export function scorePassword(password: string): PasswordStrength {
  if (!password) return "weak";
  if (password.length < 8) return "weak";
  let charset = 0;
  if (/[a-z]/.test(password)) charset += 26;
  if (/[A-Z]/.test(password)) charset += 26;
  if (/\d/.test(password)) charset += 10;
  if (/[^A-Za-z0-9]/.test(password)) charset += 24;
  const entropy = password.length * Math.log2(Math.max(charset, 1));
  if (entropy < 36) return "weak";
  if (entropy < 50) return "fair";
  if (entropy < 70) return "good";
  return "strong";
}

export function hostnameFromDomain(domain: string): string {
  if (!domain.trim()) return "";
  try {
    const url = domain.includes("://") ? new URL(domain) : new URL(`https://${domain}`);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return domain.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  }
}

export function websiteHref(domain: string): string | null {
  const host = hostnameFromDomain(domain);
  if (!host) return null;
  if (domain.startsWith("http://") || domain.startsWith("https://")) return domain;
  return `https://${host}`;
}

export const STRENGTH_LABEL: Record<PasswordStrength, string> = {
  weak: "Weak",
  fair: "Fair",
  good: "Good",
  strong: "Strong",
};

export function strengthBarClass(strength: PasswordStrength): string {
  if (strength === "strong") return "bg-[var(--color-semantic-success)]";
  if (strength === "good") return "bg-[var(--color-semantic-success)]/70";
  if (strength === "fair") return "bg-[var(--color-semantic-warning)]";
  return "bg-[var(--color-semantic-error)]";
}

export function strengthTextClass(strength: PasswordStrength): string {
  if (strength === "strong" || strength === "good") return "text-[var(--color-semantic-success)]";
  if (strength === "fair") return "text-[var(--color-semantic-warning)]";
  return "text-[var(--color-semantic-error)]";
}
