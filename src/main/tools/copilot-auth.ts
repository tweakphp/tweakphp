import fetch from 'node-fetch'
import * as fs from 'node:fs'
import path from 'path'
import { randomUUID } from 'node:crypto'
import { app, shell } from 'electron'
import { settingsDir } from '../settings.ts'

const GITHUB_CLIENT_ID = 'Iv1.b507a08c87ecfe98'
const DEVICE_CODE_URL = 'https://github.com/login/device/code'
const ACCESS_TOKEN_URL = 'https://github.com/login/oauth/access_token'
const COPILOT_TOKEN_URL = 'https://api.github.com/copilot_internal/v2/token'
const DEFAULT_API_ENDPOINT = 'https://api.individual.githubcopilot.com'

export interface CopilotApiToken {
  token: string
  apiEndpoint: string
  expiresAt: number
}

interface StoredTokens {
  githubToken: string
  copilotToken: string
  apiEndpoint: string
  expiresAt: number
  machineId: string
}

export interface CopilotAuthOptions {
  notify?: (channel: string, payload?: unknown) => void
  tokenFilePath?: string
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export const copilotEditorHeaders = (): Record<string, string> => {
  const version = app.getVersion()
  return {
    'User-Agent': `TweakPHP/${version}`,
    'Editor-Version': `TweakPHP/${version}`,
    'Editor-Plugin-Version': `tweakphp-copilot/${version}`,
    'Copilot-Integration-Id': 'tweakphp',
  }
}

export class CopilotAuth {
  private readonly tokenFilePath: string
  private readonly notify: (channel: string, payload?: unknown) => void
  private readonly sessionId: string
  private pendingRefresh: Promise<CopilotApiToken> | null = null
  private pendingSignIn: Promise<void> | null = null

  constructor(options: CopilotAuthOptions = {}) {
    this.notify = options.notify ?? (() => {})
    this.tokenFilePath = options.tokenFilePath ?? path.join(settingsDir, 'copilot.json')
    this.sessionId = randomUUID()
  }

  public getStatus(): { signedIn: boolean } {
    return { signedIn: Boolean(this.loadTokens()?.githubToken) }
  }

  public getSessionId(): string {
    return this.sessionId
  }

  public getMachineId(): string {
    return this.loadTokens()?.machineId ?? this.sessionId
  }

  /**
   * Runs the GitHub OAuth device flow, exactly like Zed does:
   * request a device code, let the user authorize it on github.com/login/device,
   * poll until the access token is issued, then exchange it for a
   * short-lived Copilot API token.
   */
  public async signIn(): Promise<void> {
    if (this.pendingSignIn) {
      return this.pendingSignIn
    }
    this.pendingSignIn = this.doSignIn()
    try {
      await this.pendingSignIn
    } finally {
      this.pendingSignIn = null
    }
  }

  public signOut(): void {
    this.removeTokens()
  }

  /**
   * Returns a valid Copilot API token, refreshing it when expired.
   * Concurrent callers share a single refresh request.
   */
  public async getCopilotToken(): Promise<CopilotApiToken> {
    const stored = this.loadTokens()
    if (!stored?.githubToken) {
      throw new Error('Not signed in to GitHub Copilot.')
    }

    const now = Math.floor(Date.now() / 1000)
    if (stored.copilotToken && stored.expiresAt - 120 > now) {
      return { token: stored.copilotToken, apiEndpoint: stored.apiEndpoint, expiresAt: stored.expiresAt }
    }

    if (!this.pendingRefresh) {
      this.pendingRefresh = this.exchangeForCopilotToken(stored.githubToken).finally(() => {
        this.pendingRefresh = null
      })
    }
    return this.pendingRefresh
  }

  /**
   * Returns the endpoint that serves inline completion requests.
   * The Copilot token carries the host to use in its `proxy-ep` field
   * (e.g. `proxy.business.githubcopilot.com`); fall back to the API endpoint
   * from the token exchange when it is absent (e.g. individual plans).
   */
  public getCompletionsEndpoint(): string {
    const stored = this.loadTokens()
    const match = stored?.copilotToken?.match(/(?:^|;)proxy-ep=([^;]+)/)
    if (match) {
      return `https://${match[1]}`
    }
    return stored?.apiEndpoint || DEFAULT_API_ENDPOINT
  }

  /**
   * Drops the cached Copilot token (e.g. after a 401) keeping the GitHub
   * token, so the next call fetches a fresh one.
   */
  public invalidateCopilotToken(): void {
    const stored = this.loadTokens()
    if (stored?.copilotToken) {
      this.saveTokens({ ...stored, copilotToken: '', expiresAt: 0 })
    }
  }

  private async doSignIn(): Promise<void> {
    const deviceResponse = await fetch(DEVICE_CODE_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...copilotEditorHeaders(),
      },
      body: JSON.stringify({ client_id: GITHUB_CLIENT_ID, scope: 'read:user' }),
    })

    if (deviceResponse.status !== 200) {
      const body = await deviceResponse.text()
      throw new Error(
        `GitHub device code request failed: ${deviceResponse.status} ${deviceResponse.statusText}. ${body}`
      )
    }

    const deviceData = await deviceResponse.json()
    const deviceCode: string = deviceData.device_code
    const userCode: string = deviceData.user_code
    const verificationUri: string = deviceData.verification_uri
    const interval: number = deviceData.interval || 5
    const expiresIn: number = deviceData.expires_in || 900

    this.notify('copilot:sign-in-code', { userCode, verificationUri })

    await shell.openExternal(verificationUri).catch(() => {})

    let pollInterval = interval * 1000
    const deadline = Date.now() + expiresIn * 1000

    while (Date.now() < deadline) {
      await sleep(pollInterval)

      const tokenResponse = await fetch(ACCESS_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          ...copilotEditorHeaders(),
        },
        body: JSON.stringify({
          client_id: GITHUB_CLIENT_ID,
          device_code: deviceCode,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        }),
      })

      if (tokenResponse.status !== 200) {
        const body = await tokenResponse.text()
        throw new Error(`GitHub token request failed: ${tokenResponse.status} ${tokenResponse.statusText}. ${body}`)
      }

      const tokenData = await tokenResponse.json()

      if (tokenData.access_token) {
        await this.exchangeForCopilotToken(tokenData.access_token)
        return
      }

      if (tokenData.error === 'slow_down') {
        pollInterval += 5000
      } else if (tokenData.error === 'authorization_pending') {
        // keep polling
      } else if (tokenData.error) {
        throw new Error(`GitHub sign in failed: ${tokenData.error}`)
      }
    }

    throw new Error('GitHub device authorization expired. Please try again.')
  }

  private async exchangeForCopilotToken(githubToken: string): Promise<CopilotApiToken> {
    const response = await fetch(COPILOT_TOKEN_URL, {
      headers: {
        Accept: 'application/json',
        Authorization: `token ${githubToken}`,
        ...copilotEditorHeaders(),
      },
    })

    if (response.status === 401 || response.status === 403) {
      this.signOut()
      throw new Error('Your GitHub token is no longer valid. Please sign in again.')
    }

    if (response.status !== 200) {
      const body = await response.text()
      throw new Error(
        `Failed to get Copilot token: ${response.status} ${response.statusText}. ${body}` +
          ' Make sure your GitHub account has an active Copilot subscription.'
      )
    }

    const data = await response.json()
    const apiEndpoint: string = data.endpoints?.api || DEFAULT_API_ENDPOINT

    const stored = this.loadTokens()
    this.saveTokens({
      githubToken,
      copilotToken: data.token,
      apiEndpoint,
      expiresAt: data.expires_at,
      machineId: stored?.machineId || randomUUID(),
    })

    return { token: data.token, apiEndpoint, expiresAt: data.expires_at }
  }

  private loadTokens(): StoredTokens | null {
    try {
      if (!fs.existsSync(this.tokenFilePath)) {
        return null
      }
      const raw = fs.readFileSync(this.tokenFilePath).toString()
      const tokens = JSON.parse(raw)
      if (!tokens || typeof tokens !== 'object' || !tokens.githubToken) {
        return null
      }
      return tokens
    } catch (error) {
      return null
    }
  }

  private saveTokens(tokens: StoredTokens): void {
    fs.writeFileSync(this.tokenFilePath, JSON.stringify(tokens, null, 2))
  }

  private removeTokens(): void {
    try {
      if (fs.existsSync(this.tokenFilePath)) {
        fs.unlinkSync(this.tokenFilePath)
      }
    } catch (error) {}
  }
}
