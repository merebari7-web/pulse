import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Vite config for PULSE.
 * - base './'      → the build works from any path (subfolder, file://, sandboxed preview)
 * - allowedHosts   → dev server answers for proxied/tunnel hostnames, not just localhost
 * - manualChunks   → keeps the ~600 kB of three/postprocessing in its own cacheable chunk
 */
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 5173,
    allowedHosts: true,
  },
  preview: {
    host: true,
    port: 4173,
    allowedHosts: true,
  },
  build: {
    target: 'es2022',
    cssTarget: 'chrome120',
    chunkSizeWarningLimit: 1800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          /* The GLTF/Draco loaders are only reachable through the lazy
             <ImportedHeart/> chunk, so they get their own chunk: with the default
             procedural model the browser never asks for them. */
          if (/three\/examples\/jsm\/(loaders|utils)/.test(id)) return 'vendor-loaders'
          if (id.includes('three') || id.includes('postprocessing') || id.includes('n8ao') || id.includes('@react-three')) {
            return 'vendor-3d'
          }
          if (id.includes('gsap') || id.includes('lenis')) return 'vendor-motion'
          return 'vendor'
        },
      },
    },
  },
})
