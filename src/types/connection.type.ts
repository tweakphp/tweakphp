/**
 * Canonical registry of connection types.
 *
 * The connection config shapes actually used at runtime (clients, IPC,
 * renderer stores) live in their own modules and are unioned in
 * `client-connection.type.ts`:
 * - `local.type.ts` / `ssh.type.ts` / `docker.type.ts` / `kubectl.type.ts` / `vapor.type.ts`
 *
 * A previous parallel set of zod-validated types that lived here
 * (`ConnectionSchema`, `createImmutableConnectionConfig`, `id: string`
 * readonly configs, `auth_type: 'private_key'`) had zero call sites and
 * contradicted the runtime shapes (numeric ids, `auth_type: 'key'`,
 * string ports) — removed in Task R4.1 of plan/SECURITY_RENDERER_PLAN.md.
 * Do not reintroduce parallel connection types here.
 */
export const connectionTypes = ['local', 'docker', 'ssh', 'kubectl', 'vapor'] as const

export type ConnectionType = (typeof connectionTypes)[number]
