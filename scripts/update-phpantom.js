import path from 'path'
import fs from 'fs'
import os from 'os'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'
import AdmZip from 'adm-zip'
import fetch from 'node-fetch'

import {
  PHPANTOM_VERSION,
  phpantomReleaseAssetUrl,
  phpantomTargetsForPlatform,
} from '../src/main/lsp/phpantom-config.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outputRoot = path.join(__dirname, '..', 'phpantom-bin')

// Download the pinned PHPantom release for the current platform: every arch
// that platform's electron builds can ship (e.g. both darwin triples for the
// universal mac build). electron-builder copies only the matching triple per
// target via extraResources filters.
async function main() {
  const targets = phpantomTargetsForPlatform(process.platform)
  if (!targets.length) {
    throw new Error(`No PHPantom release assets are mapped for platform "${process.platform}"`)
  }

  console.log(
    `Fetching PHPantom language server v${PHPANTOM_VERSION} for ${process.platform} (${targets.length} arch target(s))`
  )

  for (const target of targets) {
    await installTarget(target)
  }

  console.log('PHPantom language server downloaded.')
}

async function installTarget(target) {
  const url = phpantomReleaseAssetUrl(target.platform, target.arch)
  const stagingDir = fs.mkdtempSync(path.join(os.tmpdir(), `phpantom-${target.triple}-`))

  try {
    const archivePath = path.join(stagingDir, `phpantom_lsp-${target.triple}.${target.archive}`)
    console.log(`Downloading ${url}`)
    await downloadFile(url, archivePath)

    const extractDir = path.join(stagingDir, 'extracted')
    fs.mkdirSync(extractDir, { recursive: true })
    extractArchive(archivePath, extractDir)

    const binaryPath = findBinary(extractDir, target.binary)
    if (!binaryPath) {
      throw new Error(`Could not find ${target.binary} inside the ${target.triple} archive`)
    }

    const outputDir = path.join(outputRoot, target.triple)
    fs.rmSync(outputDir, { recursive: true, force: true })
    fs.mkdirSync(outputDir, { recursive: true })

    const outputBinary = path.join(outputDir, target.binary)
    fs.copyFileSync(binaryPath, outputBinary)
    if (target.platform !== 'win32') {
      fs.chmodSync(outputBinary, 0o755)
    }

    console.log(`Installed ${path.relative(path.join(__dirname, '..'), outputBinary)}`)
  } finally {
    fs.rmSync(stagingDir, { recursive: true, force: true })
  }
}

async function downloadFile(url, output) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed to download ${url} (${response.status})`)

  fs.writeFileSync(output, Buffer.from(await response.arrayBuffer()))
}

function extractArchive(archivePath, extractDir) {
  if (archivePath.endsWith('.zip')) {
    new AdmZip(archivePath).extractAllTo(extractDir, true)
    return
  }

  execFileSync('tar', ['-xzf', archivePath, '-C', extractDir])
}

function findBinary(dir, binaryName) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      const found = findBinary(entryPath, binaryName)
      if (found) return found
    } else if (entry.name === binaryName) {
      return entryPath
    }
  }

  return null
}

main().catch(error => {
  console.error('Error fetching PHPantom release:', error.message)
  process.exit(1)
})
