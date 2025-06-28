import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import dotenv from 'dotenv'
import { resolve } from 'path'
import Components from 'unplugin-vue-components/vite'
import RadixVueResolver from 'radix-vue/resolver'

dotenv.config()

// https://vitejs.dev/config/
export default defineConfig({
  root: 'src/renderer/',
  base: './',
  server: {
    port: parseInt(process.env.VITE_SERVER_PORT || '4999'),
  },
  plugins: [
    vue(),
    Components({
      dts: true,
      resolvers: [RadixVueResolver()],
    }),
  ],
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
