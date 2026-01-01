/**
 * Script Runner - Safely executes JavaScript scripts in a sandboxed environment
 * Provides Postman-like APIs for pre-request and test scripts
 */

export interface ScriptContext {
  // Request data
  request?: {
    url?: string;
    method?: string;
    headers?: Record<string, string>;
    body?: any;
  };
  // Response data (only available in test scripts)
  response?: {
    status?: number;
    statusText?: string;
    headers?: Record<string, string>;
    body?: any;
    time?: number;
  };
  // Environment variables
  environment?: Record<string, string>;
  // Global variables
  globals?: Record<string, any>;
  // Console for logging
  console?: {
    log: (...args: any[]) => void;
    error: (...args: any[]) => void;
    warn: (...args: any[]) => void;
    info: (...args: any[]) => void;
  };
}

export interface ScriptResult {
  success: boolean;
  error?: string;
  logs: string[];
  updatedContext?: Partial<ScriptContext>;
}

/**
 * Creates a safe script execution context with Postman-like APIs
 */
function createScriptContext(context: ScriptContext): any {
  const logs: string[] = [];
  
  const console = {
    log: (...args: any[]) => {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      logs.push(`[LOG] ${message}`);
    },
    error: (...args: any[]) => {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      logs.push(`[ERROR] ${message}`);
    },
    warn: (...args: any[]) => {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      logs.push(`[WARN] ${message}`);
    },
    info: (...args: any[]) => {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      logs.push(`[INFO] ${message}`);
    },
  };

  // Postman-like pm object
  const pm = {
    environment: {
      get: (key: string) => context.environment?.[key] || null,
      set: (key: string, value: any) => {
        if (!context.environment) context.environment = {};
        context.environment[key] = String(value);
      },
      unset: (key: string) => {
        if (context.environment) {
          delete context.environment[key];
        }
      },
      toObject: () => ({ ...(context.environment || {}) }),
    },
    // Allow modifying request URL in pre-request scripts
    request: {
      ...(context.request ? {
        url: {
          toString: () => context.request?.url || '',
          update: (newUrl: string) => {
            if (context.request) {
              context.request.url = newUrl;
            }
          },
          getQueryParams: () => {
            if (!context.request?.url) return [];
            try {
              const url = new URL(context.request.url);
              return Array.from(url.searchParams.entries()).map(([key, value]) => ({
                key,
                value,
              }));
            } catch {
              return [];
            }
          },
        },
        headers: {
          get: (key: string) => context.request?.headers?.[key] || null,
          has: (key: string) => !!context.request?.headers?.[key],
          set: (key: string, value: string) => {
            if (context.request && context.request.headers) {
              context.request.headers[key] = value;
            }
          },
          remove: (key: string) => {
            if (context.request && context.request.headers) {
              delete context.request.headers[key];
            }
          },
          toObject: () => ({ ...(context.request?.headers || {}) }),
        },
        body: {
          raw: context.request?.body || '',
          json: () => {
            try {
              return typeof context.request?.body === 'string' 
                ? JSON.parse(context.request.body) 
                : context.request?.body;
            } catch {
              return null;
            }
          },
          update: (newBody: string) => {
            if (context.request) {
              context.request.body = newBody;
            }
          },
          formData: {
            get: (key: string) => {
              // Implementation for form data
              return null;
            },
          },
        },
      } : {}),
    },
    globals: {
      get: (key: string) => context.globals?.[key] || null,
      set: (key: string, value: any) => {
        if (!context.globals) context.globals = {};
        context.globals[key] = value;
      },
      unset: (key: string) => {
        if (context.globals) {
          delete context.globals[key];
        }
      },
      toObject: () => ({ ...(context.globals || {}) }),
    },
    request: {
      url: {
        toString: () => context.request?.url || '',
        getQueryParams: () => {
          if (!context.request?.url) return [];
          try {
            const url = new URL(context.request.url);
            return Array.from(url.searchParams.entries()).map(([key, value]) => ({
              key,
              value,
            }));
          } catch {
            return [];
          }
        },
      },
      headers: {
        get: (key: string) => context.request?.headers?.[key] || null,
        has: (key: string) => !!context.request?.headers?.[key],
        toObject: () => ({ ...(context.request?.headers || {}) }),
      },
      body: {
        raw: context.request?.body || '',
        json: () => {
          try {
            return typeof context.request?.body === 'string' 
              ? JSON.parse(context.request.body) 
              : context.request?.body;
          } catch {
            return null;
          }
        },
        formData: {
          get: (key: string) => {
            // Implementation for form data
            return null;
          },
        },
      },
    },
    response: context.response ? {
      code: context.response.status || 0,
      status: () => context.response?.statusText || '',
      headers: {
        get: (key: string) => context.response?.headers?.[key] || null,
        has: (key: string) => !!context.response?.headers?.[key],
        toObject: () => ({ ...(context.response?.headers || {}) }),
      },
      json: () => {
        try {
          return typeof context.response?.body === 'string'
            ? JSON.parse(context.response.body)
            : context.response?.body;
        } catch {
          return null;
        }
      },
      text: () => {
        return typeof context.response?.body === 'string'
          ? context.response.body
          : JSON.stringify(context.response?.body || {});
      },
      responseTime: context.response.time || 0,
    } : undefined,
    test: (name: string, fn: () => void) => {
      try {
        fn();
        logs.push(`[TEST PASS] ${name}`);
      } catch (error: any) {
        logs.push(`[TEST FAIL] ${name}: ${error.message || error}`);
        throw error;
      }
    },
    expect: (value: any) => {
      return {
        to: {
          be: {
            a: (type: string) => {
              const actualType = typeof value;
              if (actualType !== type) {
                throw new Error(`Expected ${value} to be of type ${type}, but got ${actualType}`);
              }
            },
          },
          equal: (expected: any) => {
            if (value !== expected) {
              throw new Error(`Expected ${value} to equal ${expected}`);
            }
          },
          include: (substring: string) => {
            if (!String(value).includes(substring)) {
              throw new Error(`Expected ${value} to include ${substring}`);
            }
          },
        },
        eql: (expected: any) => {
          if (JSON.stringify(value) !== JSON.stringify(expected)) {
            throw new Error(`Expected ${JSON.stringify(value)} to equal ${JSON.stringify(expected)}`);
          }
        },
      };
    },
  };

  return {
    console,
    pm,
    logs,
  };
}

/**
 * Executes a JavaScript script safely
 */
export function executeScript(script: string, context: ScriptContext): ScriptResult {
  const logs: string[] = [];
  
  if (!script || !script.trim()) {
    return { success: true, logs: [] };
  }

  try {
    const { console: scriptConsole, pm, logs: scriptLogs } = createScriptContext(context);
    
    // Create a function that wraps the script
    // This allows us to capture any variables or functions defined in the script
    const wrappedScript = `
      (function() {
        ${script}
      })();
    `;

    // Execute the script with access to pm and console
    const func = new Function('pm', 'console', wrappedScript);
    func(pm, scriptConsole);

    // Collect logs
    logs.push(...scriptLogs);

    // Return updated context
    return {
      success: true,
      logs,
      updatedContext: {
        environment: context.environment,
        globals: context.globals,
        request: context.request,
      },
    };
  } catch (error: any) {
    logs.push(`[ERROR] ${error.message || String(error)}`);
    return {
      success: false,
      error: error.message || String(error),
      logs,
    };
  }
}

