export type BodyType = 'json' | 'form-data' | 'x-www-form-urlencoded' | 'binary' | 'raw' | 'none';

export interface FormDataField {
  key: string;
  value: string;
  type: 'text' | 'file';
  enabled: boolean;
}

export interface ApiRequest {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD';
  url: string;
  headers: Record<string, string>;
  body?: string;
  bodyType?: BodyType;
  formData?: FormDataField[];
  binaryData?: string; // base64 encoded
  timeout: number;
  queryParams?: Array<{ key: string; value: string; enabled: boolean }>;
}

export interface ApiResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: any;
  time: number;
}

class ApiClient {
  private activeRequests: AbortController[] = [];
  private syncIntervalId: NodeJS.Timeout | null = null;

  async makeRequest(request: ApiRequest): Promise<ApiResponse> {
    const controller = new AbortController();
    this.activeRequests.push(controller);

    const startTime = Date.now();

    try {
      // Check if we're in Electron and use IPC handler to bypass CORS
      const isElectron = typeof window !== 'undefined' && (window as any).electronAPI;
      
      if (isElectron && (window as any).electronAPI?.apiClient) {
        // Use Electron IPC handler to make request server-side (bypasses CORS)
        const requestData = {
          method: request.method,
          url: request.url,
          headers: request.headers,
          queryParams: request.queryParams || [],
          bodyType: request.bodyType || 'none',
          body: request.body,
          formData: request.formData,
          binaryData: request.binaryData,
          timeout: request.timeout || 30000,
        };

        try {
          const response = await (window as any).electronAPI.apiClient.request(requestData);
          return response;
        } catch (error: any) {
          // Handle Electron IPC errors - they can come in different formats
          let errorMessage = 'Request failed';
          let errorCode = '';
          
          // Try to extract error message from various possible formats
          if (typeof error === 'string') {
            errorMessage = error;
          } else if (error && typeof error === 'object') {
            // Electron IPC errors might have error.error, error.message, or be the error object itself
            errorMessage = error.error || error.message || error.toString() || JSON.stringify(error);
            errorCode = error.code || '';
            
            // If errorMessage is still "[object Object]", try to extract more details
            if (errorMessage === '[object Object]' || errorMessage.includes('[object Object]')) {
              try {
                const errorObj = error.error || error;
                if (typeof errorObj === 'object' && errorObj !== null) {
                  errorMessage = errorObj.error || errorObj.message || JSON.stringify(errorObj);
                  errorCode = errorObj.code || error.code || '';
                }
              } catch (e) {
                errorMessage = 'Request failed - Unable to parse error details';
              }
            }
          }
          
          // Create error with specific details
          const detailedError = new Error(errorMessage);
          if (errorCode) {
            (detailedError as any).code = errorCode;
          }
          throw detailedError;
        }
      }

      // Fallback to fetch for non-Electron environments
      let body: string | FormData | ArrayBuffer | undefined = undefined;
      const headers: Record<string, string> = { ...request.headers };

      // Handle different body types
      if (request.bodyType === 'form-data' && request.formData) {
        const formData = new FormData();
        request.formData.forEach(field => {
          if (field.enabled) {
            if (field.type === 'file' && field.value) {
              // Handle file upload - field.value should be base64 data URL
              try {
                const base64Data = field.value.split(',')[1] || field.value;
                const byteCharacters = atob(base64Data);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                  byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray]);
                formData.append(field.key, blob);
              } catch (e) {
                console.error('Error processing file:', e);
              }
            } else {
              formData.append(field.key, field.value);
            }
          }
        });
        body = formData;
        // Don't set Content-Type header for FormData - browser will set it with boundary
        delete headers['Content-Type'];
      } else if (request.bodyType === 'x-www-form-urlencoded' && request.formData) {
        const params = new URLSearchParams();
        request.formData.forEach(field => {
          if (field.enabled && field.type === 'text') {
            params.append(field.key, field.value);
          }
        });
        body = params.toString();
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
      } else if (request.bodyType === 'binary' && request.binaryData) {
        try {
          const base64Data = request.binaryData.split(',')[1] || request.binaryData;
          const byteCharacters = atob(base64Data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          body = new Uint8Array(byteNumbers).buffer;
          headers['Content-Type'] = 'application/octet-stream';
        } catch (e) {
          throw new Error('Invalid binary data');
        }
      } else if (request.bodyType === 'raw' || request.bodyType === 'json') {
        body = request.body;
        if (request.bodyType === 'json' && !headers['Content-Type']) {
          headers['Content-Type'] = 'application/json';
        }
      } else if (request.body) {
        body = request.body;
      }

      // Remove CORS-related headers that cause issues
      const cleanHeaders: Record<string, string> = { ...headers };
      delete cleanHeaders['origin'];
      delete cleanHeaders['referer'];
      delete cleanHeaders['host'];
      delete cleanHeaders['Origin'];
      delete cleanHeaders['Referer'];
      delete cleanHeaders['Host'];

      const response = await fetch(request.url, {
        method: request.method,
        headers: cleanHeaders,
        body: body as any,
        signal: controller.signal,
        // Use 'no-cors' mode only if needed, but it limits response access
        // For now, we'll try without it and let the server handle CORS
      });

      // Check if response is ok (status 200-299)
      if (!response.ok) {
        // Try to get error message from response
        let errorData: any;
        const contentType = response.headers.get('content-type') || '';
        try {
          if (contentType.includes('application/json')) {
            errorData = await response.json();
          } else {
            errorData = await response.text();
          }
        } catch {
          errorData = null;
        }
        
        const errorMessage = errorData?.message || errorData?.error || response.statusText || 'Request failed';
        const error = new Error(`${response.status} ${errorMessage}`);
        (error as any).status = response.status;
        (error as any).statusText = response.statusText;
        throw error;
      }

      // Try to parse response based on content type
      const contentType = response.headers.get('content-type') || '';
      let data: any;

      if (contentType.includes('application/json')) {
        data = await response.json().catch(() => response.text());
      } else if (contentType.includes('text/')) {
        data = await response.text();
      } else if (contentType.includes('image/') || contentType.includes('application/octet-stream')) {
        // For binary responses, convert to base64
        const blob = await response.blob();
        data = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        });
      } else {
        data = await response.text().catch(() => 'Unable to parse response');
      }

      const time = Date.now() - startTime;

      return {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        data,
        time,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request aborted');
      }
      
      // Enhance fetch errors with more specific information
      if (error instanceof TypeError && error.message.includes('fetch')) {
        // Network errors from fetch
        const errorMessage = error.message;
        let enhancedMessage = errorMessage;
        
        if (errorMessage.includes('Failed to fetch')) {
          enhancedMessage = 'Network error - Failed to fetch. This could be due to CORS, connection refused, or network issues.';
        } else if (errorMessage.includes('NetworkError')) {
          enhancedMessage = 'Network error - Unable to connect to the server.';
        }
        
        const enhancedError = new Error(enhancedMessage);
        (enhancedError as any).originalError = error;
        throw enhancedError;
      }
      
      throw error;
    } finally {
      this.activeRequests = this.activeRequests.filter(c => c !== controller);
    }
  }

  startSync(
    request: ApiRequest,
    intervalMs: number,
    onSuccess: (response: ApiResponse) => void,
    onError: (error: Error) => void
  ) {
    this.stopSync();

    const makeRequest = async () => {
      try {
        const response = await this.makeRequest(request);
        onSuccess(response);
      } catch (error) {
        onError(error instanceof Error ? error : new Error(String(error)));
      }
    };

    makeRequest();
    this.syncIntervalId = setInterval(makeRequest, intervalMs);
  }

  stopSync() {
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
      this.syncIntervalId = null;
    }
  }

  isSyncing(): boolean {
    return this.syncIntervalId !== null;
  }

  stopAllRequests() {
    this.activeRequests.forEach(controller => controller.abort());
    this.activeRequests = [];
    this.stopSync();
  }
}

export const apiClient = new ApiClient();


