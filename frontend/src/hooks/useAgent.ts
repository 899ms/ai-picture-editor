import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { agentApi } from '@/api/agent'

const turnsKey = (sessionId: string) => ['session', sessionId, 'messages']

export function useTurns(sessionId: string) {
  return useQuery({ queryKey: turnsKey(sessionId), queryFn: () => agentApi.turns(sessionId) })
}

export function useSendMessage(sessionId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (text: string) => agentApi.send(sessionId, text),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: turnsKey(sessionId) }),
  })
}
