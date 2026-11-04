import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import fetch from 'node-fetch'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { CopilotAuth } from './copilot-auth'

vi.mock('node-fetch', () => ({
  default: vi.fn(),
}))

vi.mock('../settings', () => ({
  settingsDir: '/tmp',
}))

vi.mock('electron', () => ({
  app: { getVersion: () => '0.14.0' },
  shell: { openExternal: vi.fn().mockResolvedValue(undefined) },
}))

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tweakphp-copilot-test-'))
const tokenFilePath = path.join(tempDir, 'copilot.json')

afterAll(() => {
  fs.rmSync(tempDir, { recursive: true, force: true })
})

const jsonResponse = (status: number, data: unknown): any => ({
  status,
  statusText: 'OK',
  json: async () => data,
})

describe('CopilotAuth', () => {
  let notify: (channel: string, payload?: unknown) => void

  beforeEach(() => {
    vi.clearAllMocks()
    try {
      fs.unlinkSync(tokenFilePath)
    } catch (e) {}
    notify = vi.fn()
  })

  const makeAuth = () => new CopilotAuth({ notify, tokenFilePath })

  it('reports not signed in when no tokens are stored', () => {
    const auth = makeAuth()
    expect(auth.getStatus()).toEqual({ signedIn: false })
  })

  it('runs the device flow and stores tokens on success', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        jsonResponse(200, {
          device_code: 'device-code',
          user_code: 'ABCD-1234',
          verification_uri: 'https://github.com/login/device',
          interval: 0.001,
          expires_in: 900,
        })
      )
      .mockResolvedValueOnce(jsonResponse(200, { error: 'authorization_pending' }))
      .mockResolvedValueOnce(jsonResponse(200, { access_token: 'gho_github-token' }))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          token: 'copilot-api-token',
          expires_at: 9999999999,
          endpoints: { api: 'https://api.test' },
        })
      )

    const auth = makeAuth()
    await auth.signIn()

    expect(notify).toHaveBeenCalledWith('copilot:sign-in-code', {
      userCode: 'ABCD-1234',
      verificationUri: 'https://github.com/login/device',
    })
    expect(auth.getStatus()).toEqual({ signedIn: true })

    const stored = JSON.parse(fs.readFileSync(tokenFilePath).toString())
    expect(stored.githubToken).toBe('gho_github-token')
    expect(stored.copilotToken).toBe('copilot-api-token')
    expect(stored.apiEndpoint).toBe('https://api.test')
    expect(stored.machineId).toBeTruthy()

    const token = await auth.getCopilotToken()
    expect(token.token).toBe('copilot-api-token')
    expect(token.apiEndpoint).toBe('https://api.test')
  })

  it('fails when device authorization expires', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(200, {
        device_code: 'device-code',
        user_code: 'ABCD-1234',
        verification_uri: 'https://github.com/login/device',
        interval: 0.001,
        expires_in: 0.001,
      })
    )

    const auth = makeAuth()
    await expect(auth.signIn()).rejects.toThrow('expired')
    expect(auth.getStatus()).toEqual({ signedIn: false })
  })

  it('returns cached copilot token when still valid', async () => {
    fs.writeFileSync(
      tokenFilePath,
      JSON.stringify({
        githubToken: 'gho_github-token',
        copilotToken: 'cached-token',
        apiEndpoint: 'https://api.test',
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
        machineId: 'machine-id',
      })
    )

    const auth = makeAuth()
    const token = await auth.getCopilotToken()

    expect(token.token).toBe('cached-token')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('refreshes an expired copilot token', async () => {
    fs.writeFileSync(
      tokenFilePath,
      JSON.stringify({
        githubToken: 'gho_github-token',
        copilotToken: 'expired-token',
        apiEndpoint: 'https://api.old',
        expiresAt: Math.floor(Date.now() / 1000) - 10,
        machineId: 'machine-id',
      })
    )

    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(200, {
        token: 'fresh-token',
        expires_at: 9999999999,
        endpoints: { api: 'https://api.test' },
      })
    )

    const auth = makeAuth()
    const token = await auth.getCopilotToken()

    expect(token.token).toBe('fresh-token')
    expect(token.apiEndpoint).toBe('https://api.test')
    expect(fetch).toHaveBeenCalledWith(
      'https://api.github.com/copilot_internal/v2/token',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'token gho_github-token',
        }),
      })
    )
  })

  it('throws when not signed in and a copilot token is requested', async () => {
    const auth = makeAuth()
    await expect(auth.getCopilotToken()).rejects.toThrow('Not signed in')
  })

  it('signs out on 401 during token exchange', async () => {
    fs.writeFileSync(
      tokenFilePath,
      JSON.stringify({
        githubToken: 'gho_github-token',
        copilotToken: '',
        apiEndpoint: 'https://api.test',
        expiresAt: 0,
        machineId: 'machine-id',
      })
    )

    vi.mocked(fetch).mockResolvedValue({ status: 401, statusText: 'Unauthorized' } as any)

    const auth = makeAuth()
    await expect(auth.getCopilotToken()).rejects.toThrow('no longer valid')
    expect(auth.getStatus()).toEqual({ signedIn: false })
    expect(fs.existsSync(tokenFilePath)).toBe(false)
  })

  it('derives the completions endpoint from the proxy-ep field of the token', () => {
    fs.writeFileSync(
      tokenFilePath,
      JSON.stringify({
        githubToken: 'gho_github-token',
        copilotToken:
          'tid=abc;exp=9999999999;proxy-ep=proxy.business.githubcopilot.com;sku=copilot_for_business_seat_quota',
        apiEndpoint: 'https://api.business.githubcopilot.com',
        expiresAt: 9999999999,
        machineId: 'machine-id',
      })
    )

    const auth = makeAuth()
    expect(auth.getCompletionsEndpoint()).toBe('https://proxy.business.githubcopilot.com')
  })

  it('falls back to the api endpoint when the token has no proxy-ep field', () => {
    fs.writeFileSync(
      tokenFilePath,
      JSON.stringify({
        githubToken: 'gho_github-token',
        copilotToken: 'tid=abc;exp=9999999999',
        apiEndpoint: 'https://api.individual.githubcopilot.com',
        expiresAt: 9999999999,
        machineId: 'machine-id',
      })
    )

    const auth = makeAuth()
    expect(auth.getCompletionsEndpoint()).toBe('https://api.individual.githubcopilot.com')
  })

  it('sign out removes stored tokens', async () => {
    fs.writeFileSync(
      tokenFilePath,
      JSON.stringify({
        githubToken: 'gho_github-token',
        copilotToken: 'cached-token',
        apiEndpoint: 'https://api.test',
        expiresAt: 9999999999,
        machineId: 'machine-id',
      })
    )

    const auth = makeAuth()
    auth.signOut()

    expect(auth.getStatus()).toEqual({ signedIn: false })
    expect(fs.existsSync(tokenFilePath)).toBe(false)
  })
})
