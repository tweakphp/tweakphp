import { z } from 'zod'
import { AiCompletion } from '../tools/ai-completion'
import { Tab } from '../../types/tab.type'
import { registerIpcHandler } from './ipc-utils'

const aiCompletionSchema = z.object({
  context: z.object({}).passthrough(),
  tab: z.object({}).passthrough(),
})

const aiService = new AiCompletion()

export function registerAiIpc(): void {
  registerIpcHandler(
    'ai:get-completion',
    async ({ context, tab }) => {
      return aiService.getCompletions(
        context as unknown as Parameters<typeof aiService.getCompletions>[0],
        tab as unknown as Tab
      )
    },
    aiCompletionSchema
  )
}
