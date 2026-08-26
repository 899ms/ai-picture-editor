import type { Asset } from '@/api/assets'
import { api } from '@/api/client'

export type LayerKind = 'image' | 'text' | 'shape'

export type Transform = {
  x: number
  y: number
  scale_x: number
  scale_y: number
  rotation: number
}

export type Layer = {
  id: string
  kind: LayerKind
  name: string
  width: number
  height: number
  asset_id: string | null
  transform: Transform
  opacity: number
  visible: boolean
  locked: boolean
}

export type LayerDocument = {
  width: number
  height: number
  layers: Layer[]
}

export type Session = {
  id: string
  title: string
  revision: number
  original_asset_id: string
  current_asset_id: string
  created_at: string
  updated_at: string
}

export type SessionDetail = Session & {
  document: LayerDocument
  assets: Asset[]
}

export type HistoryEntry = {
  seq: number
  action: string
  params: Record<string, unknown>
  result: Record<string, unknown>
  created_at: string
}

export type SessionCreateInput = {
  current_asset_id: string
  asset_ids?: string[]
  title?: string
}

export type SessionPatchInput = {
  title?: string
  current_asset_id?: string
}

export const ACTION_LABELS: Record<string, string> = {
  create_session: '新建会话',
  switch_current: '切换当前图',
}

export const sessionsApi = {
  create: (input: SessionCreateInput) => api.post<SessionDetail>('/sessions', input),
  list: () => api.get<Session[]>('/sessions'),
  get: (id: string) => api.get<SessionDetail>(`/sessions/${id}`),
  patch: (id: string, input: SessionPatchInput) =>
    api.patch<SessionDetail>(`/sessions/${id}`, input),
  history: (id: string) => api.get<HistoryEntry[]>(`/sessions/${id}/history`),
}
