import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
    base: process.env.VITE_BASE ?? '/spirtzVioice/',

    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
            '@domain': path.resolve(__dirname, './src/domain'),
            '@audio': path.resolve(__dirname, './src/audio'),
            '@storage': path.resolve(__dirname, './src/storage'),
            '@ui': path.resolve(__dirname, './src/ui'),
            '@workers': path.resolve(__dirname, './src/workers'),
            '@spec': path.resolve(__dirname, './spec'),
        },
    },
    build: {
        target: 'es2020',
        rollupOptions: {
            output: {
                // manualChunks: {
                //     'audio-engine': ['./src/audio/AudioScheduler.ts', './src/audio/PlaybackController.ts'],
                //     'storage': ['dexie'],
                // },
            },
        },
    },
    server: {
        port: 5180,
        strictPort: false,
        headers: {
            'Cross-Origin-Opener-Policy': 'same-origin',
            'Cross-Origin-Embedder-Policy': 'require-corp',
            'Cross-Origin-Resource-Policy': 'cross-origin',
        },
    },
    preview: {
        port: 5180,
        strictPort: false,
        headers: {
            'Cross-Origin-Opener-Policy': 'same-origin',
            'Cross-Origin-Embedder-Policy': 'require-corp',
            'Cross-Origin-Resource-Policy': 'cross-origin',
        },
    },
    worker: {
        format: 'es',
    },
    plugins: [
        {
            name: 'add-corp-headers',
            enforce: 'pre',
            configureServer(server) {
                server.middlewares.use((_req, res, next) => {
                    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
                    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
                    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
                    next();
                });
            },
            configurePreviewServer(server) {
                server.middlewares.use((_req, res, next) => {
                    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
                    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
                    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
                    next();
                });
            },
        },
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
            manifest: {
                name: 'Spritz Voice',
                short_name: 'SpritzVoice',
                description: 'Offline High-Performance Speed Reader',
                theme_color: '#1e40af',
                background_color: '#ffffff',
                display: 'standalone',
                orientation: 'portrait',
                icons: [
                    {
                        src: 'pwa-192x192.png',
                        sizes: '192x192',
                        type: 'image/png'
                    },
                    {
                        src: 'pwa-512x512.png',
                        sizes: '512x512',
                        type: 'image/png'
                    },
                    {
                        src: 'pwa-512x512.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'any maskable'
                    }
                ],
                share_target: {
                    action: './',
                    method: 'GET',
                    enctype: 'application/x-www-form-urlencoded',
                    params: {
                        title: 'title',
                        text: 'text',
                        url: 'url'
                    }
                }
            },
            devOptions: {
                enabled: false // Disable SW in dev to eliminate it as a variable for fetch errors
            },
            workbox: {
                cleanupOutdatedCaches: true,
                maximumFileSizeToCacheInBytes: 100000000, // 100MB to support large Voice Models
                globPatterns: ['**/*.{js,css,html,ico,png,svg,json,wasm,data,onnx}'],
                navigateFallback: 'index.html',
                navigateFallbackDenylist: [/^\/assets\//, /\/manifest\.webmanifest$/, /^\/spirtzVioice-beta\//],
                runtimeCaching: [
                    {
                        urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'google-fonts-cache',
                            expiration: {
                                maxEntries: 10,
                                maxAgeSeconds: 60 * 60 * 24 * 365 // <== 365 days
                            },
                            cacheableResponse: {
                                statuses: [0, 200]
                            }
                        }
                    },
                    {
                        urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'gstatic-fonts-cache',
                            expiration: {
                                maxEntries: 10,
                                maxAgeSeconds: 60 * 60 * 24 * 365 // <== 365 days
                            },
                            cacheableResponse: {
                                statuses: [0, 200]
                            },
                        }
                    }
                ]
            }
        })
    ],
    define: {
        __APP_VERSION__: JSON.stringify(process.env.npm_package_version)
    }
});
