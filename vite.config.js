import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],server: {
    port: 3000,     // 👉 ici tu changes le port
    host: true      // utile si tu veux accéder depuis un téléphone
  }
})
