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
                }
            }
        }
    },
    server: {
        port: 5173,
        strictPort: true,
        proxy: {
            // Anything starting with /api will be proxied to your Express server
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