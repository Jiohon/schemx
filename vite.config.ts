import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import dts from 'vite-plugin-dts'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    vue(),
    vueJsx(),
    dts({
      include: ['src/**/*.ts', 'src/**/*.tsx', 'src/**/*.vue'],
      outDir: 'dist',
      rollupTypes: true,
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'SchemaForm',
      formats: ['es', 'cjs', 'umd'],
      fileName: (format) => {
        if (format === 'es') return 'index.mjs'
        if (format === 'cjs') return 'index.cjs'
        return 'index.umd.js'
      },
    },
    rollupOptions: {
      external: ['vue', 'vant'],
      output: {
        globals: {
          vue: 'Vue',
          vant: 'Vant',
        },
        exports: 'named',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === 'style.css') return 'style.css'
          return assetInfo.name || 'asset'
        },
      },
    },
    sourcemap: true,
    minify: 'terser',
  },
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `@import "./src/styles/variables.scss";`,
      },
    },
  },
})
