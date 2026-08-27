import { useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'

import { sessionsApi, type Selection } from '@/api/sessions'
import { errorMessage } from '@/hooks/useAuth'
import { BRUSH_RADIUS } from '@/lib/brush'
import { toast } from '@/stores/toasts'
import { useEditorUi, type CanvasSelection } from '@/stores/editorUi'

function toCanvas(selection: Selection): CanvasSelection {
  return {
    revision: selection.revision,
    maskId: selection.mask.id,
    maskUrl: selection.mask.url,
    markers: selection.markers,
  }
}

export function useSelection(sessionId: string, revision: number) {
  const setSelection = useEditorUi((state) => state.setSelection)
  const dropStaleSelection = useEditorUi((state) => state.dropStaleSelection)
  const selection = useEditorUi((state) => state.selection)

  useEffect(() => {
    dropStaleSelection(revision)
  }, [revision, dropStaleSelection])

  const select = useMutation({
    mutationFn: (input: Parameters<typeof sessionsApi.select>[1]) =>
      sessionsApi.select(sessionId, input),
    onSuccess: (body) => setSelection(toCanvas(body)),
    onError: (error) => toast(errorMessage(error), 'danger'),
  })

  const clear = useMutation({
    mutationFn: () => sessionsApi.clearSelection(sessionId),
    onSuccess: () => setSelection(null),
    onError: (error) => toast(errorMessage(error), 'danger'),
  })

  return {
    selection,
    busy: select.isPending || clear.isPending,
    addPoint: (x: number, y: number) =>
      select.mutate({
        revision,
        points: [{ x, y }],
        append: Boolean(selection && selection.revision === revision),
      }),
    addStroke: (points: { x: number; y: number }[]) =>
      select.mutate({ revision, strokes: [points], radius: BRUSH_RADIUS }),
    clear: () => clear.mutate(),
  }
}

export type SessionSelection = ReturnType<typeof useSelection>
