import path from 'path'
import { exec } from 'child_process'
import { fileURLToPath } from 'url'

console.log(import.meta.url)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function getClient(data) {
    if (process.env.VITE_DEV_SERVER_URL) {
        return path.join(__dirname, process.env.PHP_CLIENT_RELATIVE_PATH)
    }

    return path.join(__dirname, '../client.phar')
}

export const execute = async (event, data) => {
    let code = data.code.replaceAll('<?php', '')
    code = btoa(code)
    exec(`${data.php} ${getClient(data)} ${data.path} execute ${code}`, (error, stdout, stderr) => {
        // format Y-m-d H:i:s
        const date = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '')
        let result = '// ' + date + '\n'
        if (stderr) {
            result += stderr
            event.reply('client.execute.reply', result)
            return
        }
        result += stdout

        result = result.trim()

        // Remove surrounding double quotes if present
        if (result.startsWith('"') && result.endsWith('"')) {
            result = result.slice(1, -1)
        }

        event.reply('client.execute.reply', result)
    })
}

export const info = async (event, data) => {
    exec(`${data.php} ${getClient(data)} ${data.path} info`, (error, stdout, stderr) => {
        event.reply('client.info.reply', stdout.replaceAll('\n', ''))
    })
}
