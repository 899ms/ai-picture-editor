import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import RequireAuth from '@/layouts/RequireAuth'
import WorkbenchLayout from '@/layouts/WorkbenchLayout'
import AuthPage from '@/pages/AuthPage'
import CreatePage from '@/pages/CreatePage'
import LandingPage from '@/pages/LandingPage'
import PlaceholderPage from '@/pages/PlaceholderPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth" element={<AuthPage />} />

        <Route element={<RequireAuth />}>
          <Route element={<WorkbenchLayout />}>
            <Route path="/create" element={<CreatePage />} />
            <Route path="/editor" element={<PlaceholderPage title="编辑" hint="S4 实现" />} />
            <Route path="/batch" element={<PlaceholderPage title="批量" hint="S11 实现" />} />
          </Route>
          <Route path="/candidates" element={<PlaceholderPage title="选出一张" hint="S3 实现" />} />
          <Route path="/marketing" element={<PlaceholderPage title="导出物料" hint="S10 实现" />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
