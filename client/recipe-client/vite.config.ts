import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// bypass CORS
// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/recipes': {
        target: 'http://localhost:9200',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/recipes/, '/recipes')
      }
    }
  }
})
