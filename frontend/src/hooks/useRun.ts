import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { isTerminal, runsApi, type GenerateInput, type Run, type RunStatus } from '@/api/runs'

type Progress = Pick<Run, 'id' | 'status' | 'progress' | 'stage' | 'error'>

const runKey = (id: string) => ['run', id]

export function useGenerate() {
  return useMutation({ mutationFn: (input: GenerateInput) => runsApi.generate(input) })
}

/**
 * 合并两个进度来源：SSE 提供实时状态，快照接口提供候选图与刷新后的恢复能力。
 */
export function useRun(runId: string | null) {
  const queryClient = useQueryClient()
  const [live, setLive] = useState<Progress | null>(null)

  const snapshot = useQuery({
    queryKey: runKey(runId ?? ''),
    queryFn: () => runsApi.get(runId as string),
    enabled: Boolean(runId),
  })

  useEffect(() => {
    if (!runId) return

    const source = new EventSource(`/events/runs/${runId}`)
    const refresh = () => void queryClient.invalidateQueries({ queryKey: runKey(runId) })

    source.onmessage = (event) => {
      const payload = JSON.parse(event.data) as Progress
      setLive(payload)
      if (isTerminal(payload.status)) {
        source.close()
        refresh()
      }
    }
    // 连接中断时回退到快照接口，避免界面停在过期进度上
    source.onerror = refresh

    return () => source.close()
  }, [runId, queryClient])

  const run = snapshot.data
  // 切换任务后旧连接的残留帧不应影响新任务
  const current = live?.id === runId ? live : null
  const status: RunStatus | undefined = current?.status ?? run?.status

  return {
    status,
    progress: current?.progress ?? run?.progress ?? 0,
    stage: current?.stage ?? run?.stage ?? '',
    error: current?.error ?? run?.error ?? null,
    prompt: run?.prompt ?? null,
    candidates: run?.candidates ?? [],
    isLoading: snapshot.isPending,
    notFound: snapshot.isError,
  }
}
