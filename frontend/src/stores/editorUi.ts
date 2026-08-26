import { create } from 'zustand'

import type { Ratio } from '@/api/runs'
import type { LayerDocument } from '@/api/sessions'

export type CropRatio = Ratio | 'free'
export type CropRect = { x: number; y: number; width: number; height: number }

type EditorUi = {
  selectedLayerId: string | null
  cropOpen: boolean
  cropRatio: CropRatio
  cropRect: CropRect | null
  compareOpen: boolean
  compareAt: number
  panel: 'layers' | 'adjust' | null
  selectLayer: (id: string | null) => void
  openCrop: (document: LayerDocument, ratio?: CropRatio) => void
  setCropRatio: (ratio: CropRatio, document: LayerDocument) => void
  setCropRect: (rect: CropRect) => void
  closeCrop: () => void
  setCompareOpen: (open: boolean) => void
  setCompareAt: (value: number) => void
  setPanel: (panel: 'layers' | 'adjust' | null) => void
}

function fitCrop(document: LayerDocument, ratio: CropRatio): CropRect {
  if (ratio === 'free') {
    const inset = 0.08
    return {
      x: document.width * inset,
      y: document.height * inset,
      width: document.width * (1 - inset * 2),
      height: document.height * (1 - inset * 2),
    }
  }
  const [rw, rh] = ratio.split(':').map(Number)
  let width = document.width
  let height = (document.width * rh) / rw
  if (height > document.height) {
    height = document.height
    width = (document.height * rw) / rh
  }
  return {
    x: (document.width - width) / 2,
    y: (document.height - height) / 2,
    width,
    height,
  }
}

export const useEditorUi = create<EditorUi>((set) => ({
  selectedLayerId: null,
  cropOpen: false,
  cropRatio: 'free',
  cropRect: null,
  compareOpen: false,
  compareAt: 0.5,
  panel: null,

  selectLayer: (selectedLayerId) => set({ selectedLayerId }),

  openCrop: (document, ratio = 'free') =>
    set({
      cropOpen: true,
      compareOpen: false,
      cropRatio: ratio,
      cropRect: fitCrop(document, ratio),
    }),

  setCropRatio: (cropRatio, document) => set({ cropRatio, cropRect: fitCrop(document, cropRatio) }),

  setCropRect: (cropRect) => set({ cropRect }),

  closeCrop: () => set({ cropOpen: false, cropRect: null }),

  setCompareOpen: (compareOpen) =>
    set((state) => ({ compareOpen, cropOpen: compareOpen ? false : state.cropOpen })),

  setCompareAt: (compareAt) => set({ compareAt }),

  setPanel: (panel) => set({ panel }),
}))
