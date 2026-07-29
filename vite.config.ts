import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// GitHub Pages sirve la app bajo /permisos_tthh/, por eso el base fijo.
export default defineConfig({
  base: '/permisos_tthh/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // Las librerias de exportacion y graficos son pesadas: se separan para que
    // no entren en el bundle inicial (riesgo R6 del documento de arquitectura).
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
          charts: ['recharts'],
          echarts: ['echarts', 'echarts-for-react'],
          export: ['exceljs', 'pdfmake'],
        },
      },
    },
    chunkSizeWarningLimit: 900,
  },
  server: {
    port: 5180,
  },
})
