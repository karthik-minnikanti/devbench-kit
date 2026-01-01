import { useState, useEffect, useRef } from 'react';
import { Editor } from '@monaco-editor/react';
import { apiClient, ApiRequest, ApiResponse, BodyType, FormDataField } from '../utils/apiClient';
import { parseCurl } from '../utils/curlParser';
import { useStore } from '../state/store';
import { getFolders, saveFolder, deleteFolder, Folder } from '../utils/folders';
import { groupByDate, DateGroup } from '../utils/dateGrouping';
import { Icon } from './Icon';
import { Icons } from './Icons';
import { ImportExportModal } from './ImportExportModal';
import { VariablesManager } from './VariablesManager';
import { ParsedSwaggerRequest } from '../utils/swaggerParser';
import { ParsedPostmanRequest } from '../utils/postmanParser';
import { getVariables, replaceVariables, replaceVariablesInObject, areVariablesValid, Variable } from '../utils/variables';

interface QueryParam {
  key: string;
  value: string;
  enabled: boolean;
}

interface Header {
  key: string;
  value: string;
  enabled: boolean;
}

type AuthType = 'none' | 'bearer' | 'basic' | 'apikey' | 'oauth2';

interface AuthConfig {
  type: AuthType;
  bearerToken?: string;
  basicUsername?: string;
  basicPassword?: string;
  apiKeyKey?: string;
  apiKeyValue?: string;
  apiKeyLocation?: 'header' | 'query';
  oauth2Token?: string;
}

type RequestTab = 'params' | 'headers' | 'body' | 'auth' | 'settings';
type ResponseTab = 'preview' | 'raw' | 'headers';

export interface SavedApiRequest {
  id: string;
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD';
  url: string;
  headers: string;
  queryParams?: QueryParam[];
  bodyType: BodyType;
  body?: string;
  formData?: FormDataField[];
  binaryData?: string;
  timeout: number;
  response?: ApiResponse;
  folderId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export function ApiClient() {
  const [method, setMethod] = useState<'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD'>('GET');
  const [url, setUrl] = useState('');
  const [headersList, setHeadersList] = useState<Header[]>([
    { key: 'Content-Type', value: 'application/json', enabled: true }
  ]);
  const [bodyType, setBodyType] = useState<BodyType>('json');
  const [body, setBody] = useState('');
  const [formData, setFormData] = useState<FormDataField[]>([
    { key: '', value: '', type: 'text', enabled: true }
  ]);
  const [queryParams, setQueryParams] = useState<QueryParam[]>([
    { key: '', value: '', enabled: true }
  ]);
  const [baseUrl, setBaseUrl] = useState<string>('');
  const [urlInput, setUrlInput] = useState<string>(''); // Raw URL input value (not computed)
  const urlDebounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [binaryData, setBinaryData] = useState<string>('');
  const [timeout, setRequestTimeout] = useState(30000);
  const [activeRequestTab, setActiveRequestTab] = useState<RequestTab>('params');
  const [activeResponseTab, setActiveResponseTab] = useState<ResponseTab>('preview');
  const [authConfig, setAuthConfig] = useState<AuthConfig>({ type: 'none' });
  const [followRedirects, setFollowRedirects] = useState(true);
  const [sslVerification, setSslVerification] = useState(true);

  // Convert headers list to JSON string for backward compatibility
  const headers = JSON.stringify(
    headersList
      .filter(h => h.enabled && h.key)
      .reduce((acc, h) => ({ ...acc, [h.key]: h.value }), {}),
    null,
    2
  );

  // Build URL with query parameters
  const buildUrlWithQueryParams = (base: string, params: QueryParam[]): string => {
    const enabledParams = params.filter(p => p.enabled && p.key);
    if (enabledParams.length === 0) return base;

    // Only use URL API if base is a valid absolute URL
    if (base && (base.startsWith('http://') || base.startsWith('https://'))) {
      try {
        const urlObj = new URL(base);
        enabledParams.forEach(param => {
          urlObj.searchParams.append(param.key, param.value);
        });
        return urlObj.toString();
      } catch (e) {
        // Fall through to manual construction
      }
    }

    // Manual construction for relative URLs or invalid URLs
    const separator = base.includes('?') ? '&' : '?';
    const queryString = enabledParams.map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join('&');
    return `${base}${separator}${queryString}`;
  };

  // Parse URL to extract base and query params
  const parseUrl = (fullUrl: string): { base: string; params: QueryParam[] } => {
    // Only use URL API if it's a valid absolute URL
    if (fullUrl && (fullUrl.startsWith('http://') || fullUrl.startsWith('https://'))) {
      try {
        const urlObj = new URL(fullUrl);
        const base = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;
        const params: QueryParam[] = [];
        urlObj.searchParams.forEach((value, key) => {
          params.push({ key, value, enabled: true });
        });
        return { base, params };
      } catch (e) {
        // Fall through to manual parsing
      }
    }

    // Manual parsing for relative URLs or invalid URLs
    const queryIndex = fullUrl.indexOf('?');
    if (queryIndex >= 0) {
      const base = fullUrl.substring(0, queryIndex);
      const queryString = fullUrl.substring(queryIndex + 1);
      const urlParams = new URLSearchParams(queryString);
      const params: QueryParam[] = [];
      urlParams.forEach((value, key) => {
        params.push({ key, value, enabled: true });
      });
      return { base, params };
    }
    return { base: fullUrl, params: [] };
  };

  // Compute the full URL with query parameters for display
  // Always use urlInput if it exists (even if empty string), only fall back to computed URL if urlInput is null/undefined
  const displayUrl = urlInput !== undefined && urlInput !== null
    ? urlInput
    : (() => {
      if (!baseUrl && !url) return '';
      const currentBase = baseUrl || url.split('?')[0];
      return buildUrlWithQueryParams(currentBase, queryParams);
    })();

  // Track if user is actively typing (to prevent interference)
  const isTypingRef = useRef(false);

  // Debounced URL parsing - only parse after user stops typing
  useEffect(() => {
    // Clear existing timeout
    if (urlDebounceTimeoutRef.current) {
      clearTimeout(urlDebounceTimeoutRef.current);
    }

    // If urlInput is empty, clear state immediately (no debounce needed)
    if (urlInput === '') {
      isTypingRef.current = false;
      // Clear state if input is empty
      if (url !== '') {
        setUrl('');
        setBaseUrl('');
      }
      return;
    }

    // Only parse if urlInput is different from current url
    if (urlInput === url) {
      isTypingRef.current = false;
      return;
    }

    isTypingRef.current = true;

    // Debounce parsing (500ms delay)
    urlDebounceTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      try {
        // Only parse if urlInput is not empty and looks like a valid URL
        if (!urlInput || urlInput.trim() === '') {
          urlDebounceTimeoutRef.current = null;
          return;
        }

        const { base, params } = parseUrl(urlInput.trim());

        // Validate that base is not empty or just whitespace
        if (!base || base.trim() === '') {
          urlDebounceTimeoutRef.current = null;
          return;
        }

        setBaseUrl(base);
        setUrl(urlInput.trim());
        // Only update queryParams if we found params in the URL
        if (params.length > 0) {
          setQueryParams([...params, { key: '', value: '', enabled: true }]);
        }
      } catch (err) {
        console.error('Failed to parse URL:', err);
      }
      urlDebounceTimeoutRef.current = null;
    }, 500);

    return () => {
      if (urlDebounceTimeoutRef.current) {
        clearTimeout(urlDebounceTimeoutRef.current);
      }
    };
  }, [urlInput, url]);

  // Update URL when queryParams change (but only if user is not typing and urlInput matches current url)
  useEffect(() => {
    // Only update if:
    // 1. We have a baseUrl
    // 2. User is not actively typing
    // 3. urlInput matches the current url (meaning user finished typing and it was parsed)
    // 4. urlInput is not empty (don't override empty input)
    if (baseUrl && !isTypingRef.current && urlInput === url && urlInput !== '') {
      const newUrl = buildUrlWithQueryParams(baseUrl, queryParams);
      if (newUrl !== url && newUrl !== urlInput) {
        setUrl(newUrl);
        setUrlInput(newUrl); // Sync urlInput with computed URL
      }
    }
  }, [queryParams, baseUrl, urlInput, url]);

  // Handle URL input change - just update the input value, don't parse immediately
  const handleUrlChange = (newUrl: string) => {
    // Always set urlInput, even if empty - this is the source of truth
    setUrlInput(newUrl);
    // Clear any pending debounce timeout to restart the timer
    if (urlDebounceTimeoutRef.current) {
      clearTimeout(urlDebounceTimeoutRef.current);
      urlDebounceTimeoutRef.current = null;
    }
    // If user clears the input, also clear the underlying state
    if (newUrl === '') {
      setBaseUrl('');
      setUrl('');
    }
  };

  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [showImportExport, setShowImportExport] = useState(false);
  const [importExportMode, setImportExportMode] = useState<'import' | 'export'>('import');
  const [importExportType, setImportExportType] = useState<'swagger' | 'postman' | 'curl' | undefined>(undefined);
  const [requests, setRequests] = useState<SavedApiRequest[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<string | null>(null);
  const [requestName, setRequestName] = useState<string>('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['Today', 'Yesterday', 'This Week']));
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [showSidebar, setShowSidebar] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [draggedRequestId, setDraggedRequestId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [highlightedRequestId, setHighlightedRequestId] = useState<string | null>(null);
  const [variables, setVariables] = useState<Variable[]>([]);
  const [showVariablesManager, setShowVariablesManager] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const binaryFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadRequests();
    loadFolders();
    loadVariables();
  }, []);

  // Track last folderId we loaded variables for
  const lastVariablesFolderIdRef = useRef<string | null | undefined>(undefined);

  // Reload variables when selected request changes (to get folder-specific variables)
  // Note: We include 'requests' in dependencies to get the latest folderId, but we only
  // reload variables if the folderId actually changed (not on every field edit)
  useEffect(() => {
    if (selectedRequest) {
      const request = requests.find(r => r.id === selectedRequest);
      const folderId = request?.folderId;
      // Only reload if folderId actually changed
      if (lastVariablesFolderIdRef.current !== folderId) {
        loadVariables(folderId);
        lastVariablesFolderIdRef.current = folderId;
      }
    } else {
      // Only reload if we were previously loading for a specific folder
      if (lastVariablesFolderIdRef.current !== null) {
        loadVariables();
        lastVariablesFolderIdRef.current = null;
      }
    }
  }, [selectedRequest, requests]); // Keep 'requests' to avoid stale closures, but check folderId before reloading

  // Clear highlight after 3 seconds
  useEffect(() => {
    if (highlightedRequestId) {
      const timer = setTimeout(() => {
        setHighlightedRequestId(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [highlightedRequestId]);

  const loadRequests = async () => {
    try {
      // Try to load from file storage first
      if ((window as any).electronAPI?.apiClient?.get) {
        try {
          const result = await (window as any).electronAPI.apiClient.get();
          if (result.success && result.requests && result.requests.length > 0) {
            setRequests(result.requests);
            // Also update localStorage for backward compatibility
            localStorage.setItem('devbench-api-requests', JSON.stringify(result.requests));
            return;
          }
        } catch (err) {
          console.warn('Failed to load from file storage, falling back to localStorage:', err);
        }
      }
      
      // Fallback to localStorage
      const stored = localStorage.getItem('devbench-api-requests');
      if (stored) {
        const parsed = JSON.parse(stored);
        setRequests(parsed);
        // Migrate to file storage if we have data in localStorage
        if ((window as any).electronAPI?.apiClient?.save && parsed.length > 0) {
          try {
            await (window as any).electronAPI.apiClient.save(parsed);
          } catch (err) {
            console.warn('Failed to migrate to file storage:', err);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load API requests:', err);
    }
  };

  const loadFolders = async () => {
    try {
      const loadedFolders = getFolders(null);
      loadedFolders.sort((a, b) => {
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        return dateB - dateA;
      });
      setFolders(loadedFolders);
    } catch (err) {
      console.error('Failed to load folders:', err);
    }
  };

  const loadVariables = async (folderId?: string | null) => {
    try {
      const vars = await getVariables(folderId);
      setVariables(vars);
    } catch (err) {
      console.error('Failed to load variables:', err);
    }
  };

  // Get current folder ID for variable validation
  const currentFolderId = selectedRequest
    ? requests.find(r => r.id === selectedRequest)?.folderId || null
    : null;

  // Helper function to get border color class based on variable validity
  const getVariableBorderClass = (text: string): string => {
    if (!text) return '';
    const isValid = areVariablesValid(text, variables, currentFolderId);
    return isValid
      ? 'border-green-500/50 focus:border-green-500'
      : 'border-red-500/50 focus:border-red-500';
  };

  const saveRequests = async (updatedRequests: SavedApiRequest[]) => {
    try {
      // Save to localStorage first for immediate UI update
      localStorage.setItem('devbench-api-requests', JSON.stringify(updatedRequests));
      setRequests(updatedRequests);
      
      // Save each request individually to file storage and trigger Git sync
      if ((window as any).electronAPI?.apiClient?.saveRequest) {
        try {
          // Save all requests in parallel
          const savePromises = updatedRequests.map(request => 
            (window as any).electronAPI.apiClient.saveRequest(request)
          );
          const results = await Promise.all(savePromises);
          
          // Check for any failures
          const failures = results.filter(r => !r.success);
          if (failures.length > 0) {
            console.error('Failed to save some API requests to file storage:', failures);
          }
        } catch (err) {
          console.error('Failed to save API requests to file storage:', err);
        }
      }
    } catch (err) {
      console.error('Failed to save API requests:', err);
    }
  };
  
  const saveRequest = async (request: SavedApiRequest) => {
    try {
      // Update local state
      const updatedRequests = requests.map(r => r.id === request.id ? request : r);
      if (!updatedRequests.find(r => r.id === request.id)) {
        updatedRequests.push(request);
      }
      localStorage.setItem('devbench-api-requests', JSON.stringify(updatedRequests));
      setRequests(updatedRequests);
      
      // Save individual request to file storage
      if ((window as any).electronAPI?.apiClient?.saveRequest) {
        try {
          const result = await (window as any).electronAPI.apiClient.saveRequest(request);
          if (!result.success) {
            console.error('Failed to save API request to file storage:', result.error);
          }
        } catch (err) {
          console.error('Failed to save API request to file storage:', err);
        }
      }
    } catch (err) {
      console.error('Failed to save API request:', err);
    }
  };

  const handleCreateFolder = () => {
    if (!newFolderName.trim()) {
      setShowNewFolderInput(true);
      return;
    }
    
    try {
      const newFolder = saveFolder({
        name: newFolderName.trim(),
        parentId: null,
      });
      if (newFolder) {
        loadFolders();
        setNewFolderName('');
        setShowNewFolderInput(false);
        // Auto-expand the new folder
        if (newFolder.id) {
          setExpandedFolders(prev => new Set(prev).add(newFolder.id!));
        }
        if ((window as any).showToast) {
          (window as any).showToast('Folder created successfully', 'success');
        }
      } else {
        if ((window as any).showToast) {
          (window as any).showToast('Failed to create folder', 'error');
        }
      }
    } catch (err) {
      console.error('Failed to create folder:', err);
      if ((window as any).showToast) {
        (window as any).showToast('Failed to create folder', 'error');
      }
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    if (!confirm('Delete this folder? Items inside will be moved to root.')) return;
    try {
      const success = deleteFolder(folderId);
      if (success) {
        const requestsInFolder = requests.filter(r => r.folderId === folderId);
        const updatedRequests = requests.map(r => {
          if (r.folderId === folderId) {
            return { ...r, folderId: null };
          }
          return r;
        });
        saveRequests(updatedRequests);
        await loadFolders();
        await loadRequests();
      }
    } catch (err) {
      console.error('Failed to delete folder:', err);
    }
  };

  const handleDragStart = (e: React.DragEvent, requestId: string) => {
    e.stopPropagation();
    setDraggedRequestId(requestId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/x-request-id', requestId);
    e.dataTransfer.setData('text/plain', '');
  };

  const handleDragOver = (e: React.DragEvent, folderId: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setDragOverFolderId(folderId);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setDragOverFolderId(null);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetFolderId: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolderId(null);

    const requestId = e.dataTransfer.getData('application/x-request-id') || draggedRequestId;
    if (!requestId) {
      setDraggedRequestId(null);
      return;
    }

    const request = requests.find(r => r.id === requestId);
    if (!request || request.folderId === targetFolderId) {
      setDraggedRequestId(null);
      return;
    }

    try {
      const updatedRequests = requests.map(r => {
        if (r.id === requestId) {
          return { ...r, folderId: targetFolderId };
        }
        return r;
      });
      await saveRequests(updatedRequests);

      // Sync the moved request to backend
      // Sync removed - using file storage
      if (targetFolderId) {
        setExpandedFolders(prev => new Set(prev).add(targetFolderId));
      }
    } catch (err) {
      console.error('Failed to move request:', err);
    } finally {
      setDraggedRequestId(null);
    }
  };

  const toggleFolder = (folderId: string) => {
    const normalizedId = String(folderId || '');
    if (!normalizedId) return;
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(normalizedId)) {
        newSet.delete(normalizedId);
      } else {
        newSet.add(normalizedId);
      }
      return newSet;
    });
  };

  const getRequestsInFolder = (folderId: string | null) => {
    if (folderId === null) {
      return requests.filter(request => request.folderId === null || request.folderId === undefined);
    } else {
      return requests.filter(request => request.folderId === folderId);
    }
  };

  const toggleGroup = (label: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(label)) {
        newSet.delete(label);
      } else {
        newSet.add(label);
      }
      return newSet;
    });
  };

  const handleSelectRequest = (requestId: string) => {
    const request = requests.find(r => r.id === requestId);
    if (request) {
      setSelectedRequest(requestId);
      setRequestName(request.name);
      setMethod(request.method);

      // Parse URL to extract base URL and query parameters
      const requestUrl = request.url;
      const { base, params } = parseUrl(requestUrl);
      setBaseUrl(base);
      setUrl(requestUrl);
      setUrlInput(requestUrl); // Update input value

      // Use saved queryParams if available, otherwise use parsed ones
      if (request.queryParams && request.queryParams.length > 0) {
        setQueryParams(request.queryParams);
      } else if (params.length > 0) {
        setQueryParams([...params, { key: '', value: '', enabled: true }]);
      } else {
        setQueryParams([{ key: '', value: '', enabled: true }]);
      }

      // Parse headers string and convert to headersList
      try {
        const parsedHeaders = typeof request.headers === 'string'
          ? JSON.parse(request.headers)
          : request.headers;
        const headersArray: Header[] = Object.entries(parsedHeaders || {}).map(([key, value]) => ({
          key,
          value: String(value),
          enabled: true
        }));
        if (headersArray.length > 0) {
          setHeadersList([...headersArray, { key: '', value: '', enabled: true }]);
        } else {
          setHeadersList([{ key: '', value: '', enabled: true }]);
        }
      } catch (e) {
        setHeadersList([{ key: '', value: '', enabled: true }]);
      }

      setBodyType(request.bodyType);
      setBody(request.body || '');
      setFormData(request.formData || [{ key: '', value: '', type: 'text', enabled: true }]);
      setBinaryData(request.binaryData || '');
      setRequestTimeout(request.timeout);
      setResponse(request.response || null);
    }
  };

  const handleDeleteRequest = async (requestId: string) => {
    if (!confirm('Delete this request?')) return;
    try {
      // Delete from file storage
      if ((window as any).electronAPI?.apiClient?.deleteRequest) {
        try {
          const result = await (window as any).electronAPI.apiClient.deleteRequest(requestId);
          if (!result.success) {
            console.error('Failed to delete API request from file storage:', result.error);
          }
        } catch (err) {
          console.error('Failed to delete API request from file storage:', err);
        }
      }
      
      // Update local state
      const updatedRequests = requests.filter(r => r.id !== requestId);
      localStorage.setItem('devbench-api-requests', JSON.stringify(updatedRequests));
      setRequests(updatedRequests);
      
      if (selectedRequest === requestId) {
        setSelectedRequest(null);
        setRequestName('');
        setMethod('GET');
        setUrl('');
        setBaseUrl('');
        setUrlInput(''); // Clear input value
        setHeadersList([{ key: 'Content-Type', value: 'application/json', enabled: true }]);
        setQueryParams([{ key: '', value: '', enabled: true }]);
        setBodyType('json');
        setBody('');
        setFormData([{ key: '', value: '', type: 'text', enabled: true }]);
        setBinaryData('');
        setResponse(null);
        setAuthConfig({ type: 'none' });
      }
    } catch (err) {
      console.error('Failed to delete request:', err);
    }
  };

  const handleCreateRequest = () => {
    setSelectedRequest(null);
    setRequestName('');
    setMethod('GET');
    setUrl('');
    setBaseUrl('');
    setUrlInput(''); // Clear input value
    setHeadersList([{ key: 'Content-Type', value: 'application/json', enabled: true }]);
    setQueryParams([{ key: '', value: '', enabled: true }]);
    setBodyType('json');
    setBody('');
    setFormData([{ key: '', value: '', type: 'text', enabled: true }]);
    setBinaryData('');
    setResponse(null);
    setAuthConfig({ type: 'none' });
  };


  // Update Content-Type header when body type changes
  useEffect(() => {
    const contentTypeIndex = headersList.findIndex(h => h.key.toLowerCase() === 'content-type');

    if (bodyType === 'json') {
      if (contentTypeIndex >= 0) {
        const updated = [...headersList];
        updated[contentTypeIndex] = { ...updated[contentTypeIndex], value: 'application/json', enabled: true };
        setHeadersList(updated);
      } else {
        setHeadersList([...headersList, { key: 'Content-Type', value: 'application/json', enabled: true }]);
      }
    } else if (bodyType === 'x-www-form-urlencoded') {
      if (contentTypeIndex >= 0) {
        const updated = [...headersList];
        updated[contentTypeIndex] = { ...updated[contentTypeIndex], value: 'application/x-www-form-urlencoded', enabled: true };
        setHeadersList(updated);
      } else {
        setHeadersList([...headersList, { key: 'Content-Type', value: 'application/x-www-form-urlencoded', enabled: true }]);
      }
    } else if (bodyType === 'form-data') {
      if (contentTypeIndex >= 0) {
        const updated = [...headersList];
        updated.splice(contentTypeIndex, 1);
        setHeadersList(updated);
      }
    } else if (bodyType === 'binary') {
      if (contentTypeIndex >= 0) {
        const updated = [...headersList];
        updated[contentTypeIndex] = { ...updated[contentTypeIndex], value: 'application/octet-stream', enabled: true };
        setHeadersList(updated);
      } else {
        setHeadersList([...headersList, { key: 'Content-Type', value: 'application/octet-stream', enabled: true }]);
      }
    } else if (bodyType === 'none') {
      if (contentTypeIndex >= 0) {
        const updated = [...headersList];
        updated.splice(contentTypeIndex, 1);
        setHeadersList(updated);
      }
    }
  }, [bodyType]);


  const handleRequest = async () => {
    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      // Get current folder ID for variable resolution
      const currentFolderId = selectedRequest
        ? requests.find(r => r.id === selectedRequest)?.folderId || null
        : null;

      // Replace variables in URL
      let resolvedUrl = replaceVariables(url, variables, currentFolderId);

      // Replace variables in headers
      let parsedHeaders: Record<string, string> = {};
      headersList
        .filter(h => h.enabled && h.key)
        .forEach(h => {
          const resolvedKey = replaceVariables(h.key, variables, currentFolderId);
          const resolvedValue = replaceVariables(h.value, variables, currentFolderId);
          parsedHeaders[resolvedKey] = resolvedValue;
        });

      // Replace variables in auth config
      let resolvedAuthConfig = { ...authConfig };
      if (authConfig.type === 'bearer' && authConfig.bearerToken) {
        resolvedAuthConfig.bearerToken = replaceVariables(authConfig.bearerToken, variables, currentFolderId);
        parsedHeaders['Authorization'] = `Bearer ${resolvedAuthConfig.bearerToken}`;
      } else if (authConfig.type === 'basic' && authConfig.basicUsername && authConfig.basicPassword) {
        const resolvedUsername = replaceVariables(authConfig.basicUsername, variables, currentFolderId);
        const resolvedPassword = replaceVariables(authConfig.basicPassword, variables, currentFolderId);
        const credentials = btoa(`${resolvedUsername}:${resolvedPassword}`);
        parsedHeaders['Authorization'] = `Basic ${credentials}`;
      } else if (authConfig.type === 'apikey' && authConfig.apiKeyKey && authConfig.apiKeyValue) {
        const resolvedKey = replaceVariables(authConfig.apiKeyKey, variables, currentFolderId);
        const resolvedValue = replaceVariables(authConfig.apiKeyValue, variables, currentFolderId);
        if (authConfig.apiKeyLocation === 'header') {
          parsedHeaders[resolvedKey] = resolvedValue;
        }
      } else if (authConfig.type === 'oauth2' && authConfig.oauth2Token) {
        const resolvedToken = replaceVariables(authConfig.oauth2Token, variables, currentFolderId);
        parsedHeaders['Authorization'] = `Bearer ${resolvedToken}`;
      }

      // Replace variables in query params
      const resolvedQueryParams = queryParams
        .filter(p => p.enabled && p.key)
        .map(p => ({
          key: replaceVariables(p.key, variables, currentFolderId),
          value: replaceVariables(p.value, variables, currentFolderId),
          enabled: p.enabled
        }));

      // Add API key to query params if needed
      if (authConfig.type === 'apikey' && authConfig.apiKeyLocation === 'query' && authConfig.apiKeyKey && authConfig.apiKeyValue) {
        const resolvedKey = replaceVariables(authConfig.apiKeyKey, variables, currentFolderId);
        const resolvedValue = replaceVariables(authConfig.apiKeyValue, variables, currentFolderId);
        const apiKeyParam = resolvedQueryParams.find(p => p.key === resolvedKey);
        if (!apiKeyParam) {
          resolvedQueryParams.push({ key: resolvedKey, value: resolvedValue, enabled: true });
        }
      }

      // Replace variables in body
      let resolvedBody = body;
      if (bodyType === 'json' || bodyType === 'raw') {
        if (body) {
          try {
            const parsed = JSON.parse(body);
            resolvedBody = JSON.stringify(replaceVariablesInObject(parsed, variables, currentFolderId), null, 2);
          } catch {
            resolvedBody = replaceVariables(body, variables, currentFolderId);
          }
        }
      }

      // Replace variables in form data
      const resolvedFormData = formData
        .filter(f => f.enabled && f.key)
        .map(f => ({
          key: replaceVariables(f.key, variables, currentFolderId),
          value: replaceVariables(f.value, variables, currentFolderId),
          type: f.type,
          enabled: f.enabled
        }));

      const request: ApiRequest = {
        method,
        url: resolvedUrl,
        headers: parsedHeaders,
        queryParams: resolvedQueryParams,
        bodyType,
        timeout: timeout || 30000,
      };

      if (bodyType === 'json' || bodyType === 'raw') {
        request.body = resolvedBody || undefined;
      } else if (bodyType === 'form-data' || bodyType === 'x-www-form-urlencoded') {
        request.formData = resolvedFormData;
      } else if (bodyType === 'binary') {
        request.binaryData = replaceVariables(binaryData, variables, currentFolderId);
      }

      const result = await apiClient.makeRequest(request);
      setResponse(result);

      let updatedRequests: SavedApiRequest[];
      let requestToUpdate: SavedApiRequest | null = null;
      let requestIndex = -1;

      // First, check if there's a selected request - if so, update that one
      if (selectedRequest) {
        requestIndex = requests.findIndex(r => r.id === selectedRequest);
        if (requestIndex >= 0) {
          requestToUpdate = requests[requestIndex];
        }
      }

      // If no selected request, check if a request with the same signature already exists
      if (!requestToUpdate) {
        // Helper function to normalize formData for comparison
        const normalizeFormData = (fd?: FormDataField[]) => {
          if (!fd) return undefined;
          return fd
            .filter(f => f.enabled && f.key)
            .map(f => ({ key: f.key, value: f.value, type: f.type }))
            .sort((a, b) => {
              if (a.key !== b.key) return a.key.localeCompare(b.key);
              return a.value.localeCompare(b.value);
            });
        };

        // Normalize current formData for comparison
        const normalizedFormData = normalizeFormData(
          (bodyType === 'form-data' || bodyType === 'x-www-form-urlencoded') ? formData : undefined
        );

        const requestSignature = JSON.stringify({
          method,
          url,
          headers: parsedHeaders,
          bodyType,
          body: bodyType === 'json' || bodyType === 'raw' ? (body || '').trim() : undefined,
          formData: normalizedFormData,
          binaryData: bodyType === 'binary' ? binaryData : undefined,
        });

        requestIndex = requests.findIndex(r => {
          try {
            const existingHeaders = JSON.parse(r.headers);
            // Normalize existing formData for comparison
            const existingFormData = normalizeFormData(
              (r.bodyType === 'form-data' || r.bodyType === 'x-www-form-urlencoded') ? r.formData : undefined
            );

            const existingSignature = JSON.stringify({
              method: r.method,
              url: r.url,
              headers: existingHeaders,
              bodyType: r.bodyType,
              body: r.bodyType === 'json' || r.bodyType === 'raw' ? (r.body || '').trim() : undefined,
              formData: existingFormData,
              binaryData: r.binaryData,
            });
            return existingSignature === requestSignature;
          } catch {
            return false;
          }
        });

        if (requestIndex >= 0) {
          requestToUpdate = requests[requestIndex];
        }
      }

      if (requestToUpdate && requestIndex >= 0) {
        // Update existing request instead of creating a new one
        const updatedRequest: SavedApiRequest = {
          ...requestToUpdate,
          name: requestName || requestToUpdate.name || `${method} ${url}` || 'Untitled Request',
          method,
          url,
          headers: JSON.stringify(parsedHeaders, null, 2),
          bodyType,
          body: bodyType === 'json' || bodyType === 'raw' ? body : undefined,
          formData: bodyType === 'form-data' || bodyType === 'x-www-form-urlencoded' ? formData : undefined,
          binaryData: bodyType === 'binary' ? binaryData : undefined,
          timeout,
          response: result,
          updatedAt: new Date().toISOString(),
        };
        updatedRequests = [...requests];
        updatedRequests[requestIndex] = updatedRequest;

        // Update selected request if it was the one we updated
        if (selectedRequest === requestToUpdate.id) {
          setSelectedRequest(requestToUpdate.id);
          setRequestName(updatedRequest.name);
        }
      } else {
        // Create new request only if no existing request found
        const savedRequest: SavedApiRequest = {
          id: Date.now().toString(),
          name: requestName || `${method} ${url}` || 'Untitled Request',
          method,
          url,
          headers: JSON.stringify(parsedHeaders, null, 2),
          bodyType,
          body: bodyType === 'json' || bodyType === 'raw' ? body : undefined,
          formData: bodyType === 'form-data' || bodyType === 'x-www-form-urlencoded' ? formData : undefined,
          binaryData: bodyType === 'binary' ? binaryData : undefined,
          timeout,
          response: result,
          folderId: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        updatedRequests = [...requests, savedRequest];
      }

      // Save the updated/created request individually
      const requestToSync = requestToUpdate && requestIndex >= 0
        ? updatedRequests[requestIndex]
        : updatedRequests[updatedRequests.length - 1];
      
      if (requestToSync) {
        await saveRequest(requestToSync);
      } else {
        await saveRequests(updatedRequests);
      }

      setRequestName('');
    } catch (err) {
      // Extract detailed error information
      let errorMessage = 'Request failed';
      
      if (err instanceof Error) {
        errorMessage = err.message;
        
        // Check for status code in error
        if ((err as any).status) {
          errorMessage = `${(err as any).status} ${(err as any).statusText || err.message}`;
        }
        
        // Check for error code (like ECONNREFUSED)
        if ((err as any).code) {
          errorMessage = `${err.message} (${(err as any).code})`;
        }
        
        // Check for original error details
        if ((err as any).originalError) {
          const originalErr = (err as any).originalError;
          if (originalErr.message) {
            errorMessage = `${errorMessage} - ${originalErr.message}`;
          }
        }
      } else if (typeof err === 'string') {
        errorMessage = err;
      } else if (err && typeof err === 'object') {
        // Handle various error object formats
        errorMessage = (err as any).error || (err as any).message || String(err);
        
        // If still showing [object Object], try to extract more details
        if (errorMessage === '[object Object]' || errorMessage.includes('[object Object]')) {
          try {
            // Try to get error from nested structure
            const errorObj = (err as any).error || err;
            if (typeof errorObj === 'object' && errorObj !== null) {
              errorMessage = errorObj.error || errorObj.message || JSON.stringify(errorObj, null, 2);
            } else {
              errorMessage = JSON.stringify(err, null, 2);
            }
          } catch (e) {
            errorMessage = 'Request failed - Unable to parse error details';
          }
        }
        
        // Add error code if available
        if ((err as any).code) {
          errorMessage = `${errorMessage} (${(err as any).code})`;
        }
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleImportCurl = async (parsed: ReturnType<typeof parseCurl>, saveToFolder: boolean, folderId: string | null, requestName: string) => {
    if (!parsed) {
      setError('Failed to parse curl command. Please check the format.');
      return;
    }

    setMethod(parsed.method as any);
    setUrl(parsed.url);
    setUrlInput(parsed.url); // Update input value
    // Convert headers object to headersList
    const headersArray: Header[] = Object.entries(parsed.headers).map(([key, value]) => ({
      key,
      value: String(value),
      enabled: true
    }));
    if (headersArray.length > 0) {
      setHeadersList([...headersArray, { key: '', value: '', enabled: true }]);
    } else {
      setHeadersList([{ key: '', value: '', enabled: true }]);
    }
    if (parsed.queryParams && parsed.queryParams.length > 0) {
      setQueryParams(parsed.queryParams.map(qp => ({ ...qp, enabled: true })));
    } else {
      setQueryParams([{ key: '', value: '', enabled: true }]);
    }
    if (parsed.body) {
      setBody(parsed.body);
      setBodyType('json');
    }

    // If saveToFolder is true, save the request
    if (saveToFolder) {
      let defaultName = `${parsed.method} Request`;
      try {
        const urlObj = new URL(parsed.url);
        const pathParts = urlObj.pathname.split('/').filter(p => p);
        defaultName = `${parsed.method} ${pathParts[pathParts.length - 1] || 'Request'}`;
      } catch (e) {
        // If URL parsing fails, use default name
      }
      const finalRequestName = requestName.trim() || defaultName;
      const newRequest: SavedApiRequest = {
        id: Date.now().toString(),
        name: finalRequestName,
        method: parsed.method as any,
        url: parsed.url,
        headers: JSON.stringify(
          headersArray
            .filter(h => h.enabled && h.key)
            .reduce((acc, h) => ({ ...acc, [h.key]: h.value }), {}),
          null,
          2
        ),
        queryParams: parsed.queryParams?.map(qp => ({ key: qp.key, value: qp.value, enabled: true })) || [],
        bodyType: parsed.body ? 'json' : 'none',
        body: parsed.body || '',
        formData: [],
        binaryData: '',
        timeout: 30000,
        folderId: folderId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const updatedRequests = [...requests, newRequest];
      await saveRequest(newRequest);
      setSelectedRequest(newRequest.id);
      setRequestName(finalRequestName);
    }

    setError(null);
  };

  const generateCurlCommand = (): string => {
    if (!url) {
      return '';
    }

    const parts: string[] = ['curl'];

    // Add method
    if (method !== 'GET') {
      parts.push(`-X ${method}`);
    }

    // Build URL with query parameters
    let finalUrl = url;
    const enabledParams = queryParams.filter(p => p.enabled && p.key);

    // Add API key to query params if needed
    if (authConfig.type === 'apikey' && authConfig.apiKeyLocation === 'query' && authConfig.apiKeyKey && authConfig.apiKeyValue) {
      enabledParams.push({ key: authConfig.apiKeyKey, value: authConfig.apiKeyValue, enabled: true });
    }

    if (enabledParams.length > 0) {
      try {
        const urlObj = new URL(url);
        enabledParams.forEach(param => {
          urlObj.searchParams.append(param.key, param.value);
        });
        finalUrl = urlObj.toString();
      } catch (e) {
        // If URL is not valid, append query params manually
        const separator = url.includes('?') ? '&' : '?';
        const queryString = enabledParams.map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join('&');
        finalUrl = `${url}${separator}${queryString}`;
      }
    }
    parts.push(`'${finalUrl.replace(/'/g, "'\\''")}'`);

    // Add headers
    const enabledHeaders = headersList.filter(h => h.enabled && h.key);

    // Add auth headers from authConfig
    if (authConfig.type === 'bearer' && authConfig.bearerToken) {
      enabledHeaders.push({ key: 'Authorization', value: `Bearer ${authConfig.bearerToken}`, enabled: true });
    } else if (authConfig.type === 'basic' && authConfig.basicUsername && authConfig.basicPassword) {
      const credentials = btoa(`${authConfig.basicUsername}:${authConfig.basicPassword}`);
      enabledHeaders.push({ key: 'Authorization', value: `Basic ${credentials}`, enabled: true });
    } else if (authConfig.type === 'apikey' && authConfig.apiKeyKey && authConfig.apiKeyValue) {
      if (authConfig.apiKeyLocation === 'header') {
        enabledHeaders.push({ key: authConfig.apiKeyKey, value: authConfig.apiKeyValue, enabled: true });
      }
    } else if (authConfig.type === 'oauth2' && authConfig.oauth2Token) {
      enabledHeaders.push({ key: 'Authorization', value: `Bearer ${authConfig.oauth2Token}`, enabled: true });
    }

    enabledHeaders.forEach(header => {
      const escapedValue = header.value.replace(/'/g, "'\\''");
      parts.push(`-H '${header.key}: ${escapedValue}'`);
    });

    // Add body
    if (bodyType === 'json' && body) {
      try {
        // Try to minify JSON
        const parsed = JSON.parse(body);
        const minified = JSON.stringify(parsed);
        parts.push(`-d '${minified.replace(/'/g, "'\\''")}'`);
      } catch {
        parts.push(`-d '${body.replace(/'/g, "'\\''")}'`);
      }
    } else if (bodyType === 'raw' && body) {
      parts.push(`-d '${body.replace(/'/g, "'\\''")}'`);
    } else if (bodyType === 'x-www-form-urlencoded' && body) {
      parts.push(`-d '${body.replace(/'/g, "'\\''")}'`);
    } else if (bodyType === 'form-data' && formData.length > 0) {
      const enabledFormData = formData.filter(f => f.enabled && f.key);
      enabledFormData.forEach(field => {
        if (field.type === 'file') {
          // For files, we can't include the actual file content in cURL easily
          // Just show a placeholder
          parts.push(`-F '${field.key}=@<file>'`);
        } else {
          const escapedValue = field.value.replace(/'/g, "'\\''");
          parts.push(`-F '${field.key}=${escapedValue}'`);
        }
      });
    } else if (bodyType === 'binary' && binaryData) {
      // For binary data, we'd typically use --data-binary with a file
      // Since we have base64, we'll skip it or show a placeholder
      parts.push(`--data-binary '@<file>'`);
    }

    return parts.join(' \\\n  ');
  };

  const handleCopyAsCurl = async () => {
    const curlCommand = generateCurlCommand();
    if (!curlCommand) {
      setError('Please enter a URL first');
      return;
    }

    try {
      await navigator.clipboard.writeText(curlCommand);
      setError(null);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      setError('Failed to copy to clipboard');
    }
  };

  const handleImportSwaggerPostman = async (importedRequests: ParsedSwaggerRequest[] | ParsedPostmanRequest[]) => {
    try {
      setLoading(true);
      setError(null);

      // Extract folders from requests
      const folderMap = new Map<string, string>();
      importedRequests.forEach((req) => {
        const folderKey = 'tag' in req && req.tag ? req.tag : ('folderPath' in req && req.folderPath ? req.folderPath : null);
        if (folderKey) {
          const folderName = folderKey.includes('/') ? folderKey.split('/').pop() || folderKey : folderKey;
          if (!folderMap.has(folderKey)) {
            folderMap.set(folderKey, folderName);
          }
        }
      });

      // Create folders if needed
      const createdFolders: Record<string, string> = {};
      for (const [key, name] of folderMap.entries()) {
        const existingFolder = folders.find(f => f.name === name);
        if (!existingFolder) {
          const newFolder = saveFolder({ name, parentId: null });
          if (newFolder && newFolder.id) {
            createdFolders[key] = newFolder.id;
          }
        } else if (existingFolder.id) {
          createdFolders[key] = existingFolder.id;
        }
      }

      // Convert imported requests to SavedApiRequest format
      const newRequests: SavedApiRequest[] = importedRequests.map((req) => {
        const folderKey = 'tag' in req && req.tag ? req.tag : ('folderPath' in req && req.folderPath ? req.folderPath : null);
        const folderId = folderKey ? createdFolders[folderKey] || null : null;

        return {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          name: req.name,
          method: req.method as any,
          url: req.url,
          headers: JSON.stringify(req.headers || {}, null, 2),
          queryParams: req.queryParams,
          bodyType: req.bodyType,
          body: req.body,
          formData: [],
          binaryData: '',
          timeout: 30000,
          folderId: folderId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      });

      // Save each new request individually
      for (const newRequest of newRequests) {
        await saveRequest(newRequest);
      }
      const updatedRequests = [...requests, ...newRequests];
      setRequests(updatedRequests);
      await loadFolders();

      setError(null);
      setHighlightedRequestId(newRequests[0]?.id || null);
      if (newRequests.length > 0) {
        setSelectedRequest(newRequests[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to import requests');
      console.error('Import error:', err);
    } finally {
      setLoading(false);
    }
  };


  const addQueryParam = () => {
    setQueryParams([...queryParams, { key: '', value: '', enabled: true }]);
  };

  const removeQueryParam = (index: number) => {
    setQueryParams(queryParams.filter((_, i) => i !== index));
  };

  const updateQueryParam = (index: number, param: Partial<QueryParam>) => {
    const updated = [...queryParams];
    updated[index] = { ...updated[index], ...param };
    setQueryParams(updated);
  };

  const addHeader = () => {
    setHeadersList([...headersList, { key: '', value: '', enabled: true }]);
  };

  const removeHeader = (index: number) => {
    setHeadersList(headersList.filter((_, i) => i !== index));
  };

  const updateHeader = (index: number, header: Partial<Header>) => {
    const updated = [...headersList];
    updated[index] = { ...updated[index], ...header };
    setHeadersList(updated);
  };

  const addFormDataField = () => {
    setFormData([...formData, { key: '', value: '', type: 'text', enabled: true }]);
  };

  const removeFormDataField = (index: number) => {
    setFormData(formData.filter((_, i) => i !== index));
  };

  const updateFormDataField = (index: number, field: Partial<FormDataField>) => {
    const updated = [...formData];
    updated[index] = { ...updated[index], ...field };
    setFormData(updated);
  };

  const handleFileSelect = (index: number, file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      updateFormDataField(index, { value: base64, type: 'file' });
    };
    reader.readAsDataURL(file);
  };

  const handleBinaryFileSelect = (file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      setBinaryData(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const renderBodyEditor = () => {
    if (bodyType === 'none') {
      return (
        <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400 text-sm">
          This request does not have a body
        </div>
      );
    }

    if (bodyType === 'form-data' || bodyType === 'x-www-form-urlencoded') {
      return (
        <div className="h-full overflow-auto p-4">
          <div className="space-y-2">
            <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-600 dark:text-gray-400 mb-2 pb-2 border-b border-gray-200 dark:border-gray-800">
              <div className="col-span-1 flex items-center">
                <input type="checkbox" checked={true} disabled className="w-3 h-3" />
              </div>
              <div className="col-span-3">Key</div>
              <div className="col-span-2">Type</div>
              <div className="col-span-5">Value</div>
              <div className="col-span-1"></div>
            </div>
            {formData.map((field, index) => (
              <div key={index} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-1 flex items-center">
                  <input
                    type="checkbox"
                    checked={field.enabled}
                    onChange={(e) => updateFormDataField(index, { enabled: e.target.checked })}
                    className="w-3 h-3"
                  />
                </div>
                <div className="col-span-3">
                  <input
                    type="text"
                    value={field.key}
                    onChange={(e) => updateFormDataField(index, { key: e.target.value })}
                    placeholder="Key"
                    className="w-full input-field text-xs py-1 px-2"
                  />
                </div>
                <div className="col-span-2">
                  <select
                    value={field.type}
                    onChange={(e) => {
                      const newType = e.target.value as 'text' | 'file';
                      updateFormDataField(index, { type: newType, value: newType === 'file' ? '' : field.value });
                    }}
                    className="w-full input-field text-xs py-1 px-2"
                  >
                    <option value="text">Text</option>
                    <option value="file">File</option>
                  </select>
                </div>
                <div className="col-span-5">
                  {field.type === 'file' ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileSelect(index, file);
                        }}
                        className="hidden"
                        id={`file-${index}`}
                      />
                      <label
                        htmlFor={`file-${index}`}
                        className="btn-secondary text-xs py-1 px-2 cursor-pointer"
                      >
                        {field.value ? 'Change File' : 'Choose File'}
                      </label>
                      {field.value && (
                        <span className="text-xs text-gray-600 dark:text-gray-400 truncate flex-1">
                          File selected
                        </span>
                      )}
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={field.value}
                      onChange={(e) => updateFormDataField(index, { value: e.target.value })}
                      placeholder="Value"
                      className="w-full input-field text-xs py-1 px-2"
                    />
                  )}
                </div>
                <div className="col-span-1">
                  <button
                    onClick={() => removeFormDataField(index)}
                    className="text-red-500 hover:text-red-700 dark:hover:text-red-400 text-xs"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
            <button
              onClick={addFormDataField}
              className="btn-secondary text-xs mt-2"
            >
              + Add Field
            </button>
          </div>
        </div>
      );
    }

    if (bodyType === 'binary') {
      return (
        <div className="h-full flex flex-col p-4">
          <div className="mb-2">
            <input
              type="file"
              ref={binaryFileInputRef}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleBinaryFileSelect(file);
              }}
              className="hidden"
              id="binary-file"
            />
            <label
              htmlFor="binary-file"
              className="btn-secondary text-xs py-2 px-3 cursor-pointer inline-block"
            >
              {binaryData ? 'Change File' : 'Choose File'}
            </label>
            {binaryData && (
              <button
                onClick={() => setBinaryData('')}
                className="btn-secondary text-xs py-2 px-3 ml-2"
              >
                Clear
              </button>
            )}
          </div>
          {binaryData && (
            <div className="flex-1 overflow-auto">
              <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                File loaded ({Math.round((binaryData.length * 3) / 4 / 1024)} KB)
              </div>
              <div className="bg-gray-100 dark:bg-gray-800 rounded p-2 font-mono text-xs break-all">
                {binaryData.substring(0, 200)}...
              </div>
            </div>
          )}
        </div>
      );
    }

    // JSON or Raw
    return (
      <Editor
        height="100%"
        width="100%"
        defaultLanguage={bodyType === 'json' ? 'json' : 'plaintext'}
        value={body}
        onChange={(value) => setBody(value || '')}
        theme={document.documentElement.classList.contains('dark') ? 'vs-dark' : 'light'}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          wordWrap: 'on',
          padding: { top: 16, bottom: 16 },
          automaticLayout: true,
        }}
      />
    );
  };

  const rootRequests = getRequestsInFolder(null);
  const rootRequestsGrouped = groupByDate(rootRequests);

  // Filter requests based on search query - enhanced to search in response data too
  const filterRequests = (requests: SavedApiRequest[]) => {
    if (!searchQuery.trim()) return requests;
    const query = searchQuery.toLowerCase();
    return requests.filter(req => {
      // Search in name, URL, method
      if (req.name?.toLowerCase().includes(query) ||
          req.url?.toLowerCase().includes(query) ||
          req.method?.toLowerCase().includes(query)) {
        return true;
      }
      
      // Search in headers
      if (req.headers) {
        try {
          const headers = typeof req.headers === 'string' ? JSON.parse(req.headers) : req.headers;
          const headersStr = JSON.stringify(headers).toLowerCase();
          if (headersStr.includes(query)) {
            return true;
          }
        } catch (e) {
          // If headers is not JSON, search as string
          if (String(req.headers).toLowerCase().includes(query)) {
            return true;
          }
        }
      }
      
      // Search in body
      if (req.body && String(req.body).toLowerCase().includes(query)) {
        return true;
      }
      
      // Search in response data
      if (req.response?.data) {
        const responseData = typeof req.response.data === 'string' 
          ? req.response.data 
          : JSON.stringify(req.response.data);
        if (responseData.toLowerCase().includes(query)) {
          return true;
        }
      }
      
      // Search in response headers
      if (req.response?.headers) {
        const responseHeadersStr = JSON.stringify(req.response.headers).toLowerCase();
        if (responseHeadersStr.includes(query)) {
          return true;
        }
      }
      
      return false;
    });
  };

  // Filter folders and their requests
  const filteredFolders = folders.filter(folder => {
    if (!searchQuery.trim()) return true;
    const folderRequests = getRequestsInFolder(String(folder.id || ''));
    return folder.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
           filterRequests(folderRequests).length > 0;
  });

  // Filter root requests
  const filteredRootRequestsGrouped = rootRequestsGrouped.map(group => ({
    ...group,
    items: filterRequests(group.items)
  })).filter(group => group.items.length > 0);

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2 border-b border-gray-100/50 dark:border-gray-800/50 bg-gradient-to-r from-gray-50/30 to-transparent dark:from-gray-800/30 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="p-1.5 rounded hover:bg-[var(--color-muted)] transition-all duration-200 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] active:scale-95"
              title={showSidebar ? 'Hide sidebar' : 'Show sidebar'}
            >
              <Icon name={showSidebar ? "ChevronLeft" : "ChevronRight"} className="w-4 h-4 transition-transform duration-200" />
            </button>
            <div className="text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
              API Client
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCreateRequest}
              className="btn-secondary text-xs"
            >
              + New Request
            </button>
            <button
              onClick={() => {
                setImportExportMode('import');
                setImportExportType(undefined);
                setShowImportExport(true);
              }}
              className="btn-secondary text-xs flex items-center gap-1"
            >
              <Icons.FileDown />
              Import
            </button>
            <button
              onClick={() => setShowVariablesManager(true)}
              className="btn-secondary text-xs flex items-center gap-1"
              title="Manage Variables"
            >
              <Icon name="Key" />
              Variables
            </button>
            <button
              onClick={handleCopyAsCurl}
              className={`btn-secondary text-xs flex items-center gap-1 ${copySuccess ? 'bg-green-500/10 border-green-500/30' : ''}`}
              title="Copy as cURL"
            >
              <Icon name={copySuccess ? "Check" : "Copy"} className="w-4 h-4" />
              {copySuccess ? 'Copied!' : 'Copy cURL'}
            </button>
          </div>
        </div>
      </div>

      <ImportExportModal
        isOpen={showImportExport}
        onClose={() => setShowImportExport(false)}
        onImport={handleImportSwaggerPostman}
        onImportCurl={handleImportCurl}
        requests={requests}
        mode={importExportMode}
        type={importExportType}
        folders={folders}
      />

      {showVariablesManager && (
        <VariablesManager
          isOpen={showVariablesManager}
          folderId={selectedRequest ? requests.find(r => r.id === selectedRequest)?.folderId || null : null}
          folders={folders}
          onClose={() => {
            setShowVariablesManager(false);
            loadVariables(); // Reload variables after closing
          }}
        />
      )}
      <div className="flex-1 flex overflow-hidden gap-2 p-2">
        {showSidebar && (
          <div className="w-64 flex-shrink-0 border-r border-[var(--color-border)] bg-[var(--color-sidebar)] overflow-hidden flex flex-col transition-all duration-200 ease-in-out">
            {/* Sidebar Header */}
            <div className="px-3 py-2.5 border-b border-[var(--color-border)] bg-[var(--color-background)] flex-shrink-0">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-xs font-semibold text-[var(--color-text-primary)] uppercase tracking-wider flex-1">
                  Folders
                </h3>
                <button
                  onClick={() => {
                    if (showNewFolderInput && newFolderName.trim()) {
                      handleCreateFolder();
                    } else {
                      setShowNewFolderInput(true);
                    }
                  }}
                  className={`p-1.5 rounded transition-all duration-200 text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] active:scale-95 ${
                    showNewFolderInput ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)]' : 'hover:bg-[var(--color-muted)]'
                  }`}
                  title="New Folder"
                >
                  <Icon name="FolderPlus" className="w-3.5 h-3.5 transition-transform duration-200" />
                </button>
                <button
                  onClick={handleCreateRequest}
                  className="p-1.5 rounded hover:bg-[var(--color-muted)] transition-all duration-200 text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] active:scale-95"
                  title="New Request"
                >
                  <Icon name="Plus" className="w-3.5 h-3.5" />
                </button>
              </div>
              {/* New Folder Input */}
              {showNewFolderInput && (
                <div className="mb-2 transition-all duration-200 ease-in-out">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleCreateFolder();
                        } else if (e.key === 'Escape') {
                          setShowNewFolderInput(false);
                          setNewFolderName('');
                        }
                      }}
                      placeholder="Folder name..."
                      autoFocus
                      className="flex-1 px-2 py-1.5 text-xs rounded border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text-primary)] placeholder-[var(--color-text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] transition-all"
                    />
                    <button
                      onClick={handleCreateFolder}
                      disabled={!newFolderName.trim()}
                      className="px-2 py-1.5 text-xs rounded bg-[var(--color-primary)] text-white hover:opacity-90 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                    >
                      <Icon name="Check" className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => {
                        setShowNewFolderInput(false);
                        setNewFolderName('');
                      }}
                      className="px-2 py-1.5 text-xs rounded border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text-primary)] hover:bg-[var(--color-muted)] transition-all duration-200 active:scale-95"
                    >
                      <Icon name="X" className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}
              {/* Search Bar */}
              <div className="relative">
                <div className="absolute left-2 top-1/2 transform -translate-y-1/2 pointer-events-none">
                  <Icon name="Search" className="w-3.5 h-3.5 text-[var(--color-text-tertiary)]" />
                </div>
                <input
                  type="text"
                  placeholder="Search requests..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-8 py-1.5 text-xs rounded border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text-primary)] placeholder-[var(--color-text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] transition-all duration-200"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 p-0.5 hover:bg-[var(--color-muted)] rounded transition-all duration-200 active:scale-95"
                    title="Clear search"
                  >
                    <Icon name="X" className="w-3 h-3 text-[var(--color-text-tertiary)]" />
                  </button>
                )}
              </div>
            </div>
            
            {/* Sidebar Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2"
              onDragOver={(e) => {
                if (draggedRequestId) {
                  e.preventDefault();
                  e.stopPropagation();
                  e.dataTransfer.dropEffect = 'move';
                  setDragOverFolderId(null);
                }
              }}
              onDrop={(e) => {
                if (draggedRequestId) {
                  e.preventDefault();
                  e.stopPropagation();
                  handleDrop(e, null);
                }
              }}
            >
              {folders.length === 0 && rootRequests.length === 0 ? (
                <div className="text-center py-12">
                  <Icon name="FileText" className="w-8 h-8 text-[var(--color-text-tertiary)] mx-auto mb-2 opacity-50" />
                  <p className="text-sm text-[var(--color-text-secondary)]">No requests yet</p>
                  <p className="text-xs text-[var(--color-text-tertiary)] mt-1">Create your first request</p>
                </div>
              ) : (filteredFolders.length === 0 && filteredRootRequestsGrouped.length === 0 && searchQuery) ? (
                <div className="text-center py-12">
                  <Icon name="Search" className="w-8 h-8 text-[var(--color-text-tertiary)] mx-auto mb-2 opacity-50" />
                  <p className="text-sm text-[var(--color-text-secondary)]">No results found</p>
                  <p className="text-xs text-[var(--color-text-tertiary)] mt-1">Try a different search term</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Folders */}
                  {filteredFolders.length > 0 && (
                    <div className="space-y-1">
                      {filteredFolders.map((folder) => {
                        const folderId = String(folder.id || '');
                        if (!folderId) return null;
                        const folderRequests = getRequestsInFolder(folderId);
                        const filteredFolderRequests = filterRequests(folderRequests);
                        const isExpanded = expandedFolders.has(folderId);
                        return (
                          <div key={folderId} className="space-y-1">
                            <div
                              onDragOver={(e) => handleDragOver(e, folderId)}
                              onDragLeave={handleDragLeave}
                              onDrop={(e) => handleDrop(e, folderId)}
                              className={`flex items-center gap-1 group rounded transition-all duration-200 ${dragOverFolderId === folderId && draggedRequestId
                                ? 'bg-[var(--color-primary)]/20 border-2 border-[var(--color-primary)]'
                                : ''
                                }`}
                            >
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleFolder(folderId);
                                }}
                                className="flex-1 flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[var(--color-muted)] transition-all duration-200 text-left active:scale-[0.98]"
                              >
                                <Icon name={isExpanded ? "FolderOpen" : "Folder"} className={`w-4 h-4 text-[var(--color-text-secondary)] flex-shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-0' : ''}`} />
                                <span className="text-xs font-medium text-[var(--color-text-primary)] truncate flex-1">{folder.name}</span>
                                <span className="text-[10px] text-[var(--color-text-tertiary)] bg-[var(--color-muted)] px-1.5 py-0.5 rounded">
                                  {filteredFolderRequests.length}
                                </span>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteFolder(folderId);
                                }}
                                className="opacity-0 group-hover:opacity-100 transition-all duration-200 p-1 text-xs text-[var(--color-text-tertiary)] hover:text-red-500 active:scale-95"
                                title="Delete folder"
                              >
                                <Icon name="X" className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            {isExpanded && (
                              <div className="ml-5 space-y-0.5 border-l border-[var(--color-border)] pl-2 transition-all duration-200 ease-in-out">
                                {filteredFolderRequests.length === 0 ? (
                                  <div className="px-2 py-1 text-[10px] text-[var(--color-text-tertiary)] italic">
                                    {searchQuery ? 'No matching requests' : 'Empty folder'}
                                  </div>
                                ) : (
                                  filteredFolderRequests.map((request) => (
                                    <div
                                      key={request.id}
                                      draggable
                                      onDragStart={(e) => {
                                        e.stopPropagation();
                                        handleDragStart(e, request.id);
                                      }}
                                      onDragEnd={() => {
                                        setDraggedRequestId(null);
                                        setDragOverFolderId(null);
                                      }}
                                      className={`px-2 py-1.5 rounded cursor-pointer transition-all duration-200 group ${selectedRequest === request.id
                                        ? 'bg-[var(--color-primary)] text-white shadow-sm'
                                        : 'bg-[var(--color-background)] hover:bg-[var(--color-muted)] text-[var(--color-text-primary)]'
                                        } ${draggedRequestId === request.id ? 'opacity-50' : ''} active:scale-[0.98]`}
                                      onClick={() => handleSelectRequest(request.id)}
                                    >
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                          <div className={`text-xs font-medium truncate ${selectedRequest === request.id ? 'text-white' : 'text-[var(--color-text-primary)]'
                                            }`}>
                                            {request.name}
                                          </div>
                                          <div className={`text-[10px] mt-1 flex items-center gap-1.5 ${selectedRequest === request.id ? 'text-white/90' : 'text-[var(--color-text-secondary)]'
                                            }`}>
                                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold flex-shrink-0 ${
                                              request.method === 'GET' ? 'bg-green-500/20 text-green-600 dark:text-green-400' :
                                              request.method === 'POST' ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400' :
                                              request.method === 'PUT' ? 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400' :
                                              request.method === 'DELETE' ? 'bg-red-500/20 text-red-600 dark:text-red-400' :
                                              request.method === 'PATCH' ? 'bg-purple-500/20 text-purple-600 dark:text-purple-400' :
                                              'bg-gray-500/20 text-gray-600 dark:text-gray-400'
                                            }`}>
                                              {request.method}
                                            </span>
                                            <span className="truncate text-[10px]">{request.url}</span>
                                          </div>
                                        </div>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteRequest(request.id);
                                          }}
                                          className={`opacity-0 group-hover:opacity-100 transition-all duration-200 p-0.5 active:scale-95 ${selectedRequest === request.id
                                            ? 'text-white/80 hover:text-red-200'
                                            : 'text-[var(--color-text-tertiary)] hover:text-red-500'
                                            }`}
                                          title="Delete request"
                                        >
                                          <Icon name="X" className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Root Requests - grouped by date */}
                  {filteredRootRequestsGrouped.length > 0 && (
                    <div className="space-y-2 mt-3">
                      <div className="px-2 py-1 text-[10px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
                        Recent Requests
                      </div>
                      {filteredRootRequestsGrouped.map((group) => (
                        <div key={group.label} className="space-y-1">
                          <button
                            onClick={() => toggleGroup(group.label)}
                            className="w-full flex items-center justify-between px-2 py-1.5 text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider hover:text-[var(--color-text-primary)] hover:bg-[var(--color-muted)] rounded transition-colors"
                          >
                            <span>{group.label}</span>
                            <span className="text-[var(--color-text-tertiary)] text-[9px] bg-[var(--color-muted)] px-1.5 py-0.5 rounded">
                              {group.items.length}
                            </span>
                          </button>
                          {expandedGroups.has(group.label) && (
                            <div className="space-y-0.5 ml-1">
                              {group.items.map((request) => (
                                <div
                                  key={request.id}
                                  draggable
                                  onDragStart={(e) => {
                                    e.stopPropagation();
                                    handleDragStart(e, request.id);
                                  }}
                                  onDragEnd={() => {
                                    setDraggedRequestId(null);
                                    setDragOverFolderId(null);
                                  }}
                                  className={`px-2 py-1.5 rounded cursor-pointer transition-all duration-200 group active:scale-[0.98] ${selectedRequest === request.id
                                    ? 'bg-[var(--color-primary)] text-white shadow-sm'
                                    : 'bg-[var(--color-background)] hover:bg-[var(--color-muted)] text-[var(--color-text-primary)]'
                                    } ${draggedRequestId === request.id ? 'opacity-50' : ''}`}
                                  onClick={() => handleSelectRequest(request.id)}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                      <div className={`text-xs font-medium truncate ${selectedRequest === request.id ? 'text-white' : 'text-[var(--color-text-primary)]'
                                        }`}>
                                        {request.name}
                                      </div>
                                      <div className={`text-[10px] mt-1 flex items-center gap-1.5 ${selectedRequest === request.id ? 'text-white/90' : 'text-[var(--color-text-secondary)]'
                                        }`}>
                                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold flex-shrink-0 ${
                                          request.method === 'GET' ? 'bg-green-500/20 text-green-600 dark:text-green-400' :
                                          request.method === 'POST' ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400' :
                                          request.method === 'PUT' ? 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400' :
                                          request.method === 'DELETE' ? 'bg-red-500/20 text-red-600 dark:text-red-400' :
                                          request.method === 'PATCH' ? 'bg-purple-500/20 text-purple-600 dark:text-purple-400' :
                                          'bg-gray-500/20 text-gray-600 dark:text-gray-400'
                                        }`}>
                                          {request.method}
                                        </span>
                                        <span className="truncate text-[10px]">{request.url}</span>
                                      </div>
                                    </div>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteRequest(request.id);
                                      }}
                                      className={`opacity-0 group-hover:opacity-100 transition-all duration-200 p-0.5 active:scale-95 ${selectedRequest === request.id
                                        ? 'text-white/80 hover:text-red-200'
                                        : 'text-[var(--color-text-tertiary)] hover:text-red-500'
                                        }`}
                                      title="Delete request"
                                    >
                                      <Icon name="X" className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Request Name and URL Bar - Postman Style */}
          <div className="px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-background)]">
            <div className="flex flex-col gap-2">
              <input
                type="text"
                value={requestName}
                onChange={(e) => setRequestName(e.target.value)}
                placeholder="Request name (optional)..."
                className="px-3 py-1.5 rounded border border-[var(--color-border)] bg-[var(--color-sidebar)] text-[var(--color-text-primary)] text-sm"
              />
              <div className="flex gap-2 items-center">
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value as any)}
                  className="w-[110px] px-3 py-2 rounded border border-[var(--color-border)] bg-[var(--color-sidebar)] text-[var(--color-text-primary)] text-sm font-semibold hover:bg-[var(--color-muted)] transition-colors cursor-pointer"
                  style={{
                    color: method === 'GET' ? '#10b981' : 
                           method === 'POST' ? '#3b82f6' : 
                           method === 'PUT' ? '#f59e0b' : 
                           method === 'DELETE' ? '#ef4444' : 
                           method === 'PATCH' ? '#8b5cf6' : 
                           '#6b7280'
                  }}
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="DELETE">DELETE</option>
                  <option value="PATCH">PATCH</option>
                  <option value="OPTIONS">OPTIONS</option>
                  <option value="HEAD">HEAD</option>
                </select>
                <input
                  type="text"
                  value={displayUrl}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  placeholder="https://api.example.com/endpoint"
                  className={`flex-1 px-3 py-2 rounded-l border border-[var(--color-border)] bg-[var(--color-sidebar)] text-[var(--color-text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent ${getVariableBorderClass(displayUrl)}`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      handleRequest();
                    }
                  }}
                />
                <button
                  onClick={handleRequest}
                  disabled={loading || !url}
                  className={`px-6 py-2 rounded-r border border-l-0 border-[var(--color-border)] bg-[var(--color-primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${loading ? 'cursor-wait' : ''}`}
                >
                  {loading ? (
                    <>
                      <Icon name="RefreshCw" className="w-4 h-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Icon name="Send" className="w-4 h-4" />
                      Send
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 flex overflow-hidden">
            {/* Request Section - Postman Style */}
            <div className="flex-1 flex flex-col border-r border-[var(--color-border)] bg-[var(--color-background)]">
              {/* Request Tabs */}
              <div className="flex border-b border-[var(--color-border)] bg-[var(--color-sidebar)]">
                {(['params', 'headers', 'body', 'auth', 'settings'] as RequestTab[]).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveRequestTab(tab)}
                    className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                      activeRequestTab === tab
                        ? 'border-[var(--color-primary)] text-[var(--color-primary)] bg-[var(--color-background)]'
                        : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-muted)]'
                    }`}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>

              {/* Request Tab Content */}
              <div className="flex-1 overflow-auto p-4 bg-[var(--color-background)]">
                {activeRequestTab === 'params' && (
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Query Parameters</div>
                    <div className="space-y-2">
                      {queryParams.map((param, index) => (
                        <div key={index} className="flex gap-2 items-center">
                          <input
                            type="checkbox"
                            checked={param.enabled}
                            onChange={(e) => updateQueryParam(index, { enabled: e.target.checked })}
                            className="w-4 h-4"
                          />
                          <input
                            type="text"
                            value={param.key}
                            onChange={(e) => updateQueryParam(index, { key: e.target.value })}
                            placeholder="Key"
                            className={`flex-1 px-2 py-1.5 rounded border bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm ${getVariableBorderClass(param.key)}`}
                          />
                          <input
                            type="text"
                            value={param.value}
                            onChange={(e) => updateQueryParam(index, { value: e.target.value })}
                            placeholder="Value"
                            className={`flex-1 px-2 py-1.5 rounded border bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm ${getVariableBorderClass(param.value)}`}
                          />
                          <button
                            onClick={() => removeQueryParam(index)}
                            className="px-2 py-1 text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400"
                          >
                            <Icon name="X" className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={addQueryParam}
                        className="px-3 py-1.5 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-1"
                      >
                        <Icon name="Plus" className="w-4 h-4" />
                        Add Parameter
                      </button>
                    </div>
                  </div>
                )}

                {activeRequestTab === 'headers' && (
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Headers</div>
                    <div className="space-y-2">
                      {headersList.map((header, index) => (
                        <div key={index} className="flex gap-2 items-center">
                          <input
                            type="checkbox"
                            checked={header.enabled}
                            onChange={(e) => updateHeader(index, { enabled: e.target.checked })}
                            className="w-4 h-4"
                          />
                          <input
                            type="text"
                            value={header.key}
                            onChange={(e) => updateHeader(index, { key: e.target.value })}
                            placeholder="Key"
                            className={`flex-1 px-2 py-1.5 rounded border bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm ${getVariableBorderClass(header.key)}`}
                          />
                          <input
                            type="text"
                            value={header.value}
                            onChange={(e) => updateHeader(index, { value: e.target.value })}
                            placeholder="Value"
                            className={`flex-1 px-2 py-1.5 rounded border bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm ${getVariableBorderClass(header.value)}`}
                          />
                          <button
                            onClick={() => removeHeader(index)}
                            className="px-2 py-1 text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400"
                          >
                            <Icon name="X" className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={addHeader}
                        className="px-3 py-1.5 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-1"
                      >
                        <Icon name="Plus" className="w-4 h-4" />
                        Add Header
                      </button>
                    </div>
                  </div>
                )}

                {activeRequestTab === 'body' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-medium text-gray-600 dark:text-gray-400">Body</div>
                      <select
                        value={bodyType}
                        onChange={(e) => setBodyType(e.target.value as BodyType)}
                        className="w-[200px] px-3 py-1.5 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                      >
                        <option value="none">None</option>
                        <option value="json">JSON</option>
                        <option value="raw">Raw</option>
                        <option value="form-data">Form Data</option>
                        <option value="x-www-form-urlencoded">x-www-form-urlencoded</option>
                        <option value="binary">Binary</option>
                      </select>
                    </div>

                    {bodyType === 'none' && (
                      <div className="h-32 flex items-center justify-center text-gray-500 dark:text-gray-400 text-sm">
                        This request does not have a body
                      </div>
                    )}

                    {(bodyType === 'json' || bodyType === 'raw') && (
                      <div className="h-[400px] rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
                        <Editor
                          height="400px"
                          defaultLanguage={bodyType === 'json' ? 'json' : 'plaintext'}
                          value={body}
                          onChange={(value) => setBody(value || '')}
                          theme={document.documentElement.classList.contains('dark') ? 'vs-dark' : 'light'}
                          options={{
                            minimap: { enabled: false },
                            fontSize: 14,
                            wordWrap: 'on',
                            padding: { top: 16, bottom: 16 },
                            automaticLayout: true,
                          }}
                        />
                      </div>
                    )}

                    {(bodyType === 'form-data' || bodyType === 'x-www-form-urlencoded') && (
                      <div className="space-y-2 max-h-[400px] overflow-y-auto">
                        {formData.map((field, index) => (
                          <div key={index} className="flex gap-2 items-center">
                            <input
                              type="checkbox"
                              checked={field.enabled}
                              onChange={(e) => updateFormDataField(index, { enabled: e.target.checked })}
                              className="w-4 h-4"
                            />
                            <input
                              type="text"
                              value={field.key}
                              onChange={(e) => updateFormDataField(index, { key: e.target.value })}
                              placeholder="Key"
                              className={`flex-1 px-2 py-1.5 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm ${getVariableBorderClass(field.key)}`}
                            />
                            {field.type === 'file' ? (
                              <>
                                <input
                                  type="file"
                                  ref={fileInputRef}
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleFileSelect(index, file);
                                  }}
                                  className="hidden"
                                  id={`file-${index}`}
                                />
                                <label
                                  htmlFor={`file-${index}`}
                                  className="px-3 py-1.5 rounded border border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-700 text-xs cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white"
                                >
                                  Choose File
                                </label>
                              </>
                            ) : (
                              <input
                                type="text"
                                value={field.value}
                                onChange={(e) => updateFormDataField(index, { value: e.target.value })}
                                placeholder="Value"
                                className={`flex-1 px-2 py-1.5 rounded border bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm ${getVariableBorderClass(field.value)}`}
                              />
                            )}
                            <button
                              onClick={() => removeFormDataField(index)}
                              className="px-2 py-1 text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400"
                            >
                              <Icon name="X" className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={addFormDataField}
                          className="px-3 py-1.5 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-1"
                        >
                          <Icon name="Plus" className="w-4 h-4" />
                          Add Field
                        </button>
                      </div>
                    )}

                    {bodyType === 'binary' && (
                      <div className="space-y-2">
                        <input
                          type="file"
                          ref={binaryFileInputRef}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleBinaryFileSelect(file);
                          }}
                          className="hidden"
                          id="binary-file"
                        />
                        <label
                          htmlFor="binary-file"
                          className="inline-block px-4 py-2 rounded border border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-700 text-sm cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white"
                        >
                          {binaryData ? 'Change File' : 'Choose File'}
                        </label>
                        {binaryData && (
                          <button
                            onClick={() => setBinaryData('')}
                            className="ml-2 px-3 py-1.5 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs hover:bg-gray-50 dark:hover:bg-gray-700"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {activeRequestTab === 'auth' && (
                  <div className="space-y-4">
                    <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Authorization</div>
                    <select
                      value={authConfig.type}
                      onChange={(e) => setAuthConfig({ ...authConfig, type: e.target.value as AuthType })}
                      className="w-[200px] px-3 py-1.5 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                    >
                      <option value="none">No Auth</option>
                      <option value="bearer">Bearer Token</option>
                      <option value="basic">Basic Auth</option>
                      <option value="apikey">API Key</option>
                      <option value="oauth2">OAuth 2.0</option>
                    </select>

                    {authConfig.type === 'bearer' && (
                      <div className="space-y-2">
                        <label className="text-xs text-gray-600 dark:text-gray-400">Token</label>
                        <input
                          type="text"
                          value={authConfig.bearerToken || ''}
                          onChange={(e) => setAuthConfig({ ...authConfig, bearerToken: e.target.value })}
                          placeholder="Enter bearer token"
                          className={`w-full px-3 py-2 rounded border bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm ${getVariableBorderClass(authConfig.bearerToken || '')}`}
                        />
                      </div>
                    )}

                    {authConfig.type === 'basic' && (
                      <div className="space-y-2">
                        <div>
                          <label className="text-xs text-gray-600 dark:text-gray-400">Username</label>
                          <input
                            type="text"
                            value={authConfig.basicUsername || ''}
                            onChange={(e) => setAuthConfig({ ...authConfig, basicUsername: e.target.value })}
                            placeholder="Username"
                            className={`w-full px-3 py-2 rounded border bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm mt-1 ${getVariableBorderClass(authConfig.basicUsername || '')}`}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-600 dark:text-gray-400">Password</label>
                          <input
                            type="password"
                            value={authConfig.basicPassword || ''}
                            onChange={(e) => setAuthConfig({ ...authConfig, basicPassword: e.target.value })}
                            placeholder="Password"
                            className={`w-full px-3 py-2 rounded border bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm mt-1 ${getVariableBorderClass(authConfig.basicPassword || '')}`}
                          />
                        </div>
                      </div>
                    )}

                    {authConfig.type === 'apikey' && (
                      <div className="space-y-2">
                        <div>
                          <label className="text-xs text-gray-600 dark:text-gray-400">Key</label>
                          <input
                            type="text"
                            value={authConfig.apiKeyKey || ''}
                            onChange={(e) => setAuthConfig({ ...authConfig, apiKeyKey: e.target.value })}
                            placeholder="API Key name"
                            className={`w-full px-3 py-2 rounded border bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm mt-1 ${getVariableBorderClass(authConfig.apiKeyKey || '')}`}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-600 dark:text-gray-400">Value</label>
                          <input
                            type="text"
                            value={authConfig.apiKeyValue || ''}
                            onChange={(e) => setAuthConfig({ ...authConfig, apiKeyValue: e.target.value })}
                            placeholder="API Key value"
                            className={`w-full px-3 py-2 rounded border bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm mt-1 ${getVariableBorderClass(authConfig.apiKeyValue || '')}`}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-600 dark:text-gray-400">Add to</label>
                          <select
                            value={authConfig.apiKeyLocation || 'header'}
                            onChange={(e) => setAuthConfig({ ...authConfig, apiKeyLocation: e.target.value as 'header' | 'query' })}
                            className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm mt-1"
                          >
                            <option value="header">Header</option>
                            <option value="query">Query Params</option>
                          </select>
                        </div>
                      </div>
                    )}

                    {authConfig.type === 'oauth2' && (
                      <div className="space-y-2">
                        <label className="text-xs text-gray-600 dark:text-gray-400">Access Token</label>
                        <input
                          type="text"
                          value={authConfig.oauth2Token || ''}
                          onChange={(e) => setAuthConfig({ ...authConfig, oauth2Token: e.target.value })}
                          placeholder="Enter OAuth 2.0 access token"
                          className={`w-full px-3 py-2 rounded border bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm ${getVariableBorderClass(authConfig.oauth2Token || '')}`}
                        />
                      </div>
                    )}
                  </div>
                )}

                {activeRequestTab === 'settings' && (
                  <div className="space-y-4">
                    <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Request Settings</div>
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-gray-600 dark:text-gray-400">Timeout (ms)</label>
                        <input
                          type="number"
                          value={timeout}
                          onChange={(e) => setRequestTimeout(Number(e.target.value) || 30000)}
                          className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm mt-1"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={followRedirects}
                          onChange={(e) => setFollowRedirects(e.target.checked)}
                          className="w-4 h-4"
                        />
                        <label className="text-xs text-gray-900 dark:text-white">Follow redirects</label>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={sslVerification}
                          onChange={(e) => setSslVerification(e.target.checked)}
                          className="w-4 h-4"
                        />
                        <label className="text-xs text-gray-900 dark:text-white">SSL certificate verification</label>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Response Section - Postman Style */}
            <div className="flex-1 flex flex-col bg-[var(--color-background)]">
              {/* Response Tabs */}
              <div className="flex border-b border-[var(--color-border)] bg-[var(--color-sidebar)]">
                {(['preview', 'raw', 'headers'] as ResponseTab[]).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveResponseTab(tab)}
                    className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all duration-200 ${
                      activeResponseTab === tab
                        ? 'border-[var(--color-primary)] text-[var(--color-primary)] bg-[var(--color-background)]'
                        : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-muted)]'
                    }`}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>

              {/* Response Content */}
              <div className="flex-1 overflow-auto bg-[var(--color-background)]">
                {loading ? (
                  <div className="h-full flex flex-col items-center justify-center p-8">
                    <div className="flex flex-col items-center text-center">
                      <Icon name="RefreshCw" className="w-12 h-12 text-blue-500 dark:text-blue-400 mb-3 animate-spin" />
                      <p className="text-sm font-medium text-[var(--color-text-primary)]">Sending request...</p>
                      <p className="text-xs text-[var(--color-text-secondary)] mt-1">Please wait</p>
                    </div>
                  </div>
                ) : response ? (
                  <div className="h-full flex flex-col">
                    {/* Status Bar - Postman Style */}
                    <div className="px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-sidebar)] flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-[var(--color-text-secondary)]">Status:</span>
                          <span className={`px-2 py-0.5 rounded text-sm font-semibold ${
                            response.status >= 200 && response.status < 300 
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                              : response.status >= 400 
                              ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' 
                              : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                          }`}>
                            {response.status} {response.statusText}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                          <Icon name="Clock" className="w-4 h-4" />
                          <span>{response.time}ms</span>
                        </div>
                        {response.data && (
                          <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                            <Icon name="FileText" className="w-4 h-4" />
                            <span>
                              {typeof response.data === 'string' 
                                ? `${response.data.length} bytes` 
                                : `${JSON.stringify(response.data).length} bytes`}
                            </span>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={async () => {
                          const text = typeof response.data === 'string' 
                            ? response.data 
                            : JSON.stringify(response.data, null, 2);
                          try {
                            await navigator.clipboard.writeText(text);
                            if ((window as any).showToast) {
                              (window as any).showToast('Response copied to clipboard', 'success');
                            }
                          } catch (err) {
                            console.error('Failed to copy:', err);
                          }
                        }}
                        className="px-3 py-1.5 text-xs rounded border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text-primary)] hover:bg-[var(--color-muted)] transition-colors flex items-center gap-1.5"
                        title="Copy response"
                      >
                        <Icon name="Copy" className="w-3.5 h-3.5" />
                        Copy
                      </button>
                    </div>
                    {activeResponseTab === 'preview' && (
                      <div className="flex-1 overflow-auto">
                        {(() => {
                          const data = typeof response.data === 'string' ? response.data : JSON.stringify(response.data, null, 2);
                          const contentType = response.headers?.['content-type'] || response.headers?.['Content-Type'] || '';
                          
                          // Check if it's JSON
                          if (data.trim().startsWith('{') || data.trim().startsWith('[')) {
                            try {
                              const parsed = JSON.parse(data);
                              return (
                                <Editor
                                  height="100%"
                                  defaultLanguage="json"
                                  value={JSON.stringify(parsed, null, 2)}
                                  theme={document.documentElement.classList.contains('dark') ? 'vs-dark' : 'light'}
                                  options={{
                                    readOnly: true,
                                    minimap: { enabled: false },
                                    fontSize: 14,
                                    wordWrap: 'on',
                                    padding: { top: 16, bottom: 16 },
                                    automaticLayout: true,
                                    lineNumbers: 'on',
                                    scrollBeyondLastLine: false,
                                  }}
                                />
                              );
                            } catch (e) {
                              // Not valid JSON, fall through to plain text
                            }
                          }
                          
                          // Check if it's HTML
                          if (contentType.includes('text/html') || (data.trim().startsWith('<') && data.includes('</'))) {
                            return (
                              <div className="h-full p-4">
                                <iframe
                                  srcDoc={data}
                                  className="w-full h-full border border-[var(--color-border)] rounded"
                                  title="HTML Preview"
                                />
                              </div>
                            );
                          }
                          
                          // Default: formatted text/plain
                          return (
                            <Editor
                              height="100%"
                              defaultLanguage="plaintext"
                              value={data}
                              theme={document.documentElement.classList.contains('dark') ? 'vs-dark' : 'light'}
                              options={{
                                readOnly: true,
                                minimap: { enabled: false },
                                fontSize: 14,
                                wordWrap: 'on',
                                padding: { top: 16, bottom: 16 },
                                automaticLayout: true,
                                lineNumbers: 'on',
                                scrollBeyondLastLine: false,
                              }}
                            />
                          );
                        })()}
                      </div>
                    )}
                    {activeResponseTab === 'raw' && (
                      <div className="flex-1 overflow-auto">
                        <Editor
                          height="100%"
                          defaultLanguage="plaintext"
                          value={typeof response.data === 'string' ? response.data : JSON.stringify(response.data)}
                          theme={document.documentElement.classList.contains('dark') ? 'vs-dark' : 'light'}
                          options={{
                            readOnly: true,
                            minimap: { enabled: false },
                            fontSize: 14,
                            wordWrap: 'on',
                            padding: { top: 16, bottom: 16 },
                            automaticLayout: true,
                            lineNumbers: 'on',
                            scrollBeyondLastLine: false,
                          }}
                        />
                      </div>
                    )}
                    {activeResponseTab === 'headers' && (
                      <div className="flex-1 overflow-auto p-4">
                        <div className="space-y-1">
                          {Object.entries(response.headers || {}).map(([key, value]) => (
                            <div key={key} className="flex gap-4 py-2 border-b border-[var(--color-border)] last:border-0 text-sm">
                              <div className="font-semibold text-[var(--color-text-primary)] min-w-[220px]">{key}</div>
                              <div className="text-[var(--color-text-secondary)] flex-1 break-all">{String(value)}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : error ? (
                  <div className="h-full flex flex-col items-center justify-center p-8">
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 max-w-2xl w-full">
                      <div className="flex items-start gap-3">
                        <Icon name="AlertCircle" className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <h3 className="text-sm font-semibold text-red-800 dark:text-red-400 mb-1">Request Failed</h3>
                          <p className="text-sm text-red-700 dark:text-red-300 whitespace-pre-wrap break-words">{error}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center p-8">
                    <div className="text-center">
                      <Icon name="Send" className="w-12 h-12 text-[var(--color-text-tertiary)] mx-auto mb-3 opacity-50" />
                      <p className="text-sm text-[var(--color-text-secondary)]">Response will appear here</p>
                      <p className="text-xs text-[var(--color-text-tertiary)] mt-1">Click Send to make a request</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
