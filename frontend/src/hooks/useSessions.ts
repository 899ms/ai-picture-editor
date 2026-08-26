import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { sessionsApi, type SessionCreateInput, type SessionPatchInput } from '@/api/sessions'

const LIST_KEY = ['sessions']
const detailKey = (id: string) => ['session', id]
const historyKey = (id: string) => ['session', id, 'history']

export function useSessions() {
  return useQuery({ queryKey: LIST_KEY, queryFn: sessionsApi.list })
}

export function useSession(id: string | null) {
  return useQuery({
    queryKey: detailKey(id ?? ''),
    queryFn: () => sessionsApi.get(id as string),
    enabled: Boolean(id),
  })
}

export function useSessionHistory(id: string | null) {
  return useQuery({
    queryKey: historyKey(id ?? ''),
    queryFn: () => sessionsApi.history(id as string),
    enabled: Boolean(id),
  })
}

export function useCreateSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: SessionCreateInput) => sessionsApi.create(input),
    onSuccess: (detail) => {
      queryClient.setQueryData(detailKey(detail.id), detail)
      void queryClient.invalidateQueries({ queryKey: LIST_KEY })
    },
  })
}

export function usePatchSession(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: SessionPatchInput) => sessionsApi.patch(id, input),
    onSuccess: (detail) => {
      queryClient.setQueryData(detailKey(id), detail)
      void queryClient.invalidateQueries({ queryKey: LIST_KEY })
      void queryClient.invalidateQueries({ queryKey: historyKey(id) })
    },
  })
}
