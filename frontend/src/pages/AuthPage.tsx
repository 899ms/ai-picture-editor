import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'

import { errorMessage, useAuthActions, useCurrentUser } from '@/hooks/useAuth'

type Mode = 'login' | 'register'

const COPY: Record<Mode, { title: string; submit: string; switchTo: Mode; switchHint: string }> = {
  login: { title: '登录', submit: '登录', switchTo: 'register', switchHint: '还没有账号？注册' },
  register: { title: '注册', submit: '注册并进入', switchTo: 'login', switchHint: '已有账号？登录' },
}

export default function AuthPage() {
  const [params, setParams] = useSearchParams()
  const mode: Mode = params.get('mode') === 'register' ? 'register' : 'login'
  const copy = COPY[mode]

  const navigate = useNavigate()
  const { user, isLoading } = useCurrentUser()
  const { login, register } = useAuthActions()
  const action = mode === 'login' ? login : register

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  if (!isLoading && user) return <Navigate to="/create" replace />

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    action.mutate({ username, password }, { onSuccess: () => navigate('/create', { replace: true }) })
  }

  const switchMode = () => {
    action.reset()
    setParams({ mode: copy.switchTo })
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <Link to="/" className="text-muted hover:text-ink mb-8 inline-block text-sm">
          ← 返回首页
        </Link>

        <h1 className="text-ink mb-6 text-2xl font-semibold tracking-tight">{copy.title}</h1>

        <form onSubmit={submit} className="space-y-4">
          <Field
            label="用户名"
            value={username}
            onChange={setUsername}
            autoComplete="username"
            placeholder="3–32 位字母、数字或下划线"
          />
          <Field
            label="密码"
            type="password"
            value={password}
            onChange={setPassword}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            placeholder="至少 6 位"
          />

          {action.isError && <p className="text-danger text-sm">{errorMessage(action.error)}</p>}

          <button
            type="submit"
            disabled={action.isPending}
            className="bg-ink hover:bg-dark w-full rounded-[12px] py-2.5 text-sm font-medium text-white transition-colors disabled:opacity-50"
          >
            {action.isPending ? '处理中…' : copy.submit}
          </button>
        </form>

        <button
          type="button"
          onClick={switchMode}
          className="text-muted hover:text-brand-strong mt-5 text-sm transition-colors"
        >
          {copy.switchHint}
        </button>
      </div>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  autoComplete,
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  autoComplete?: string
  placeholder?: string
}) {
  return (
    <label className="block">
      <span className="text-muted mb-1.5 block text-sm">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        required
        className="border-line bg-paper text-ink placeholder:text-faint focus:border-brand w-full rounded-[12px] border px-3.5 py-2.5 text-sm outline-none transition-colors"
      />
    </label>
  )
}
