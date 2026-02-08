import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue(), vueJsx()],
  root: __dirname,
  resolve: {
    alias: {
      '@': resolve(__dirname, '../src'),
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler',
        silenceDeprecations: ['legacy-js-api', 'import'],
      },
    },
  },
  server: {
    port: 5173,
    host: '0.0.0.0',
    open: true,
  },
  optimizeDeps: {
    include: ['vue', 'vant'],
  },
})
