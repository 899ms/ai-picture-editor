import { useEffect, useState } from 'react'

import type { LayerDocument } from '@/api/sessions'
import { preloadCanvasImage } from '@/hooks/useCanvasImage'

export type HeldCanvas = { document: LayerDocument; urls: Map<string, string> }

/** 决定要不要等预加载、要不要切图过渡：画幅或图层资源变了才算换图。 */
export function canvasStamp(document: LayerDocument, urls: Map<string, string>) {
  const layers = document.layers
    .map((layer) => `${layer.id}:${layer.asset_id}:${layer.asset_id ? urls.get(layer.asset_id) : ''}`)
    .join('|')
  return `${document.width}x${document.height}:${layers}`
}

function needed(document: LayerDocument, urls: Map<string, string>) {
  return document.layers.flatMap((layer) => {
    if (!layer.visible || layer.kind !== 'image' || !layer.asset_id) return []
    const url = urls.get(layer.asset_id)
    return url ? [url] : []
  })
}

/** 下一张图预加载完成前继续画当前帧，避免切图时空一层再弹出来。 */
export function useHeldCanvas(document: LayerDocument, urls: Map<string, string>): HeldCanvas {
  const [shown, setShown] = useState<HeldCanvas>({ document, urls })
  const incomingKey = canvasStamp(document, urls)
  const shownKey = canvasStamp(shown.document, shown.urls)

  useEffect(() => {
    const next = { document, urls }
    if (incomingKey === shownKey) {
      setShown((current) =>
        current.document === document && current.urls === urls ? current : next,
      )
      return
    }

    let cancelled = false
    const apply = () => {
      if (!cancelled) setShown(next)
    }
    const urlsToLoad = needed(document, urls)
    if (urlsToLoad.length === 0) {
      apply()
      return
    }
    const loaded = Promise.all(urlsToLoad.map(preloadCanvasImage))
    const timeout = new Promise((resolve) => setTimeout(resolve, 4000))
    void Promise.race([loaded, timeout]).then(apply)
    return () => {
      cancelled = true
    }
  }, [incomingKey, shownKey, document, urls])

  return shown
}
