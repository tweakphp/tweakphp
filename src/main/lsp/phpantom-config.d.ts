export interface PhpantomTarget {
  triple: string
  archive: 'zip' | 'tar.gz'
  binary: string
}

export declare const PHPANTOM_VERSION: string
export declare const phpantomTarget: (platform: string, arch: string) => PhpantomTarget | null
export declare const phpantomAssetName: (platform: string, arch: string) => string | null
export declare const phpantomReleaseAssetUrl: (platform: string, arch: string) => string | null
export declare const phpantomTargetsForPlatform: (
  platform: string
) => Array<PhpantomTarget & { platform: string; arch: string }>
