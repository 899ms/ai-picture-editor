import { Link } from 'react-router-dom'

import { useCurrentUser } from '@/hooks/useAuth'

const CAPABILITIES = [
  { title: '一句话生成', desc: '无需上传图片，描述需求即可生成 4 个候选方向。' },
  { title: '主体级编辑', desc: '点选任意物体后再下指令，改动不会外溢到选区之外。' },
  { title: '语义图层', desc: '主体、背景、文字自动分层，任意物体可按需独立成层。' },
  { title: '物料包交付', desc: '卖点标注与 1:1、4:5、9:16 尺寸一次导出。' },
]

export default function LandingPage() {
  const { user } = useCurrentUser()

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-8 py-6">
        <div className="flex items-center gap-2.5">
          <span className="bg-ink text-accent grid size-7 place-items-center rounded-md text-sm font-semibold">
            R
          </span>
          <span className="text-ink font-semibold">AI 修图智能体</span>
        </div>

        {user ? (
          <Link to="/create" className="text-muted hover:text-ink text-sm transition-colors">
            {user.username} · 进入工作台
          </Link>
        ) : (
          <Link to="/auth" className="text-muted hover:text-ink text-sm transition-colors">
            登录
          </Link>
        )}
      </header>

      <main className="mx-auto max-w-5xl px-8">
        <section className="py-20">
          <p className="text-brand-strong mb-4 text-sm font-medium">面向电商运营与内容创作者</p>
          <h1 className="text-ink max-w-2xl text-5xl leading-[1.15] font-semibold tracking-tight">
            一句话，交付可上架的商品物料
          </h1>
          <p className="text-muted mt-5 max-w-xl leading-relaxed">
            输入需求即可从零生成，也可上传商品图继续编辑。抠图、换背景、局部修改、扩图、图层拆分与多尺寸导出由智能体自动编排。
          </p>

          <div className="mt-9 flex items-center gap-3">
            <Link
              to={user ? '/create' : '/auth?mode=register'}
              className="bg-ink hover:bg-dark rounded-[12px] px-6 py-3 text-sm font-medium text-white transition-colors"
            >
              {user ? '进入工作台' : '免费开始'}
            </Link>
            {!user && (
              <Link
                to="/auth"
                className="border-line-strong text-ink hover:bg-soft rounded-[12px] border px-6 py-3 text-sm font-medium transition-colors"
              >
                已有账号登录
              </Link>
            )}
          </div>
        </section>

        <section className="grid gap-4 pb-24 sm:grid-cols-2">
          {CAPABILITIES.map((item) => (
            <article
              key={item.title}
              className="border-line bg-paper rounded-[18px] border p-6 transition-shadow hover:shadow-[0_16px_42px_rgb(25_31_26/0.09)]"
            >
              <h2 className="text-ink mb-2 font-medium">{item.title}</h2>
              <p className="text-muted text-sm leading-relaxed">{item.desc}</p>
            </article>
          ))}
        </section>
      </main>
    </div>
  )
}
