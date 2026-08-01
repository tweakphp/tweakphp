import { z } from 'zod'

export const connectionTypes = ['local', 'docker', 'ssh', 'kubectl', 'vapor'] as const

export type ConnectionType = (typeof connectionTypes)[number]

export type LocalConnectionConfig = Readonly<{
  id: string
  type: 'local'
  name: string
  php: string
  path: string
}>

export type SSHConnectionConfig = Readonly<{
  id: string
  type: 'ssh'
  name: string
  color?: string | null
  host: string
  port: number
  username: string
  auth_type: 'password' | 'private_key' | 'agent' | string
  password?: string | null
  privateKey?: string | null
  passphrase?: string | null
  path: string
  php?: string | null
  client_path?: string | null
}>

export type DockerConnectionConfig = Readonly<{
  id: string
  type: 'docker'
  name: string
  container_id: string
  container_name: string
  working_directory: string
  php_version?: string | null
  php_path?: string | null
  client_path?: string | null
  ssh_id?: string | null
}>

export type KubectlConnectionConfig = Readonly<{
  id: string
  type: 'kubectl'
  name: string
  color?: string | null
  context?: string | null
  namespace?: string | null
  pod: string
  path?: string | null
  php?: string | null
  client_path?: string | null
}>

export type VaporConnectionConfig = Readonly<{
  id: string
  type: 'vapor'
  name: string
  environment?: string | null
  client_path?: string | null
  environments?: readonly string[]
}>

export type ConnectionConfig =
  LocalConnectionConfig | SSHConnectionConfig | DockerConnectionConfig | KubectlConnectionConfig | VaporConnectionConfig

export const LocalConnectionSchema = z.object({
  id: z.string(),
  type: z.literal('local'),
  name: z.string(),
  php: z.string(),
  path: z.string(),
})

export const SSHConnectionSchema = z.object({
  id: z.string(),
  type: z.literal('ssh'),
  name: z.string(),
  color: z.string().nullable().optional(),
  host: z.string(),
  port: z.number(),
  username: z.string(),
  auth_type: z.string(),
  password: z.string().nullable().optional(),
  privateKey: z.string().nullable().optional(),
  passphrase: z.string().nullable().optional(),
  path: z.string(),
  php: z.string().nullable().optional(),
  client_path: z.string().nullable().optional(),
})

export const DockerConnectionSchema = z.object({
  id: z.string(),
  type: z.literal('docker'),
  name: z.string(),
  container_id: z.string(),
  container_name: z.string(),
  working_directory: z.string(),
  php_version: z.string().nullable().optional(),
  php_path: z.string().nullable().optional(),
  client_path: z.string().nullable().optional(),
  ssh_id: z.string().nullable().optional(),
})

export const KubectlConnectionSchema = z.object({
  id: z.string(),
  type: z.literal('kubectl'),
  name: z.string(),
  color: z.string().nullable().optional(),
  context: z.string().nullable().optional(),
  namespace: z.string().nullable().optional(),
  pod: z.string(),
  path: z.string().nullable().optional(),
  php: z.string().nullable().optional(),
  client_path: z.string().nullable().optional(),
})

export const VaporConnectionSchema = z.object({
  id: z.string(),
  type: z.literal('vapor'),
  name: z.string(),
  environment: z.string().nullable().optional(),
  client_path: z.string().nullable().optional(),
  environments: z.array(z.string()).optional(),
})

export const ConnectionSchema = z.discriminatedUnion('type', [
  LocalConnectionSchema,
  SSHConnectionSchema,
  DockerConnectionSchema,
  KubectlConnectionSchema,
  VaporConnectionSchema,
])

export function createImmutableConnectionConfig(raw: unknown): ConnectionConfig {
  const parsed = ConnectionSchema.parse(raw)
  return Object.freeze(parsed) as ConnectionConfig
}
