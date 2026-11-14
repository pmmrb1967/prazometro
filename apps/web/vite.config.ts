import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

/** Commit curto do build, mostrado no rodapé para se saber que versão está a correr. */
function buildCommit(): string {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return 'dev';
  }
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_COMMIT__: JSON.stringify(buildCommit()),
  },
  plugins: [
    react(),
    VitePWA({
      // Uma versão nova é oferecida, nunca aplicada a meio de uma tarefa (src/pwa.ts).
      registerType: 'prompt',
      pwaAssets: { config: true },
      manifest: {
        name: 'Prazómetro',
        short_name: 'Prazómetro',
        description: 'Prazos e direitos do dia a dia, explicados.',
        lang: 'pt-PT',
        theme_color: '#16355A',
        background_color: '#F4F6F9',
        display: 'standalone',
        id: '/',
        start_url: '/',
        // Permite ao Chrome dizer ao site se a app já está instalada (getInstalledRelatedApps).
        related_applications: [
          { platform: 'webapp', url: 'https://app.prazometro.workers.dev/manifest.webmanifest' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // O OCR (cerca de 13 MB) só é descarregado por quem fotografa uma carta, e depois fica
        // guardado em cache para funcionar sem rede.
        globIgnores: ['ocr/**'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/ocr/'),
            handler: 'CacheFirst',
            options: { cacheName: 'ocr', expiration: { maxEntries: 20 } },
          },
        ],
        // A API está no mesmo domínio: o service worker nunca a deve servir da cache.
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
  // Em desenvolvimento, /api vai para o `wrangler dev` (porta 8787).
  server: { proxy: { '/api': 'http://localhost:8787' } },
});
