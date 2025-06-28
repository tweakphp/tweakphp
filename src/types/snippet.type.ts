export interface Snippet {
  id: number
  code: string
  name: string
  tab_id?: string | number
  tab_name?: string
  tags?: string[]
  created_at: string
  updated_at: string
}