import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import { createHtmlPlugin } from 'vite-plugin-html';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
    // Vite's loadEnv normally looks for .env files. 
    // Since we want to use 'config.env' specifically, we can use dotenv to load it manually
    // or tell loadEnv to look in the right place, but loadEnv is rigid about prefixes/filenames.
    
    // Let's use fs and a simple parser or just import dotenv if available.
    // Given this is a node environment in vite.config.js, we can read it.
    let env = {};
    const envPath = path.resolve(__dirname, '../config/config.env');
    
    if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf-8');
        content.split('\n').forEach(line => {
            const [key, ...valueParts] = line.split('=');
            if (key && valueParts.length > 0) {
                const value = valueParts.join('=').trim();
                env[key.trim()] = value;
            }
        });
    }

    // Also load standard Vite envs just in case
    const viteEnv = loadEnv(mode, process.cwd());
    const assetsBaseUrl = env.VITE_ASSETS_BASE_URL || viteEnv.VITE_ASSETS_BASE_URL || '/assets';

    return {
        plugins: [
            react(),
            visualizer({ open: true }),
            createHtmlPlugin({
                minify: true,
                inject: {
                    data: {
                        VITE_ASSETS_BASE_URL: assetsBaseUrl,
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
    };
});