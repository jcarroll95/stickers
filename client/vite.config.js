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
                // Remove manualChunks - let Vite handle it automatically
                // This will only bundle Konva with routes that actually use it
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