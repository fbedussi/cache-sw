import { defineConfig } from 'vite'

export default defineConfig({
  base: '/cache-sw/',
  build: {
    // hack to use github pages
    outDir: 'docs'
  }
})
