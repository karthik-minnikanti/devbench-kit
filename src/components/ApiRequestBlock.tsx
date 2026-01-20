import React, { useState } from 'react';
import { apiClient, ApiRequest, ApiResponse } from '../utils/apiClient';
import { Icon } from './Icon';

export interface ApiRequestBlockData {
  id: string;
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD';
  url: string;
  headers: string; // JSON string
  body?: string;
  bodyType?: 'json' | 'form-data' | 'x-www-form-urlencoded' | 'raw' | 'none';
  timeout?: number;
  queryParams?: Array<{ key: string; value: string; enabled: boolean }>;
}

interface ApiRequestBlockProps {
  block: {
    id: string;
    type: string;
    props: ApiRequestBlockData;
  };
  editor: any;
  contentRef?: any;
}

export function ApiRequestBlock({ block, editor }: ApiRequestBlockProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isExecuting, setIsExecuting] = useState(false);
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const data = block.props as ApiRequestBlockData;

  const executeRequest = async () => {
    setIsExecuting(true);
    setError(null);
    setResponse(null);

    try {
      // Parse headers
      let parsedHeaders: Record<string, string> = {};
      try {
        if (data.headers) {
          parsedHeaders = JSON.parse(data.headers);
        }
      } catch (e) {
        console.warn('Failed to parse headers:', e);
      }

      // Build request object
      const request: ApiRequest = {
        method: data.method || 'GET',
        url: data.url || '',
        headers: parsedHeaders,
        body: data.body,
        bodyType: data.bodyType || 'json',
        timeout: data.timeout || 30000,
        queryParams: data.queryParams || [],
      };

      const result = await apiClient.makeRequest(request);
      setResponse(result);
    } catch (err: any) {
      setError(err.message || 'Request failed');
    } finally {
      setIsExecuting(false);
    }
  };

  const updateBlockData = (updates: Partial<ApiRequestBlockData>) => {
    editor.updateBlock(block.id, {
      props: {
        ...data,
        ...updates,
      },
    });
  };

  const getMethodColor = (method: string) => {
    const colors: Record<string, string> = {
      GET: 'bg-green-500',
      POST: 'bg-blue-500',
      PUT: 'bg-yellow-500',
      DELETE: 'bg-red-500',
      PATCH: 'bg-purple-500',
      OPTIONS: 'bg-gray-500',
      HEAD: 'bg-gray-500',
    };
    return colors[method] || 'bg-gray-500';
  };

  if (isEditing) {
    return (
      <div className="my-4 p-4 border border-[var(--color-border)] rounded-lg bg-[var(--color-card)]">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-[var(--color-text-primary)]">Edit API Request</h3>
            <button
              onClick={() => setIsEditing(false)}
              className="px-2 py-1 text-xs rounded bg-[var(--color-muted)] hover:bg-[var(--color-hover)]"
            >
              Done
            </button>
          </div>

          <div>
            <label className="block text-xs text-[var(--color-text-secondary)] mb-1">Name</label>
            <input
              type="text"
              value={data.name || ''}
              onChange={(e) => updateBlockData({ name: e.target.value })}
              placeholder="Request name"
              className="w-full px-2 py-1 text-sm rounded border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text-primary)]"
            />
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs text-[var(--color-text-secondary)] mb-1">Method</label>
              <select
                value={data.method || 'GET'}
                onChange={(e) => updateBlockData({ method: e.target.value as any })}
                className="w-full px-2 py-1 text-sm rounded border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text-primary)]"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
                <option value="PATCH">PATCH</option>
                <option value="OPTIONS">OPTIONS</option>
                <option value="HEAD">HEAD</option>
              </select>
            </div>
            <div className="flex-2">
              <label className="block text-xs text-[var(--color-text-secondary)] mb-1">URL</label>
              <input
                type="text"
                value={data.url || ''}
                onChange={(e) => updateBlockData({ url: e.target.value })}
                placeholder="https://api.example.com/endpoint"
                className="w-full px-2 py-1 text-sm rounded border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text-primary)]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-[var(--color-text-secondary)] mb-1">Headers (JSON)</label>
            <textarea
              value={data.headers || '{}'}
              onChange={(e) => updateBlockData({ headers: e.target.value })}
              placeholder='{"Content-Type": "application/json"}'
              rows={3}
              className="w-full px-2 py-1 text-sm rounded border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text-primary)] font-mono"
            />
          </div>

          {(data.method === 'POST' || data.method === 'PUT' || data.method === 'PATCH') && (
            <div>
              <label className="block text-xs text-[var(--color-text-secondary)] mb-1">Body</label>
              <textarea
                value={data.body || ''}
                onChange={(e) => updateBlockData({ body: e.target.value })}
                placeholder='{"key": "value"}'
                rows={5}
                className="w-full px-2 py-1 text-sm rounded border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text-primary)] font-mono"
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="my-4 border border-[var(--color-border)] rounded-lg bg-[var(--color-card)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-[var(--color-sidebar)] border-b border-[var(--color-border)]">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className={`px-2 py-0.5 text-xs font-semibold text-white rounded ${getMethodColor(data.method || 'GET')}`}>
            {data.method || 'GET'}
          </span>
          <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">
            {data.name || 'Untitled Request'}
          </span>
          <span className="text-xs text-[var(--color-text-tertiary)] truncate hidden sm:inline">
            {data.url || 'No URL'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="p-1.5 rounded hover:bg-[var(--color-hover)] text-[var(--color-text-secondary)] transition-colors"
            title="Edit request"
          >
            <Icon name="Edit" className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded hover:bg-[var(--color-hover)] text-[var(--color-text-secondary)] transition-colors"
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            <Icon name={isExpanded ? 'ChevronUp' : 'ChevronDown'} className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* Request Details */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-[var(--color-text-secondary)]">URL:</span>
              <code className="text-xs text-[var(--color-text-primary)] bg-[var(--color-muted)] px-2 py-0.5 rounded flex-1 truncate">
                {data.url || 'No URL set'}
              </code>
            </div>
            {data.headers && data.headers !== '{}' && (
              <div>
                <span className="text-xs font-medium text-[var(--color-text-secondary)]">Headers:</span>
                <pre className="text-xs text-[var(--color-text-primary)] bg-[var(--color-muted)] p-2 rounded mt-1 overflow-x-auto">
                  {data.headers}
                </pre>
              </div>
            )}
            {data.body && (
              <div>
                <span className="text-xs font-medium text-[var(--color-text-secondary)]">Body:</span>
                <pre className="text-xs text-[var(--color-text-primary)] bg-[var(--color-muted)] p-2 rounded mt-1 overflow-x-auto max-h-32">
                  {data.body}
                </pre>
              </div>
            )}
          </div>

          {/* Execute Button */}
          <button
            onClick={executeRequest}
            disabled={isExecuting || !data.url}
            className="w-full px-4 py-2 rounded bg-[var(--color-primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isExecuting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                <span>Executing...</span>
              </>
            ) : (
              <>
                <Icon name="Play" className="w-4 h-4" />
                <span>Execute Request</span>
              </>
            )}
          </button>

          {/* Response */}
          {response && (
            <div className="border-t border-[var(--color-border)] pt-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">Response</h4>
                <span className={`text-xs px-2 py-0.5 rounded ${
                  response.status >= 200 && response.status < 300
                    ? 'bg-green-500/20 text-green-500'
                    : response.status >= 400
                    ? 'bg-red-500/20 text-red-500'
                    : 'bg-yellow-500/20 text-yellow-500'
                }`}>
                  {response.status} {response.statusText}
                </span>
              </div>
              <div className="text-xs text-[var(--color-text-tertiary)] mb-2">
                Time: {response.time}ms
              </div>
              <div className="bg-[var(--color-muted)] rounded p-3 max-h-64 overflow-auto">
                <pre className="text-xs text-[var(--color-text-primary)] whitespace-pre-wrap">
                  {typeof response.data === 'string' 
                    ? response.data 
                    : JSON.stringify(response.data, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="border-t border-[var(--color-border)] pt-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon name="AlertCircle" className="w-4 h-4 text-red-500" />
                <h4 className="text-sm font-semibold text-red-500">Error</h4>
              </div>
              <div className="bg-red-500/10 border border-red-500/20 rounded p-3">
                <p className="text-xs text-red-500">{error}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

