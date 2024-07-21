import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import electron from 'vite-plugin-electron'
import importMetaUrlPlugin from '@codingame/esbuild-import-meta-url-plugin'
import vsixPlugin from '@codingame/monaco-vscode-rollup-vsix-plugin'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        vue(),
        electron({
            entry: 'electron/main.js',
        }),
        vsixPlugin(),
    ],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
        },
    },
    optimizeDeps: {
        esbuildOptions: {
            plugins: [importMetaUrlPlugin],
        },
    },
})
