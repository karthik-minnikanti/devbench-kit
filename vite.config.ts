import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron/simple';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    electron({
      main: {
        entry: 'electron/main.ts',
        vite: {
          build: {
            rollupOptions: {
              external: (id) => {
                // Externalize electron and native modules
                if (id === 'electron') return true;
                if (id === 'bufferutil' || id === 'utf-8-validate' || id === 'ws') return true;
                // Externalize dockerode and its dependencies
                if (id === 'dockerode') return true;
                if (id === 'node-pty') return true;
                if (id.startsWith('ssh2')) return true;
                if (id.startsWith('@grpc/')) return true;
                // Externalize all .node files (native modules)
                if (id.endsWith('.node')) return true;
                return false;
              },
            },
          },
          resolve: {
            // Handle optional dependencies gracefully
            alias: {
              'bufferutil': 'bufferutil',
              'utf-8-validate': 'utf-8-validate',
            },
          },
        },
      },
      preload: {
        input: path.join(__dirname, 'electron/preload.ts'),
        vite: {
          build: {
            rollupOptions: {
              external: ['electron'],
              output: {
                format: 'es',
                entryFileNames: 'preload.mjs',
              },
            },
          },
        },
      },
      renderer: false,
    }),
  ],
  publicDir: 'public',
  server: {
    port: 5173,
    strictPort: true,
  },
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        planner: path.resolve(__dirname, 'planner.html'),
      },
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            // Do NOT split react/react-dom into a separate chunk from the rest of
            // node_modules — shared deps (scheduler, use-sync-external-store, etc.)
            // end up in one chunk while react is in another, creating circular imports
            // and "Cannot read properties of undefined (reading 'useState')" at startup.
            // Do NOT manually chunk lazy-loaded heavy libs (@excalidraw, @blocknote,
            // @monaco-editor, mermaid). Vite hoists shared preload helpers into those
            // chunks and the main entry imports them at startup, causing TDZ crashes
            // like "Cannot access 'qe' before initialization" in production builds.
            if (id.includes('@kubernetes/client-node')) return 'k8s-client';
            if (id.includes('dockerode')) return 'docker';
          }
        },
      },
    },
    // Optimize chunk size
    chunkSizeWarningLimit: 1000,
    // Enable source maps for debugging (disable in production for smaller builds)
    sourcemap: false,
    minify: 'esbuild',
    esbuild: {
      drop: process.env.NODE_ENV === 'production' ? ['debugger'] : [],
    },
  },
});


