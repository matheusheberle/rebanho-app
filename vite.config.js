import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Config do PWA: o service worker deixa o app abrir e salvar
// registros mesmo sem sinal, que é o cenário mais comum na fazenda.
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        // Dependências estáveis podem permanecer em cache entre versões do app.
        manualChunks: { supabase: ['@supabase/supabase-js'], dexie: ['dexie'], react: ['react', 'react-dom'] }
      }
    }
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Rebanho',
        short_name: 'Rebanho',
        description: 'Gestão do rebanho de gado de corte',
        theme_color: '#2F5D3A',
        background_color: '#F3F4EE',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      },
      workbox: {
        // Cacheia o app inteiro (HTML/JS/CSS) para abrir sem internet.
        // Os dados em si ficam no IndexedDB (Dexie), não no cache do service worker.
        globPatterns: ['**/*.{js,css,html,svg,png,ico}']
      }
    })
  ]
});
