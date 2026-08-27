import { useState } from 'react'
import { Link } from 'react-router-dom'

import type { SessionDetail } from '@/api/sessions'
import type { SessionSelection } from '@/hooks/useSelection'
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
  picking,
  onRename,
}: {
  session: SessionDetail
  tools: SessionTools
  picking: SessionSelection
  onRename: (title: string) => void
}) {
  const scale = useCanvasView((state) => state.scale)
  const fit = useCanvasView((state) => state.fit)
  const stepZoom = useCanvasView((state) => state.stepZoom)
  const zoomTo = useCanvasView((state) => state.zoomTo)
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
        {ui.selectMode ? (
          <>
            <ToolButton
              active={ui.selectMode === 'point'}
              title="点击物体生成选区"
              onClick={() => ui.setSelectMode(ui.selectMode === 'point' ? null : 'point')}
            >
              点选
            </ToolButton>
            <ToolButton
              active={ui.selectMode === 'brush'}
              title="涂抹出选区"
              onClick={() => ui.setSelectMode(ui.selectMode === 'brush' ? null : 'brush')}
            >
              笔刷
            </ToolButton>
            <ToolButton
              disabled={tools.busy || picking.busy || !picking.selection}
              title={picking.selection ? '消除选中区域' : '先点选或涂抹'}
              onClick={() =>
                tools.invoke('erase_region', {
                  mask_asset_id: picking.selection?.maskId,
                  revision: session.revision,
                  layer_id: ui.selectedLayerId,
                })
              }
            >
              消除
            </ToolButton>
            <ToolButton
              disabled={!picking.selection}
              active={ui.panel === 'replace'}
              title={picking.selection ? '按描述替换选区' : '先点选或涂抹'}
              onClick={() => ui.setPanel(ui.panel === 'replace' ? null : 'replace')}
            >
              替换
            </ToolButton>
            <ConfirmTool
              id="promote_object_to_layer"
              disabled={tools.busy || picking.busy || !picking.selection}
              title={picking.selection ? '把选区提升为独立图层' : '先点选或涂抹'}
              confirm="确认成层"
              onConfirm={() =>
                tools.invoke('promote_object_to_layer', {
                  mask_asset_id: picking.selection?.maskId,
                  revision: session.revision,
                })
              }
            >
              成层
            </ConfirmTool>
            <ToolButton
              disabled={!picking.selection || picking.busy}
              title="清除当前选区"
              onClick={picking.clear}
            >
              清除
            </ToolButton>
            <ToolButton title="退出选择 Esc" onClick={() => ui.setSelectMode(null)}>
              完成
            </ToolButton>
          </>
        ) : ui.cropOpen ? (
          <>
            {CROP_RATIOS.map((item) => (
              <ToolButton
                key={item.value}
                active={ui.cropRatio === item.value}
                title={item.value === 'free' ? '自由裁剪' : `按 ${item.label} 裁剪`}
                onClick={() => ui.setCropRatio(item.value, session.document)}
              >
                {item.label}
              </ToolButton>
            ))}
            <ToolButton title="按当前框裁剪画布" onClick={confirmCrop}>
              确定
            </ToolButton>
            <ToolButton title="退出裁剪 Esc" onClick={ui.closeCrop}>
              取消
            </ToolButton>
          </>
        ) : (
          <>
            <ToolButton
              disabled={tools.busy}
              active={ui.cropOpen}
              title="按比例裁剪画布"
              onClick={() => ui.openCrop(session.document)}
            >
              裁剪
            </ToolButton>
            <ToolButton
              disabled={tools.busy}
              title="左右翻转当前图层"
              onClick={() =>
                tools.invoke('flip_layer', {
                  direction: 'horizontal',
                  layer_id: ui.selectedLayerId,
                })
              }
            >
              水平翻转
            </ToolButton>
            <ToolButton
              disabled={tools.busy}
              title="上下翻转当前图层"
              onClick={() =>
                tools.invoke('flip_layer', {
                  direction: 'vertical',
                  layer_id: ui.selectedLayerId,
                })
              }
            >
              垂直翻转
            </ToolButton>
            <ToolButton
              disabled={tools.busy}
              title="抠出主体，背景变透明"
              onClick={() => tools.invoke('remove_background', { layer_id: ui.selectedLayerId })}
            >
              去背景
            </ToolButton>
            <ToolButton
              disabled={tools.busy}
              active={ui.panel === 'background'}
              title="按描述替换背景"
              onClick={() => ui.setPanel(ui.panel === 'background' ? null : 'background')}
            >
              换背景
            </ToolButton>
            <ToolButton
              disabled={tools.busy}
              active={ui.panel === 'expand'}
              title="扩展画布到新比例"
              onClick={() => ui.setPanel(ui.panel === 'expand' ? null : 'expand')}
            >
              扩图
            </ToolButton>
            <ToolButton
              disabled={tools.busy}
              title="把当前画布放大到两倍"
              onClick={() => tools.invoke('upscale_image', { scale: 2 })}
            >
              超分
            </ToolButton>
            <ToolButton
              active={ui.panel === 'adjust'}
              title="调整亮度、对比度和色彩"
              onClick={() => ui.setPanel(ui.panel === 'adjust' ? null : 'adjust')}
            >
              调色
            </ToolButton>
            <ConfirmTool
              id="split_layers"
              disabled={tools.busy}
              title="拆成背景和主体，文字需在图层面板勾选"
              confirm="确认拆层"
              onConfirm={() => tools.invoke('split_layers', { include_text: ui.splitIncludeText })}
            >
              拆层
            </ConfirmTool>
            <ToolButton
              disabled={tools.busy}
              title="点选物体建立选区"
              onClick={() => ui.setSelectMode('point')}
            >
              点选
            </ToolButton>
            <ToolButton
              disabled={tools.busy}
              title="涂抹建立选区"
              onClick={() => ui.setSelectMode('brush')}
            >
              笔刷
            </ToolButton>
          </>
        )}
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1">
        <ToolButton
          disabled={tools.busy || !session.can_undo}
          title={session.can_undo ? '撤销上一步 ⌘Z' : '没有可撤销的操作'}
          onClick={tools.undo}
        >
          撤销
        </ToolButton>
        <ToolButton
          disabled={tools.busy || !session.can_redo}
          title={session.can_redo ? '重做 ⌘⇧Z' : '没有可重做的操作'}
          onClick={tools.redo}
        >
          重做
        </ToolButton>
        <ToolButton
          active={ui.compareOpen}
          disabled={!session.previous_document}
          title={session.previous_document ? '与上一版对比' : '还没有上一版'}
          onClick={() => ui.setCompareOpen(!ui.compareOpen)}
        >
          对比
        </ToolButton>

        <div className="border-line rounded-control ml-1 flex items-center gap-0.5 border p-0.5">
          <ZoomButton label="缩小 -" onClick={() => stepZoom(1 / ZOOM_STEP)}>
            －
          </ZoomButton>
          <button
            type="button"
            onClick={() => zoomTo(1)}
            title="实际像素 · 按 1"
            className="text-muted hover:bg-soft hover:text-ink w-12 rounded-[6px] px-1 py-1 text-xs font-medium tabular-nums transition-all duration-150 active:scale-95"
          >
            {Math.round(scale * 100)}%
          </button>
          <ZoomButton label="放大 +" onClick={() => stepZoom(ZOOM_STEP)}>
            ＋
          </ZoomButton>
          <button
            type="button"
            onClick={() => fit(session.document)}
            title="适应窗口 · 按 0，画布内双击同样生效"
            className="text-muted hover:bg-soft hover:text-ink rounded-[6px] px-2 py-1 text-xs font-medium transition-all duration-150 active:scale-95"
          >
            适应
          </button>
        </div>

        <Link
          to={`/marketing/${session.id}`}
          title="导出营销图和投放尺寸"
          className="text-muted hover:bg-soft hover:text-ink rounded-control px-2.5 py-1.5 text-xs font-medium transition-all duration-150"
        >
          导出
        </Link>
        <ToolButton
          active={ui.panel === 'layers'}
          title="图层、变换和编辑记录"
          onClick={() => ui.setPanel(ui.panel === 'layers' ? null : 'layers')}
        >
          图层
        </ToolButton>
      </div>
    </header>
  )
}

function ConfirmTool({
  id,
  children,
  title,
  confirm,
  disabled,
  onConfirm,
}: {
  id: string
  children: React.ReactNode
  title: string
  confirm: string
  disabled?: boolean
  onConfirm: () => void
}) {
  const confirming = useEditorUi((state) => state.confirming)
  const setConfirming = useEditorUi((state) => state.setConfirming)
  const armed = confirming === id

  return (
    <ToolButton
      active={armed}
      disabled={disabled}
      title={armed ? confirm : title}
      onClick={() => {
        if (armed) {
          setConfirming(null)
          onConfirm()
          return
        }
        setConfirming(id)
      }}
    >
      {armed ? confirm : children}
    </ToolButton>
  )
}

function ToolButton({
  children,
  onClick,
  disabled,
  active,
  title,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  active?: boolean
  title?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-pressed={active}
      className={`rounded-control px-2.5 py-1.5 text-xs font-medium transition-all duration-150 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100 ${
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
      className="text-muted hover:bg-soft hover:text-ink grid size-7 place-items-center rounded-[6px] text-sm transition-all duration-150 active:scale-90"
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
