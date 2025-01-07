import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import dotenv from 'dotenv'
import { resolve } from 'path'

dotenv.config()

// https://vitejs.dev/config/
export default defineConfig({
  root: 'src/renderer/',
  base: './',
  server: {
    port: parseInt(process.env.VITE_SERVER_PORT || '4999'),
  },
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/renderer/'),
    },
  },
  build: {
    outDir: '../../dist/app/',
    assetsDir: '.',
  },
})
