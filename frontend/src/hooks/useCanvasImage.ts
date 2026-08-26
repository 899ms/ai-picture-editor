import { useEffect, useState } from 'react'

/** 把 URL 解码为 Konva 可直接绘制的位图。 */
export function useCanvasImage(url: string | undefined) {
  const [loaded, setLoaded] = useState<{
    url: string
    image: HTMLImageElement
  } | null>(null)

  useEffect(() => {
    if (!url) return

    const element = new Image()
    element.onload = () => setLoaded({ url, image: element })
    element.src = url
    // 卸载后到达的 onload 不应再更新已废弃的组件状态
    return () => {
      element.onload = null
    }
  }, [url])

  // URL 变更后先返回空，避免新图解码期间残留上一张
  return loaded && loaded.url === url ? loaded.image : null
}
