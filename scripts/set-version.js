import fs from 'fs'
import path from 'path'

const packageJsonPath = path.join(__dirname, 'package.json')
const newVersion = process.argv[2]

if (!newVersion) {
  console.error('Please provide a version number.')
  process.exit(1)
}

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
packageJson.version = newVersion

fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2))
console.log(`Version updated to ${newVersion}`)
