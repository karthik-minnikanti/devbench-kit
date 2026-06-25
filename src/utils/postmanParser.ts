import { SavedApiRequest } from '../components/ApiClient';

export interface PostmanCollection {
  info: {
    name: string;
    description?: string;
    schema: string;
  };
  item: PostmanItem[];
  variable?: Array<{ key: string; value: string }>;
}

export interface PostmanItem {
  name: string;
  request?: PostmanRequest;
  item?: PostmanItem[];
  response?: any[];
}

export interface PostmanRequest {
  method: string;
  header?: Array<{ key: string; value: string; type?: string }>;
  body?: {
    mode: string;
    raw?: string;
    formdata?: Array<{ key: string; value: string; type: string }>;
    urlencoded?: Array<{ key: string; value: string }>;
  };
  url: {
    raw: string;
    protocol?: string;
    host?: string[];
    path?: string[];
    query?: Array<{ key: string; value: string; disabled?: boolean }>;
  };
}

/**
 * Parse Postman collection and convert to API requests
 */
export function parsePostmanCollection(collection: PostmanCollection): ParsedPostmanRequest[] {
  const requests: ParsedPostmanRequest[] = [];

  function processItems(items: PostmanItem[], folderPath: string = '') {
    items.forEach((item) => {
      if (item.request) {
        // It's a request
        const parsed = parsePostmanRequest(item.request, item.name);
        if (parsed) {
          parsed.folderPath = folderPath;
          requests.push(parsed);
        }
      } else if (item.item) {
        // It's a folder
        const newFolderPath = folderPath ? `${folderPath}/${item.name}` : item.name;
        processItems(item.item, newFolderPath);
      }
    });
  }

  processItems(collection.item || []);

  return requests;
}

export interface ParsedPostmanRequest {
  name: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  queryParams?: Array<{ key: string; value: string; enabled: boolean }>;
  body?: string;
  bodyType: 'json' | 'raw' | 'form-data' | 'x-www-form-urlencoded' | 'none';
  folderPath?: string;
}

function parsePostmanRequest(request: PostmanRequest, name: string): ParsedPostmanRequest | null {
  try {
    // Build URL
    let url = request.url.raw;
    if (!url && request.url.host) {
      const protocol = request.url.protocol || 'https';
      const host = request.url.host.join('.');
      const path = (request.url.path || []).join('/');
      url = `${protocol}://${host}${path ? '/' + path : ''}`;
    }

    // Extract headers
    const headers: Record<string, string> = {};
    if (request.header) {
      request.header.forEach((h) => {
        if (h.key && h.value) {
          headers[h.key] = h.value;
        }
      });
    }

    // Extract query parameters
    const queryParams: Array<{ key: string; value: string; enabled: boolean }> = [];
    if (request.url.query) {
      request.url.query.forEach((q) => {
        queryParams.push({
          key: q.key,
          value: q.value || '',
          enabled: !q.disabled,
        });
      });
    }

    // Extract body
    let body: string | undefined;
    let bodyType: 'json' | 'raw' | 'form-data' | 'x-www-form-urlencoded' | 'none' = 'none';

    if (request.body) {
      if (request.body.mode === 'raw') {
        bodyType = 'raw';
        body = request.body.raw || '';
        // Try to detect JSON
        if (body.trim().startsWith('{') || body.trim().startsWith('[')) {
          try {
            JSON.parse(body);
            bodyType = 'json';
          } catch {
            // Not valid JSON, keep as raw
          }
        }
      } else if (request.body.mode === 'formdata' && request.body.formdata) {
        bodyType = 'form-data';
        // Convert formdata to JSON string for storage
        const formDataObj: Record<string, string> = {};
        request.body.formdata.forEach((f) => {
          if (f.type === 'text') {
            formDataObj[f.key] = f.value || '';
          }
        });
        body = JSON.stringify(formDataObj);
      } else if (request.body.mode === 'urlencoded' && request.body.urlencoded) {
        bodyType = 'x-www-form-urlencoded';
        const params = new URLSearchParams();
        request.body.urlencoded.forEach((p) => {
          params.append(p.key, p.value || '');
        });
        body = params.toString();
      }
    }

    return {
      name,
      method: request.method.toUpperCase(),
      url,
      headers,
      queryParams: queryParams.length > 0 ? queryParams : undefined,
      body,
      bodyType,
    };
  } catch (e) {
    console.error('Failed to parse Postman request:', e);
    return null;
  }
}

/**
 * Convert API requests to Postman collection
 */
export function exportToPostman(requests: SavedApiRequest[], collectionName: string = 'API Collection'): PostmanCollection {
  const items: PostmanItem[] = [];
  const folderMap: Record<string, PostmanItem[]> = {};

  // Group requests by folder
  requests.forEach((request) => {
    const folderId = request.folderId || 'root';
    if (!folderMap[folderId]) {
      folderMap[folderId] = [];
    }

    const item: PostmanItem = {
      name: request.name,
      request: convertToPostmanRequest(request),
    };

    folderMap[folderId].push(item);
  });

  // Convert folders to Postman structure
  Object.entries(folderMap).forEach(([folderId, itemsInFolder]) => {
    if (folderId === 'root') {
      items.push(...itemsInFolder);
    } else {
      // For now, we'll add them to root. In a full implementation, you'd organize by folder structure
      items.push(...itemsInFolder);
    }
  });

  return {
    info: {
      name: collectionName,
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    item: items,
  };
}

function convertToPostmanRequest(request: SavedApiRequest): PostmanRequest {
  try {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/').filter(p => p);

    // Parse headers
    const headers: Array<{ key: string; value: string }> = [];
    try {
      const parsedHeaders = JSON.parse(request.headers);
      Object.entries(parsedHeaders).forEach(([key, value]) => {
        headers.push({ key, value: String(value) });
      });
    } catch {
      // If headers are not JSON, skip
    }

    // Parse query params
    const query: Array<{ key: string; value: string; disabled?: boolean }> = [];
    if (request.queryParams) {
      request.queryParams.forEach((p) => {
        query.push({
          key: p.key,
          value: p.value,
          disabled: !p.enabled,
        });
      });
    }
    // Also add query params from URL
    url.searchParams.forEach((value, key) => {
      if (!query.find(q => q.key === key)) {
        query.push({ key, value });
      }
    });

    // Build body
    let body: any = undefined;
    if (request.body && ['POST', 'PUT', 'PATCH'].includes(request.method)) {
      if (request.bodyType === 'json') {
        body = {
          mode: 'raw',
          raw: request.body,
          options: {
            raw: {
              language: 'json',
            },
          },
        };
      } else if (request.bodyType === 'raw') {
        body = {
          mode: 'raw',
          raw: request.body,
        };
      } else if (request.bodyType === 'x-www-form-urlencoded') {
        const params = new URLSearchParams(request.body);
        body = {
          mode: 'urlencoded',
          urlencoded: Array.from(params.entries()).map(([key, value]) => ({
            key,
            value,
          })),
        };
      } else if (request.bodyType === 'form-data' && request.formData) {
        body = {
          mode: 'formdata',
          formdata: request.formData
            .filter(f => f.enabled && f.key)
            .map(f => ({
              key: f.key,
              value: f.type === 'text' ? f.value : '',
              type: f.type,
            })),
        };
      }
    }

    return {
      method: request.method,
      header: headers.length > 0 ? headers : undefined,
      body,
      url: {
        raw: request.url,
        protocol: url.protocol.replace(':', ''),
        host: url.hostname.split('.'),
        path: pathParts,
        query: query.length > 0 ? query : undefined,
      },
    };
  } catch (e) {
    // Fallback for invalid URLs
    return {
      method: request.method,
      url: {
        raw: request.url,
      },
    };
  }
}






