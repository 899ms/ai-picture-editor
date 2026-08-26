import { create } from 'zustand'

const MIN_SCALE = 0.05
const MAX_SCALE = 8
// 适应画布时留出四周余量，避免图片贴边
const FIT_RATIO = 0.92

export const ZOOM_STEP = 1.2

type Size = { width: number; height: number }
type Point = { x: number; y: number }

type CanvasViewState = {
  scale: number
  x: number
  y: number
  viewport: Size
  setViewport: (viewport: Size) => void
  fit: (document: Size) => void
  zoomBy: (factor: number, anchor?: Point) => void
  zoomTo: (scale: number) => void
  pan: (point: Point) => void
}

const clamp = (scale: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale))

/**
 * 观察倍率与位移，只影响编辑器视图，不参与导出。图层缩放另存于 LayerDocument。
 */
export const useCanvasView = create<CanvasViewState>((set, get) => ({
  scale: 1,
  x: 0,
  y: 0,
  viewport: { width: 0, height: 0 },

  setViewport: (viewport) => set({ viewport }),

  fit: (document) => {
    const { viewport } = get()
    if (!viewport.width || !viewport.height) return

    const scale = clamp(
      Math.min(viewport.width / document.width, viewport.height / document.height) * FIT_RATIO,
    )
    set({
      scale,
      x: (viewport.width - document.width * scale) / 2,
      y: (viewport.height - document.height * scale) / 2,
    })
  },

  zoomBy: (factor, anchor) => {
    const { scale, x, y, viewport } = get()
    const next = clamp(scale * factor)
    const pivot = anchor ?? { x: viewport.width / 2, y: viewport.height / 2 }
    // 以锚点为不动点，滚轮位置下的画面内容不漂移
    const ratio = next / scale
    set({
      scale: next,
      x: pivot.x - (pivot.x - x) * ratio,
      y: pivot.y - (pivot.y - y) * ratio,
    })
  },

  zoomTo: (scale) => get().zoomBy(scale / get().scale),

  pan: (point) => set(point),
}))
