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
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        planner: path.resolve(__dirname, 'planner.html'),
      },
      output: {
        manualChunks: (id) => {
          // Split vendor chunks
          if (id.includes('node_modules')) {
            // Large libraries get their own chunks
            if (id.includes('@monaco-editor')) return 'monaco';
            if (id.includes('@excalidraw')) return 'excalidraw';
            if (id.includes('@blocknote')) return 'blocknote';
            if (id.includes('mermaid')) return 'mermaid';
            if (id.includes('@kubernetes/client-node')) return 'k8s-client';
            if (id.includes('dockerode')) return 'docker';
            // React and core libraries
            if (id.includes('react') || id.includes('react-dom')) return 'react-vendor';
            // Other node_modules
            return 'vendor';
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


