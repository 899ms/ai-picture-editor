import { useState } from 'react'

import type { SessionDetail } from '@/api/sessions'
import type { SessionTools } from '@/hooks/useSessions'
import { ZOOM_STEP, useCanvasView } from '@/stores/canvasView'
import { useEditorUi, type CropRatio } from '@/stores/editorUi'

const CROP_RATIOS: { value: CropRatio; label: string }[] = [
  { value: 'free', label: '自由' },
  { value: '1:1', label: '1:1' },
  { value: '4:5', label: '4:5' },
  { value: '9:16', label: '9:16' },
  { value: '16:9', label: '16:9' },
]

export default function EditorToolbar({
  session,
  tools,
  onRename,
}: {
  session: SessionDetail
  tools: SessionTools
  onRename: (title: string) => void
}) {
  const { scale, fit, zoomBy, zoomTo } = useCanvasView()
  const ui = useEditorUi()

  const confirmCrop = () => {
    if (!ui.cropRect) return
    tools.invoke('crop_canvas', {
      rect: {
        x: ui.cropRect.x / session.document.width,
        y: ui.cropRect.y / session.document.height,
        width: ui.cropRect.width / session.document.width,
        height: ui.cropRect.height / session.document.height,
      },
    })
    ui.closeCrop()
  }

  return (
    <header className="border-line bg-paper flex h-14 shrink-0 items-center gap-2 border-b px-3">
      <TitleField value={session.title} onCommit={onRename} />

      <span className="text-faint hidden shrink-0 text-xs tabular-nums sm:block">
        {session.document.width} × {session.document.height}
      </span>

      <div className="ml-1 flex shrink-0 items-center gap-1">
        {ui.cropOpen ? (
          <>
            {CROP_RATIOS.map((item) => (
              <ToolButton
                key={item.value}
                active={ui.cropRatio === item.value}
                onClick={() => ui.setCropRatio(item.value, session.document)}
              >
                {item.label}
              </ToolButton>
            ))}
            <ToolButton onClick={confirmCrop}>确定</ToolButton>
            <ToolButton onClick={ui.closeCrop}>取消</ToolButton>
          </>
        ) : (
          <>
            <ToolButton
              disabled={tools.busy}
              active={ui.cropOpen}
              onClick={() => ui.openCrop(session.document)}
            >
              裁剪
            </ToolButton>
            <ToolButton
              disabled={tools.busy}
              onClick={() => tools.invoke('flip_layer', { direction: 'horizontal' })}
            >
              水平翻转
            </ToolButton>
            <ToolButton
              disabled={tools.busy}
              onClick={() => tools.invoke('flip_layer', { direction: 'vertical' })}
            >
              垂直翻转
            </ToolButton>
            <ToolButton disabled={tools.busy} onClick={() => tools.invoke('remove_background')}>
              去背景
            </ToolButton>
            <ToolButton
              active={ui.panel === 'adjust'}
              onClick={() => ui.setPanel(ui.panel === 'adjust' ? null : 'adjust')}
            >
              调色
            </ToolButton>
          </>
        )}
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1">
        <ToolButton disabled={tools.busy || !session.can_undo} onClick={tools.undo}>
          撤销
        </ToolButton>
        <ToolButton disabled={tools.busy || !session.can_redo} onClick={tools.redo}>
          重做
        </ToolButton>
        <ToolButton
          active={ui.compareOpen}
          disabled={!session.previous_document}
          onClick={() => ui.setCompareOpen(!ui.compareOpen)}
        >
          对比
        </ToolButton>

        <div className="border-line rounded-control ml-1 flex items-center gap-0.5 border p-0.5">
          <ZoomButton label="缩小" onClick={() => zoomBy(1 / ZOOM_STEP)}>
            －
          </ZoomButton>
          <button
            type="button"
            onClick={() => zoomTo(1)}
            title="实际像素"
            className="text-muted hover:text-ink w-12 rounded-[6px] px-1 py-1 text-xs font-medium tabular-nums"
          >
            {Math.round(scale * 100)}%
          </button>
          <ZoomButton label="放大" onClick={() => zoomBy(ZOOM_STEP)}>
            ＋
          </ZoomButton>
          <button
            type="button"
            onClick={() => fit(session.document)}
            className="text-muted hover:text-ink rounded-[6px] px-2 py-1 text-xs font-medium"
          >
            适应
          </button>
        </div>

        <ToolButton
          active={ui.panel === 'layers'}
          onClick={() => ui.setPanel(ui.panel === 'layers' ? null : 'layers')}
        >
          图层
        </ToolButton>
      </div>
    </header>
  )
}

function ToolButton({
  children,
  onClick,
  disabled,
  active,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  active?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`rounded-control px-2.5 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        active ? 'bg-brand-soft text-brand-strong' : 'text-muted hover:bg-soft hover:text-ink'
      }`}
    >
      {children}
    </button>
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
      className="text-muted hover:text-ink grid size-7 place-items-center rounded-[6px] text-sm"
    >
      {children}
    </button>
  )
}

function TitleField({ value, onCommit }: { value: string; onCommit: (title: string) => void }) {
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
      className="text-ink hover:bg-soft focus:bg-soft w-28 shrink-0 rounded-[8px] px-2 py-1 text-sm font-medium outline-none sm:w-40"
    />
  )
}
