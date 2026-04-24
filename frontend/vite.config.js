import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false, // não expõe código-fonte em produção
    minify: 'esbuild',
  },
  // Em produção, a API será no mesmo domínio ou em outro servidor
  server: {
    proxy: {
      '/api': {
        target: 'https://cofre-backend.onrender.com',
        changeOrigin: true,
      }
    }
  }
})
