import { parse as parseCurlCommand } from '@scrape-do/curl-parser';

export interface ParsedCurl {
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: string;
    queryParams?: Array<{ key: string; value: string }>;
}

export function parseCurl(curlCommand: string): ParsedCurl | null {
    try {
        // Use @scrape-do/curl-parser to parse the curl command
        const parsed = parseCurlCommand(curlCommand);
        
        if (!parsed || !parsed.url) {
            return null;
        }

        // Convert headers array to Record if needed
        let headers: Record<string, string> = {};
        if (Array.isArray(parsed.headers)) {
            headers = parsed.headers.reduce((acc: Record<string, string>, h: { key: string; value: string }) => {
                if (h.key && h.value) {
                    acc[h.key] = h.value;
                }
                return acc;
            }, {});
        } else if (parsed.headers && typeof parsed.headers === 'object') {
            headers = parsed.headers as Record<string, string>;
        }

        // Extract query params from URL
        const queryParams: Array<{ key: string; value: string }> = [];
        try {
            const urlObj = new URL(parsed.url);
            urlObj.searchParams.forEach((value, key) => {
                queryParams.push({ key, value });
            });
        } catch (e) {
            // URL parsing failed, no query params
        }

        // Get body from parsed result
        const body = (parsed as any).data || (parsed as any).body || parsed.body || undefined;

        // Map the parsed result to our interface
        const result: ParsedCurl = {
            method: (parsed.method || 'GET').toUpperCase(),
            url: parsed.url,
            headers,
            body: typeof body === 'string' ? body : (body ? JSON.stringify(body) : undefined),
            queryParams: queryParams.length > 0 ? queryParams : undefined,
        };

        // If body was found and it's a JSON string, try to parse and format it
        if (result.body && typeof result.body === 'string' && result.body.startsWith('{')) {
            try {
                // Try to parse and format JSON
                const parsedJson = JSON.parse(result.body);
                result.body = JSON.stringify(parsedJson, null, 2);
            } catch {
                // Not valid JSON, keep as is
            }
        } else if (result.body && typeof result.body === 'object') {
            // If body is already an object, stringify it
            try {
                result.body = JSON.stringify(result.body, null, 2);
            } catch {
                result.body = String(result.body);
            }
        }

        return result;
    } catch (error) {
        console.error('Failed to parse curl command:', error);
        return null;
    }
}

