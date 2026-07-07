import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// API calls go to /api/* which Netlify Dev proxies to netlify/functions
// (run `netlify dev` from the repo root, not `vite` directly, for those to work).
export default defineConfig({
  plugins: [react()],
})
