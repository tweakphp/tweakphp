export interface ConnectReply {
  connected: boolean
  connection?: any
  error?: any
  data?: any
}

export interface ActionReply {
  type: string
  error?: any
  result?: any
}
