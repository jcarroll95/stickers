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
    let envFromFile = {};
    const envPath = path.resolve(__dirname, '../config/config.env');
    
    if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf-8');
        content.split(/\r?\n/).forEach(line => {
            const trimmedLine = line.trim();
            if (!trimmedLine || trimmedLine.startsWith('#')) return;
            
            const [key, ...valueParts] = trimmedLine.split('=');
            if (key && valueParts.length > 0) {
                const value = valueParts.join('=').trim();
                envFromFile[key.trim()] = value;
            }
        });
    }

    // Also load standard Vite envs
    const viteEnv = loadEnv(mode, process.cwd(), '');
    
    // Priority: Process Env > config.env file > .env files > default
    const assetsBaseUrl = process.env.VITE_ASSETS_BASE_URL || envFromFile.VITE_ASSETS_BASE_URL || viteEnv.VITE_ASSETS_BASE_URL || '/assets';

    console.log(`[Vite Build] Using VITE_ASSETS_BASE_URL: ${assetsBaseUrl} (Mode: ${mode})`);

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
        // Expose the variable to the client-side code via import.meta.env
        define: {
            'import.meta.env.VITE_ASSETS_BASE_URL': JSON.stringify(assetsBaseUrl)
        },
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