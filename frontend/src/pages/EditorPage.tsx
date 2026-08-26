import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import CanvasStage from '@/components/editor/CanvasStage'
import EditorToolbar from '@/components/editor/EditorToolbar'
import ImageWall from '@/components/editor/ImageWall'
import LayerPanel from '@/components/editor/LayerPanel'
import SessionSidebar from '@/components/editor/SessionSidebar'
import { usePatchSession, useSession } from '@/hooks/useSessions'

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
  const [layersOpen, setLayersOpen] = useState(false)
  const { data: session, isError } = useSession(sessionId)
  const patch = usePatchSession(sessionId)

  const urls = useMemo(
    () => new Map((session?.assets ?? []).map((asset) => [asset.id, asset.url])),
    [session?.assets],
  )

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
          title={session.title}
          revision={session.revision}
          document={session.document}
          layersOpen={layersOpen}
          onRename={(title) => patch.mutate({ title })}
          onToggleLayers={() => setLayersOpen((open) => !open)}
        />

        <div className="min-h-0 flex-1">
          <CanvasStage document={session.document} urls={urls} />
        </div>

        <ImageWall
          assets={session.assets}
          currentId={session.current_asset_id}
          disabled={patch.isPending}
          onPick={(current_asset_id) => patch.mutate({ current_asset_id })}
        />
      </div>

      {layersOpen && <LayerPanel session={session} />}
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
