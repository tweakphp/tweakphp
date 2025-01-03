import path from 'path'
import fs from 'fs'

async function copyFile(src, dest) {
  const srcPath = path.resolve(__dirname, '..', src)
  const destPath = path.resolve(__dirname, '..', dest)

  fs.mkdirSync(path.dirname(destPath), { recursive: true })

  fs.copyFileSync(srcPath, destPath)
  console.log(`Copied ${src} to ${dest}`)
}

await copyFile('build/icon.png', 'dist/icon.png')
await copyFile('build/icon.icns', 'dist/icon.icns')
await copyFile('build/icon.ico', 'dist/icon.ico')
