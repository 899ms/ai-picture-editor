import { create } from 'zustand'

export type ToastTone = 'ok' | 'danger'

export type Toast = {
  id: number
  text: string
  tone: ToastTone
  leaving: boolean
}

type ToastsState = {
  items: Toast[]
  push: (text: string, tone?: ToastTone) => void
  dismiss: (id: number) => void
}

const LEAVE_MS = 180

let nextId = 1

export const useToasts = create<ToastsState>((set, get) => ({
  items: [],

  push: (text, tone = 'ok') => {
    const id = nextId++
    set({
      items: [...get().items.slice(-2), { id, text, tone, leaving: false }],
    })
    window.setTimeout(() => get().dismiss(id), 3200)
  },

  // 先标记退场让动画播完，再从列表移除
  dismiss: (id) => {
    const item = get().items.find((toast) => toast.id === id)
    if (!item || item.leaving) return
    set({
      items: get().items.map((toast) => (toast.id === id ? { ...toast, leaving: true } : toast)),
    })
    window.setTimeout(
      () => set({ items: get().items.filter((toast) => toast.id !== id) }),
      LEAVE_MS,
    )
  },
}))

export function toast(text: string, tone: ToastTone = 'ok') {
  useToasts.getState().push(text, tone)
}
