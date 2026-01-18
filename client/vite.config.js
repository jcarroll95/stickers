import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
    plugins: [
        react(),
        visualizer({ open: true })
    ],
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    'konva-vendor': ['konva', 'react-konva'],
                },
                // Disable modulepreload for better code splitting
                experimentalMinChunkSize: 500000,
            }
        },
        // Disable automatic modulepreload injection in index.html and only load konva-vendor when called for in explore/board pages
        modulePreload: {
            polyfill: false,
            resolveDependencies: (filename, deps, { hostId, hostType }) => {
                // Filter out konva-vendor from being preloaded
                return deps.filter(dep => !dep.includes('konva-vendor'));
            }
        }
    },
    server: {
        port: 5173,
        strictPort: true,
        proxy: {
            '/api': {
                target: 'http://localhost:5050',
                changeOrigin: true,
                secure: false
            }
        }
    },
    preview: {
        port: 5173,
        strictPort: true
    }
});