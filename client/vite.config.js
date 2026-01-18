import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import { createHtmlPlugin } from 'vite-plugin-html';
import fs from 'fs';

export default defineConfig({
    plugins: [
        react(),
        visualizer({ open: true }),
        createHtmlPlugin({
            minify: true,
            inject: {
                data: {
                    injectCss: () => {
                        // This will inline the CSS during build
                        const cssPath = './dist/assets/index-*.css';
                        try {
                            const files = fs.readdirSync('./dist/assets').filter(f => f.startsWith('index-') && f.endsWith('.css'));
                            if (files[0]) {
                                return fs.readFileSync(`./dist/assets/${files[0]}`, 'utf-8');
                            }
                        } catch (e) {
                            return '';
                        }
                        return '';
                    }
                }
            }
        })
    ],
    build: {
        rollupOptions: {
            output: {
                // Let Vite handle chunking automatically
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