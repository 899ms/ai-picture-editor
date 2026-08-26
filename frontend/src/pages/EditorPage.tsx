import { useEffect, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'

import CanvasStage from '@/components/editor/CanvasStage'
import EditorToolbar from '@/components/editor/EditorToolbar'
import ImageWall from '@/components/editor/ImageWall'
import LayerPanel from '@/components/editor/LayerPanel'
import SessionSidebar from '@/components/editor/SessionSidebar'
import { usePatchSession, useSession, useSessionTools } from '@/hooks/useSessions'
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
  const ui = useEditorUi()

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
      const meta = event.metaKey || event.ctrlKey
      if (meta && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) {
          if (session.can_redo) tools.redo()
        } else if (session.can_undo) tools.undo()
      }
      if (meta && event.key.toLowerCase() === 'y' && session.can_redo) {
        event.preventDefault()
        tools.redo()
      }
      if (event.key === 'Escape') {
        ui.closeCrop()
        ui.setCompareOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [session, tools, ui])

  if (isError) {
    return (
      <Notice title="会话不存在" hint="链接可能已失效，回到创作页新建一个。">
        <CreateLink />
      </Notice>
    )
  }

  if (!session) {
    return <Notice title="加载中" hint="正在读取会话状态" />
  }

  return (
    <>
      <div className="flex min-w-0 flex-1 flex-col">
        <EditorToolbar
          session={session}
          tools={tools}
          onRename={(title) => patch.mutate({ title })}
        />

        {tools.pendingStage && (
          <p className="text-muted bg-soft px-4 py-1.5 text-xs">
            {tools.pendingStage}
            {tools.pendingProgress ? ` · ${tools.pendingProgress}%` : ''}
          </p>
        )}

        <div className="relative min-h-0 flex-1">
          <CanvasStage
            document={session.document}
            previous={session.previous_document}
            urls={urls}
          />
          {ui.compareOpen && session.previous_document && (
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={ui.compareAt}
              onChange={(event) => ui.setCompareAt(Number(event.target.value))}
              aria-label="前后对比"
              className="accent-brand absolute bottom-4 left-1/2 w-56 -translate-x-1/2"
            />
          )}
        </div>

        <ImageWall
          assets={session.assets}
          currentId={session.current_asset_id}
          disabled={patch.isPending || tools.busy}
          onPick={(current_asset_id) => patch.mutate({ current_asset_id })}
        />
      </div>

      {ui.panel && <LayerPanel session={session} tools={tools} />}
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
