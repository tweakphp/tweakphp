export interface Snippet {
  id: number
  code: string
  name: string
  tab_id?: string | number | null
  tab_name?: string | null
  tags: string[]
  created_at: string
  updated_at: string
}
