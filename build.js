const { buildSync } = require('esbuild')
const { copySync } = require('fs-extra')

const options = {
  platform: 'node',
  bundle: true,
  target: 'node20',
  external: ['electron', 'better-sqlite3', 'cpu-features'],
  define: {
    'process.env.NODE_ENV': `"${process.argv[2] === '--dev' ? 'development' : 'production'}"`,
    'process.platform': `"${process.platform}"`,
  },
  loader: {
    '.node': 'file',
  },
}

buildSync({
  entryPoints: ['src/main/main.ts'],
  outfile: 'dist/main.js',
  ...options,
  minify: process.argv[2] !== '--dev',
})

buildSync({
  entryPoints: ['src/preload/preload.ts'],
  outfile: 'dist/preload.js',
  ...options,
})

copySync('build/icon.png', 'dist/icon.png')
copySync('build/icon.icns', 'dist/icon.icns')
copySync('build/icon.ico', 'dist/icon.ico')
