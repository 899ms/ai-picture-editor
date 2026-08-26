import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import type { PlanStep, Turn } from '@/api/agent'
import { isTerminal } from '@/api/runs'
import { useTurns } from '@/hooks/useAgent'
import { useRun } from '@/hooks/useRun'

export default function AgentConversation({ sessionId }: { sessionId: string }) {
  const { data: turns = [], isPending } = useTurns(sessionId)
  const end = useRef<HTMLDivElement>(null)

  useEffect(() => end.current?.scrollIntoView({ block: 'end' }), [turns.length])

  if (isPending) {
    return <p className="text-faint min-h-0 flex-1 px-4 py-4 text-xs">加载中…</p>
  }

  if (turns.length === 0) {
    return (
      <p className="text-faint min-h-0 flex-1 px-4 py-4 text-xs leading-relaxed">
        用一句话说明要怎么改，例如「水平翻转」或「去背景」。画布变换会直接作用在当前图上。
      </p>
    )
  }

  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-3">
      {turns.map((turn) => (
        <TurnBlock key={turn.id} turn={turn} sessionId={sessionId} />
      ))}
      <div ref={end} />
    </div>
  )
}

function TurnBlock({ turn, sessionId }: { turn: Turn; sessionId: string }) {
  return (
    <div className="space-y-2">
      <p className="bg-brand-soft text-brand-strong ml-6 rounded-[12px] px-3 py-2 text-xs leading-relaxed">
        {turn.goal}
      </p>

      {turn.error ? (
        <p className="text-danger mr-6 text-xs leading-relaxed">{turn.error}</p>
      ) : (
        <p className="text-ink mr-6 text-xs leading-relaxed">{turn.reply}</p>
      )}

      {turn.steps.map((step) => (
        <StepCard key={step.run_id ?? step.tool} step={step} sessionId={sessionId} />
      ))}
    </div>
  )
}

function StepCard({ step, sessionId }: { step: PlanStep; sessionId: string }) {
  const queryClient = useQueryClient()
  const { status, progress, stage, error } = useRun(step.run_id)

  useEffect(() => {
    // 工具产出会进图片墙并写编辑记录，终态后统一刷新会话数据
    if (status && isTerminal(status)) {
      void queryClient.invalidateQueries({ queryKey: ['session', sessionId] })
    }
  }, [status, sessionId, queryClient])

  const running = status === 'queued' || status === 'running'

  return (
    <div className="border-line mr-6 rounded-[12px] border px-3 py-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-ink text-xs font-medium">{step.label}</span>
        <span className="text-faint shrink-0 text-[10px] tabular-nums">
          {running ? `${progress}%` : status === 'succeeded' ? '已完成' : '未完成'}
        </span>
      </div>

      {running && (
        <>
          <div className="bg-line mt-2 h-0.5 overflow-hidden rounded-full">
            <div
              className="bg-ink h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.max(progress, 4)}%` }}
            />
          </div>
          <p className="text-faint mt-1.5 text-[10px]">{stage}</p>
        </>
      )}

      {error && <p className="text-danger mt-1.5 text-[10px] leading-relaxed">{error}</p>}
    </div>
  )
}
