import { notarize } from 'electron-notarize'

export default async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context
  if (electronPlatformName !== 'darwin') {
    return
  }

  if (process.env.SKIP_NOTARIZE) {
    console.log('Skipping notarization because SKIP_NOTARIZE is set')
    return
  }

  const appName = context.packager.appInfo.productFilename

  return await notarize({
    tool: 'notarytool',
    teamId: process.env.APPLE_TEAM_ID,
    appBundleId: 'com.tweakphp.app',
    appPath: `${appOutDir}/${appName}.app`,
    appleId: process.env.APPLE_ID,
    appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
  })
}
