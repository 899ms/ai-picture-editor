import { useRef, useState } from 'react'

export function useSelectStroke() {
  const drawing = useRef(false)
  const points = useRef<{ x: number; y: number }[]>([])
  const [draft, setDraft] = useState<{ x: number; y: number }[]>([])

  return {
    draft,
    start: (point: { x: number; y: number }) => {
      drawing.current = true
      points.current = [point]
      setDraft([point])
    },
    move: (point: { x: number; y: number }) => {
      if (!drawing.current) return
      points.current = [...points.current, point]
      setDraft(points.current)
    },
    end: () => {
      const stroke = drawing.current ? points.current : []
      drawing.current = false
      points.current = []
      setDraft([])
      return stroke
    },
  }
}
