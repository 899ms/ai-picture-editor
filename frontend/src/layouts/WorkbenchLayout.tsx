import { NavLink, Outlet } from 'react-router-dom'

const NAV_ITEMS = [
  { to: '/create', label: '创作', icon: 'M12 4v16m8-8H4' },
  { to: '/editor', label: '编辑', icon: 'M4 20h4L20 8l-4-4L4 16v4z' },
  { to: '/batch', label: '批量', icon: 'M4 6h16M4 12h16M4 18h10' },
]

function NavIcon({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-5 shrink-0" aria-hidden>
      <path d={path} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

/** 工作台外壳：左侧导航默认收起为图标，悬停展开文字。 */
export default function WorkbenchLayout() {
  return (
    <div className="flex h-screen overflow-hidden">
      <nav className="group bg-paper border-line flex w-16 flex-col border-r py-4 transition-[width] duration-200 hover:w-52">
        <div className="mb-6 flex items-center gap-3 px-5">
          <span className="bg-ink text-accent grid size-6 shrink-0 place-items-center rounded-md text-xs font-semibold">
            R
          </span>
          <span className="text-ink truncate text-sm font-semibold opacity-0 transition-opacity group-hover:opacity-100">
            修图智能体
          </span>
        </div>

        <ul className="flex flex-1 flex-col gap-1 px-2">
          {NAV_ITEMS.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-[12px] px-3 py-2.5 text-sm transition-colors ${
                    isActive
                      ? 'bg-brand-soft text-brand-strong font-medium'
                      : 'text-muted hover:bg-soft hover:text-ink'
                  }`
                }
              >
                <NavIcon path={item.icon} />
                <span className="truncate opacity-0 transition-opacity group-hover:opacity-100">
                  {item.label}
                </span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
