import { Link, NavLink } from 'react-router-dom'

import { useSessions } from '@/hooks/useSessions'
import { formatDateTime } from '@/lib/format'

export default function SessionSidebar({ activeId }: { activeId?: string }) {
  const { data: sessions = [], isPending } = useSessions()

  return (
    <aside className="border-line bg-paper flex w-60 shrink-0 flex-col border-r">
      <div className="border-line border-b p-3">
        <Link
          to="/create"
          className="border-line text-ink hover:bg-soft rounded-control flex items-center justify-center gap-1.5 border py-2 text-sm font-medium transition-colors"
        >
          新对话
        </Link>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <h2 className="text-muted px-2 py-1.5 text-xs font-medium">历史对话</h2>

        {isPending ? (
          <p className="text-faint px-2 text-xs">加载中…</p>
        ) : sessions.length === 0 ? (
          <p className="text-faint px-2 text-xs">还没有会话</p>
        ) : (
          <ul className="space-y-0.5">
            {sessions.map((session) => (
              <li key={session.id}>
                <NavLink
                  to={`/editor/${session.id}`}
                  className={`block rounded-[10px] px-2.5 py-2 transition-colors ${
                    session.id === activeId
                      ? 'bg-brand-soft text-brand-strong'
                      : 'text-muted hover:bg-soft hover:text-ink'
                  }`}
                >
                  <span className="block truncate text-xs font-medium">{session.title}</span>
                  <span className="text-faint block text-[10px] tabular-nums">
                    {formatDateTime(session.updated_at)}
                  </span>
                </NavLink>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  )
}
