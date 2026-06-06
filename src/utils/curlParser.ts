import { parse as parseCurlCommand } from "@scrape-do/curl-parser";

export interface ParsedCurl {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
  queryParams?: Array<{ key: string; value: string }>;
}

const VALID_METHODS = new Set([
  "GET",
  "POST",
  "PUT",
  "DELETE",
  "PATCH",
  "OPTIONS",
  "HEAD",
]);

function preprocessCurl(command: string): string {
  return command.replace(/\\\r?\n/g, " ").replace(/\s+/g, " ").trim();
}

/** Strip flags the bundled parser mishandles before delegating to it. */
function sanitizeCurlForParser(command: string): string {
  return command.replace(
    /\s(-L|--location)\b(?=\s+(?:--|-[A-HJ-Z]|'|"|https?:))/gi,
    " ",
  );
}

function extractMethodFromCommand(command: string): string | null {
  const requestMatch = command.match(
    /(?:^|\s)(?:-X|--request)(?:=|\s+)([A-Za-z]+)/i,
  );
  if (requestMatch) {
    return requestMatch[1].toUpperCase();
  }
  if (/(?:^|\s)(?:-I|--head)(?:\s|$)/i.test(command)) {
    return "HEAD";
  }
  return null;
}

function extractUrlFallback(command: string): string | null {
  const quoted = command.match(/['"](https?:\/\/[^'"]+)['"]/i);
  if (quoted) {
    return quoted[1];
  }
  const bare = command.match(/(https?:\/\/[^\s'"]+)/i);
  return bare ? bare[1] : null;
}

function normalizeMethod(
  method: string | undefined | null,
  hasBody: boolean,
): string {
  const upper = (method || "").trim().toUpperCase();
  if (hasBody && (!upper || upper === "GET")) {
    return "POST";
  }
  if (upper && VALID_METHODS.has(upper)) {
    return upper;
  }
  return "GET";
}

function headersFromParsed(parsed: {
  headers?: Array<{ key: string; value: string }> | Record<string, string>;
}): Record<string, string> {
  if (Array.isArray(parsed.headers)) {
    return parsed.headers.reduce(
      (acc: Record<string, string>, header: { key: string; value: string }) => {
        if (header.key) {
          acc[header.key] = header.value ?? "";
        }
        return acc;
      },
      {},
    );
  }
  if (parsed.headers && typeof parsed.headers === "object") {
    return parsed.headers as Record<string, string>;
  }
  return {};
}

function formatBody(body: unknown): string | undefined {
  if (body == null || body === "") {
    return undefined;
  }
  if (typeof body === "string") {
    if (body.startsWith("{")) {
      try {
        return JSON.stringify(JSON.parse(body), null, 2);
      } catch {
        return body;
      }
    }
    return body;
  }
  try {
    return JSON.stringify(body, null, 2);
  } catch {
    return String(body);
  }
}

function queryParamsFromUrl(url: string): Array<{ key: string; value: string }> {
  const queryParams: Array<{ key: string; value: string }> = [];
  try {
    const urlObj = new URL(url);
    urlObj.searchParams.forEach((value, key) => {
      queryParams.push({ key, value });
    });
  } catch {
    // ignore invalid URLs
  }
  return queryParams;
}

export function looksLikeCurl(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed) {
    return false;
  }
  const normalized = trimmed.replace(/\\\r?\n/g, " ").replace(/\s+/g, " ").trim();
  return /^curl\b/i.test(normalized);
}

/** True when the command includes flags beyond the URL (not a truncated multiline paste). */
export function curlLooksComplete(input: string): boolean {
  if (!looksLikeCurl(input)) {
    return false;
  }
  if (/\\[\s]*$/.test(input.trim())) {
    return false;
  }
  const normalized = input.replace(/\\\r?\n/g, " ").replace(/\s+/g, " ").trim();
  return /(?:^|\s)(?:-H|--header|-d|--data(?:-raw|-binary|-urlencode)?|-F|--form|-X|--request|-I|--head|-u|--user)\b/i.test(
    normalized,
  );
}

export function parseCurl(curlCommand: string): ParsedCurl | null {
  try {
    const preprocessed = preprocessCurl(curlCommand);
    if (!/^curl\b/i.test(preprocessed)) {
      return null;
    }

    const explicitMethod = extractMethodFromCommand(preprocessed);
    let parsed: ReturnType<typeof parseCurlCommand> | null = null;

    try {
      parsed = parseCurlCommand(sanitizeCurlForParser(preprocessed));
    } catch {
      parsed = null;
    }

    const url = parsed?.url || extractUrlFallback(preprocessed);
    if (!url) {
      return null;
    }

    const body = formatBody(
      (parsed as { data?: unknown; body?: unknown } | null)?.data ??
        (parsed as { data?: unknown; body?: unknown } | null)?.body ??
        parsed?.body,
    );
    const hasBody = Boolean(body && body.trim());
    const method = normalizeMethod(explicitMethod || parsed?.method, hasBody);
    const queryParams = queryParamsFromUrl(url);

    return {
      method,
      url,
      headers: parsed ? headersFromParsed(parsed) : {},
      body,
      queryParams: queryParams.length > 0 ? queryParams : undefined,
    };
  } catch (error) {
    console.error("Failed to parse curl command:", error);
    return null;
  }
}
