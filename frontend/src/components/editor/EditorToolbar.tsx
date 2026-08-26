import { useState } from 'react'

import type { LayerDocument } from '@/api/sessions'
import { ZOOM_STEP, useCanvasView } from '@/stores/canvasView'

export default function EditorToolbar({
  title,
  revision,
  document,
  layersOpen,
  onRename,
  onToggleLayers,
}: {
  title: string
  revision: number
  document: LayerDocument
  layersOpen: boolean
  onRename: (title: string) => void
  onToggleLayers: () => void
}) {
  const { scale, fit, zoomBy, zoomTo } = useCanvasView()

  return (
    <header className="border-line bg-paper flex h-14 shrink-0 items-center gap-3 border-b px-4">
      <TitleField value={title} onCommit={onRename} />

      <span className="text-faint shrink-0 text-xs tabular-nums">
        {document.width} × {document.height} · 第 {revision} 版
      </span>

      <div className="border-line rounded-control ml-auto flex shrink-0 items-center gap-0.5 border p-0.5">
        <ZoomButton label="缩小" onClick={() => zoomBy(1 / ZOOM_STEP)}>
          －
        </ZoomButton>
        <button
          type="button"
          onClick={() => zoomTo(1)}
          title="实际像素"
          className="text-muted hover:text-ink w-14 rounded-[6px] px-1 py-1 text-xs font-medium tabular-nums transition-colors"
        >
          {Math.round(scale * 100)}%
        </button>
        <ZoomButton label="放大" onClick={() => zoomBy(ZOOM_STEP)}>
          ＋
        </ZoomButton>
        <button
          type="button"
          onClick={() => fit(document)}
          className="text-muted hover:text-ink rounded-[6px] px-2 py-1 text-xs font-medium transition-colors"
        >
          适应
        </button>
      </div>

      <button
        type="button"
        onClick={onToggleLayers}
        aria-pressed={layersOpen}
        className={`rounded-control shrink-0 px-3 py-1.5 text-xs font-medium transition-colors ${
          layersOpen ? 'bg-brand-soft text-brand-strong' : 'text-muted hover:bg-soft hover:text-ink'
        }`}
      >
        图层
      </button>
    </header>
  )
}

function ZoomButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="text-muted hover:text-ink grid size-7 place-items-center rounded-[6px] text-sm transition-colors"
    >
      {children}
    </button>
  )
}

function TitleField({ value, onCommit }: { value: string; onCommit: (title: string) => void }) {
  // draft 为 null 表示未编辑，此时直接跟随服务端标题
  const [draft, setDraft] = useState<string | null>(null)

  const commit = () => {
    const next = draft?.trim()
    setDraft(null)
    if (next && next !== value) onCommit(next)
  }

  return (
    <input
      value={draft ?? value}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
        if (event.key === 'Escape') setDraft(null)
      }}
      aria-label="会话标题"
      className="text-ink hover:bg-soft focus:bg-soft min-w-0 flex-1 rounded-[8px] px-2 py-1 text-sm font-medium outline-none"
    />
  )
}
