import { api } from '@/api/client'
import type { RunStatus } from '@/api/runs'

export type PlanStep = {
  tool: string
  label: string
  run_id: string | null
}

export type Turn = {
  id: string
  revision: number
  goal: string
  reply: string
  status: RunStatus
  error: string | null
  created_at: string
  steps: PlanStep[]
}

export const agentApi = {
  turns: (sessionId: string) => api.get<Turn[]>(`/sessions/${sessionId}/messages`),
  send: (sessionId: string, text: string) =>
    api.post<Turn>(`/sessions/${sessionId}/messages`, { text }),
}
