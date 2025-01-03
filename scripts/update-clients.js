import path from 'path'
import fs from 'fs'
import fetch from 'node-fetch'
import * as glob from 'glob'

function cleanup() {
  const files = glob.sync(path.join(__dirname, '../public', 'client-*.phar'))
  files.forEach(file => {
    fs.unlinkSync(file)
  })
}

async function downloadFile(url, output) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed to fetch ${url}`)

  const destPath = path.resolve(__dirname, '..', output)
  fs.mkdirSync(path.dirname(destPath), { recursive: true })

  const fileStream = fs.createWriteStream(destPath)
  response.body.pipe(fileStream)

  return new Promise((resolve, reject) => {
    fileStream.on('finish', resolve)
    fileStream.on('error', reject)
  })
}

cleanup()

fetch('https://api.github.com/repos/tweakphp/client/releases/latest')
  .then(response => response.json())
  .then(data => {
    data.assets.forEach(async asset => {
      const url = asset.browser_download_url
      const filePath = path.join(__dirname, '../public', asset.name)
      await downloadFile(url, filePath)
    })
    console.log('Downloaded all client files.')
  })
  .catch(err => {
    console.error('Error fetching release data:', err.message)
  })
