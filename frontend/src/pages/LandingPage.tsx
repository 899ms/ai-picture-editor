import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { api } from '@/api/client'

type Health = Record<string, string>

export default function LandingPage() {
  const { data, isError } = useQuery({
    queryKey: ['health'],
    queryFn: () => api.get<Health>('/health'),
  })

  const entries = isError ? [['api', 'unreachable']] : Object.entries(data ?? {})

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-8 px-8">
      <div className="space-y-3">
        <h1 className="text-ink text-3xl font-semibold tracking-tight">AI 修图智能体</h1>
        <p className="text-muted leading-relaxed">
          一句话生成商品图，或上传后继续编辑，自动串联抠图、换背景、局部修改与多尺寸导出。
        </p>
      </div>

      <Link
        to="/create"
        className="bg-ink hover:bg-dark w-fit rounded-[12px] px-5 py-2.5 text-sm font-medium text-white transition-colors"
      >
        进入工作台
      </Link>

      <dl className="border-line bg-paper flex flex-wrap gap-x-8 gap-y-2 rounded-[18px] border px-5 py-4 text-sm">
        {entries.map(([name, status]) => (
          <div key={name} className="flex items-center gap-2">
            <span
              className={`size-1.5 rounded-full ${status === 'ok' ? 'bg-success' : 'bg-danger'}`}
            />
            <dt className="text-muted">{name}</dt>
            <dd className="text-ink font-medium">{status}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
