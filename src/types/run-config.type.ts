import cp from 'child_process'

export interface RunConfig {
  serverName: string
  serverPort: number
  runCommand: string
  runCommandArgs: string[]
  spawnOptions?: cp.SpawnOptions
  pathName: string
  wsServerOptions: any
}
