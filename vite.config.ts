import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// base relativo: funciona no GitHub Pages (/gc-gestao-casa/) e em qualquer outro host estático
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
})
