const HTTP_METHOD_BADGE: Record<string, string> = {
  GET: "badge-method-get",
  POST: "badge-method-post",
  PUT: "badge-method-put",
  PATCH: "badge-method-patch",
  DELETE: "badge-method-delete",
  OPTIONS: "badge-method-neutral",
  HEAD: "badge-method-neutral",
};

export function getHttpMethodDisplay(method?: string | null): string {
  const normalized = method?.trim().toUpperCase();
  return normalized || "GET";
}

export function getHttpMethodBadgeClass(method?: string | null): string {
  const normalized = getHttpMethodDisplay(method);
  return HTTP_METHOD_BADGE[normalized] ?? "badge-method-neutral";
}

/** Compact method label for sidebars and request lists */
export function getHttpMethodLabelClass(method?: string | null): string {
  return `${getHttpMethodBadgeClass(method)} px-1.5 py-0.5 rounded text-[9px] font-semibold flex-shrink-0`;
}

/** Text color for method dropdowns and tabs */
const HTTP_METHOD_TEXT: Record<string, string> = {
  GET: "text-[var(--color-semantic-success)]",
  POST: "text-[var(--color-timeline-thinking)]",
  PUT: "text-[var(--color-semantic-warning)]",
  PATCH: "text-[var(--color-timeline-edit)]",
  DELETE: "text-[var(--color-semantic-error)]",
  OPTIONS: "text-[var(--color-text-secondary)]",
  HEAD: "text-[var(--color-text-secondary)]",
};

export function getHttpMethodTextClass(method?: string | null): string {
  return (
    HTTP_METHOD_TEXT[getHttpMethodDisplay(method)] ??
    "text-[var(--color-text-secondary)]"
  );
}

export function getHttpStatusBadgeClass(status: number): string {
  if (status >= 200 && status < 300) return "badge-status-success";
  if (status >= 300 && status < 400) return "badge-status-info";
  if (status >= 400 && status < 500) return "badge-status-warning";
  if (status >= 500) return "badge-status-error";
  return "badge-status-neutral";
}

export function getHttpStatusTextClass(status: number): string {
  if (status >= 200 && status < 300) return "text-[var(--color-semantic-success)]";
  if (status >= 300 && status < 400) return "text-[var(--color-semantic-warning)]";
  if (status >= 400 && status < 500) return "text-[var(--color-timeline-done)]";
  if (status >= 500) return "text-[var(--color-semantic-error)]";
  return "text-[var(--color-text-secondary)]";
}
