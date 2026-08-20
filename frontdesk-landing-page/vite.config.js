import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Installer .exe is bundled via ?url import; raise limit for large assets
    assetsInlineLimit: 0,
  },
})
