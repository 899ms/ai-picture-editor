import { useEffect, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'

import CanvasHint from '@/components/editor/CanvasHint'
import CanvasStage from '@/components/editor/CanvasStage'
import EditorToolbar from '@/components/editor/EditorToolbar'
import ImageWall from '@/components/editor/ImageWall'
import LayerPanel from '@/components/editor/LayerPanel'
import SessionSidebar from '@/components/editor/SessionSidebar'
import { useSelection } from '@/hooks/useSelection'
import { usePatchSession, useSession, useSessionTools } from '@/hooks/useSessions'
import { ZOOM_STEP, useCanvasView } from '@/stores/canvasView'
import { useEditorUi } from '@/stores/editorUi'

export default function EditorPage() {
  const { sessionId = '' } = useParams()

  return (
    <div className="flex h-full">
      <SessionSidebar activeId={sessionId} />
      {sessionId ? (
        <Workspace sessionId={sessionId} />
      ) : (
        <Notice title="选择一个会话" hint="从左侧打开历史对话，或回到创作页开始新的一张。">
          <CreateLink />
        </Notice>
      )}
    </div>
  )
}

function Workspace({ sessionId }: { sessionId: string }) {
  const { data: session, isError } = useSession(sessionId)
  const patch = usePatchSession(sessionId)
  const tools = useSessionTools(sessionId)
  const picking = useSelection(sessionId, session?.revision ?? 0)

  const cropOpen = useEditorUi((state) => state.cropOpen)
  const compareOpen = useEditorUi((state) => state.compareOpen)
  const panel = useEditorUi((state) => state.panel)
  const selectMode = useEditorUi((state) => state.selectMode)
  const closeCrop = useEditorUi((state) => state.closeCrop)
  const setCompareOpen = useEditorUi((state) => state.setCompareOpen)
  const setSelectMode = useEditorUi((state) => state.setSelectMode)

  const fit = useCanvasView((state) => state.fit)
  const stepZoom = useCanvasView((state) => state.stepZoom)
  const zoomTo = useCanvasView((state) => state.zoomTo)

  const urls = useMemo(
    () => new Map((session?.assets ?? []).map((asset) => [asset.id, asset.url])),
    [session?.assets],
  )

  useEffect(() => {
    if (!session) return
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return
      }
      if (event.key === 'Escape') {
        closeCrop()
        setCompareOpen(false)
        setSelectMode(null)
        return
      }

      const meta = event.metaKey || event.ctrlKey
      if (meta && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.repeat || tools.busy) return
        if (event.shiftKey) {
          if (session.can_redo) tools.redo()
        } else if (session.can_undo) tools.undo()
        return
      }
      if (meta && event.key.toLowerCase() === 'y') {
        event.preventDefault()
        if (event.repeat || tools.busy) return
        if (session.can_redo) tools.redo()
        return
      }

      // 视图快捷键不带修饰键，避开浏览器自身的缩放
      if (meta || event.shiftKey || event.altKey) return
      if (event.key === '0') fit(session.document)
      else if (event.key === '1') zoomTo(1)
      else if (event.key === '=' || event.key === '+') stepZoom(ZOOM_STEP)
      else if (event.key === '-') stepZoom(1 / ZOOM_STEP)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [session, tools, closeCrop, setCompareOpen, setSelectMode, fit, stepZoom, zoomTo])

  if (!session) {
    return isError ? (
      <Notice title="会话不存在" hint="链接可能已失效，回到创作页新建一个。">
        <CreateLink />
      </Notice>
    ) : (
      <Notice title="加载中" hint="正在读取会话状态" />
    )
  }

  return (
    <>
      <div className="flex min-w-0 flex-1 flex-col">
        <EditorToolbar
          session={session}
          tools={tools}
          picking={picking}
          onRename={(title) => patch.mutate({ title })}
        />

        <div className="relative min-h-0 flex-1">
          <CanvasStage
            document={session.document}
            previous={session.previous_document}
            urls={urls}
            selection={picking.selection}
            onPoint={picking.busy ? undefined : picking.addPoint}
            onStroke={picking.busy ? undefined : picking.addStroke}
            onMove={(layer_id, x, y) => tools.invoke('move_layer', { layer_id, x, y })}
            onScale={(layer_id, scale) =>
              tools.invoke('scale_layer', { layer_id, scale_x: scale, scale_y: scale })
            }
          />
          <CanvasHint
            text={
              tools.busy
                ? `${tools.pendingStage || '处理中'}${tools.pendingProgress ? ` · ${tools.pendingProgress}%` : ''}`
                : cropOpen
                  ? '拖动裁剪框，点确定应用 · Esc 取消'
                  : compareOpen
                    ? '拖动画布上的圆点对比上一版 · Esc 退出'
                    : selectMode === 'point'
                      ? '点击物体建立选区，可连续点选 · Esc 退出'
                      : selectMode === 'brush'
                        ? '按住涂抹选区 · Esc 退出'
                        : null
            }
          />
          {panel && (
            <div className="shadow-panel animate-slide-in absolute inset-y-0 right-0 z-20">
              <LayerPanel session={session} tools={tools} />
            </div>
          )}
        </div>

        <ImageWall
          assets={session.assets}
          currentId={session.current_asset_id}
          disabled={patch.isPending || tools.busy}
          onPick={(current_asset_id) => patch.mutate({ current_asset_id })}
        />
      </div>
    </>
  )
}

function CreateLink() {
  return (
    <Link
      to="/create"
      className="bg-ink hover:bg-dark rounded-control mt-5 px-4 py-2 text-sm font-medium text-white"
    >
      去创作
    </Link>
  )
}

function Notice({
  title,
  hint,
  children,
}: {
  title: string
  hint: string
  children?: React.ReactNode
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
      <h1 className="text-ink text-lg font-semibold">{title}</h1>
      <p className="text-muted mt-1 max-w-sm text-sm">{hint}</p>
      {children}
    </div>
  )
}
