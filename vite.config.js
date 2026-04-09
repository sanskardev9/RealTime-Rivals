import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  server: {
    allowedHosts: ["5f46-110-235-232-160.ngrok-free.app"],
  },
  plugins: [react(), tailwindcss()],
})
