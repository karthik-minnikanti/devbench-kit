import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';
import { ToastProvider } from './components/ToastProvider';

// Wait for DOM and check Electron API
function init() {
  // Verify Electron API is available
  if (typeof window !== 'undefined') {
    console.log('[Renderer] Checking Electron API...');
    console.log('[Renderer] Electron API available:', !!window.electronAPI);

    if (window.electronAPI) {
      console.log('[Renderer] Electron API methods:', Object.keys(window.electronAPI));
    } else {
      console.warn('[Renderer] Electron API not available. Make sure the preload script is loaded correctly.');
      // Retry after a short delay
      setTimeout(() => {
        if (window.electronAPI) {
          console.log('[Renderer] Electron API now available after retry');
        } else {
          console.error('[Renderer] Electron API still not available after retry');
        }
      }, 1000);
    }
  }
}

// Run after DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </React.StrictMode>,
);


