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
    rollupOptions: {
      output: {
        // Solo se fijan a mano las librerias que USA TODA la aplicacion, para
        // que se cacheen aparte y sobrevivan a cada despliegue.
        //
        // Recharts, ECharts, ExcelJS y pdfmake NO van aqui a proposito:
        // declararlos como chunk fijo hacia que Vite les anadiera un
        // <link rel="modulepreload"> en index.html, con lo que se descargaban
        // en el arranque aunque solo los use el dashboard. Sin la entrada
        // manual, Vite los agrupa con la ruta diferida que los importa, que es
        // justo lo que pide el riesgo R6 de la arquitectura.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
    chunkSizeWarningLimit: 900,
  },
  server: {
    port: 5180,
  },
})
