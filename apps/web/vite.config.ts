import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      pwaAssets: { config: true },
      manifest: {
        name: 'Prazómetro',
        short_name: 'Prazómetro',
        description: 'Prazos e direitos do dia a dia, explicados.',
        lang: 'pt-PT',
        theme_color: '#16355A',
        background_color: '#F4F6F9',
        display: 'standalone',
        start_url: '/',
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // A API está no mesmo domínio: o service worker nunca a deve servir da cache.
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
  // Em desenvolvimento, /api vai para o `wrangler dev` (porta 8787).
  server: { proxy: { '/api': 'http://localhost:8787' } },
});
