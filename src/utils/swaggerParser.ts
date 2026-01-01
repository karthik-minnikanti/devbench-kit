import type { SavedApiRequest } from '../components/ApiClient';

export interface SwaggerOpenAPISpec {
  openapi?: string;
  swagger?: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  servers?: Array<{ url: string; description?: string }>;
  paths: Record<string, Record<string, any>>;
  components?: {
    schemas?: Record<string, any>;
    securitySchemes?: Record<string, any>;
  };
}

export interface ParsedSwaggerRequest {
  name: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  queryParams?: Array<{ key: string; value: string; enabled: boolean }>;
  body?: string;
  bodyType: 'json' | 'raw' | 'form-data' | 'x-www-form-urlencoded' | 'none';
  tag?: string; // For folder organization
}

/**
 * Parse Swagger/OpenAPI spec and convert to API requests
 */
export function parseSwaggerSpec(spec: SwaggerOpenAPISpec): ParsedSwaggerRequest[] {
  const requests: ParsedSwaggerRequest[] = [];
  const baseUrl = spec.servers?.[0]?.url || '';

  Object.entries(spec.paths || {}).forEach(([path, methods]) => {
    Object.entries(methods).forEach(([method, operation]) => {
      if (!['get', 'post', 'put', 'delete', 'patch', 'options', 'head'].includes(method.toLowerCase())) {
        return;
      }

      const operationObj = operation as any;
      const requestName = operationObj.operationId || `${method.toUpperCase()} ${path}`;
      const fullUrl = baseUrl + path;
      const tag = operationObj.tags && operationObj.tags.length > 0 ? operationObj.tags[0] : undefined;

      // Extract headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // Extract query parameters
      const queryParams: Array<{ key: string; value: string; enabled: boolean }> = [];
      if (operationObj.parameters) {
        operationObj.parameters.forEach((param: any) => {
          if (param.in === 'query') {
            queryParams.push({
              key: param.name,
              value: param.schema?.default || param.default || '',
              enabled: !param.required,
            });
          } else if (param.in === 'header') {
            headers[param.name] = param.schema?.default || param.default || '';
          }
        });
      }

      // Extract request body
      let body: string | undefined;
      let bodyType: 'json' | 'raw' | 'form-data' | 'x-www-form-urlencoded' | 'none' = 'none';
      
      if (operationObj.requestBody) {
        const content = operationObj.requestBody.content || {};
        if (content['application/json']) {
          bodyType = 'json';
          const schema = content['application/json'].schema;
          if (schema) {
            body = JSON.stringify(generateExampleFromSchema(schema, spec.components?.schemas), null, 2);
          }
        } else if (content['application/x-www-form-urlencoded']) {
          bodyType = 'x-www-form-urlencoded';
        } else if (content['multipart/form-data']) {
          bodyType = 'form-data';
        }
      }

      requests.push({
        name: requestName,
        method: method.toUpperCase(),
        url: fullUrl,
        headers,
        queryParams: queryParams.length > 0 ? queryParams : undefined,
        body,
        bodyType,
        tag,
      });
    });
  });

  return requests;
}

/**
 * Generate example JSON from schema
 */
function generateExampleFromSchema(schema: any, components?: Record<string, any>): any {
  if (schema.type === 'object') {
    const example: any = {};
    if (schema.properties) {
      Object.entries(schema.properties).forEach(([key, prop]: [string, any]) => {
        example[key] = generateExampleFromSchema(prop, components);
      });
    }
    return example;
  } else if (schema.type === 'array') {
    return schema.items ? [generateExampleFromSchema(schema.items, components)] : [];
  } else if (schema.type === 'string') {
    return schema.example || schema.default || '';
  } else if (schema.type === 'number' || schema.type === 'integer') {
    return schema.example || schema.default || 0;
  } else if (schema.type === 'boolean') {
    return schema.example || schema.default || false;
  } else if (schema.$ref) {
    const refPath = schema.$ref.replace('#/components/schemas/', '');
    if (components?.[refPath]) {
      return generateExampleFromSchema(components[refPath], components);
    }
  }
  return null;
}

/**
 * Convert API requests to Swagger/OpenAPI spec
 */
export function exportToSwagger(requests: SavedApiRequest[], title: string = 'API Collection'): SwaggerOpenAPISpec {
  const paths: Record<string, Record<string, any>> = {};

  requests.forEach((request) => {
    try {
      const url = new URL(request.url);
      const path = url.pathname;
      const method = request.method.toLowerCase();

      if (!paths[path]) {
        paths[path] = {};
      }

      const operation: any = {
        summary: request.name,
        operationId: request.name.replace(/\s+/g, '_'),
        tags: [],
      };

      // Add parameters from query params
      if (request.queryParams && request.queryParams.length > 0) {
        operation.parameters = request.queryParams
          .filter(p => p.enabled && p.key)
          .map(p => ({
            name: p.key,
            in: 'query',
            required: false,
            schema: { type: 'string', default: p.value },
          }));
      }

      // Add request body
      if (['POST', 'PUT', 'PATCH'].includes(request.method) && request.body) {
        operation.requestBody = {
          content: {},
        };

        if (request.bodyType === 'json') {
          try {
            const parsed = JSON.parse(request.body);
            operation.requestBody.content['application/json'] = {
              schema: inferSchemaFromJSON(parsed),
            };
          } catch {
            operation.requestBody.content['application/json'] = {
              schema: { type: 'string' },
            };
          }
        } else if (request.bodyType === 'x-www-form-urlencoded') {
          operation.requestBody.content['application/x-www-form-urlencoded'] = {
            schema: { type: 'object' },
          };
        } else if (request.bodyType === 'form-data') {
          operation.requestBody.content['multipart/form-data'] = {
            schema: { type: 'object' },
          };
        }
      }

      paths[path][method] = operation;
    } catch (e) {
      // Skip invalid URLs
    }
  });

  return {
    openapi: '3.0.0',
    info: {
      title,
      version: '1.0.0',
    },
    servers: [{ url: 'https://api.example.com' }],
    paths,
  };
}

/**
 * Infer JSON schema from JSON object
 */
function inferSchemaFromJSON(obj: any): any {
  if (obj === null) {
    return { type: 'null' };
  }
  if (Array.isArray(obj)) {
    return {
      type: 'array',
      items: obj.length > 0 ? inferSchemaFromJSON(obj[0]) : { type: 'object' },
    };
  }
  if (typeof obj === 'object') {
    const properties: Record<string, any> = {};
    Object.entries(obj).forEach(([key, value]) => {
      properties[key] = inferSchemaFromJSON(value);
    });
    return {
      type: 'object',
      properties,
    };
  }
  return { type: typeof obj };
}






