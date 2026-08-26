import { useEffect, useState } from 'react'

/** safe 表示位图可被读取像素，只有它为真时才能在画布上跑实时滤镜。 */
export type CanvasImage = { element: HTMLImageElement; safe: boolean }

/** 把 URL 解码为 Konva 可直接绘制的位图。换源时先留着上一张，避免画布闪白。 */
export function useCanvasImage(url: string | undefined) {
  const [image, setImage] = useState<CanvasImage | null>(null)

  useEffect(() => {
    if (!url) return

    let cancelled = false

    const load = (safe: boolean) => {
      const element = new Image()
      if (safe) element.crossOrigin = 'anonymous'
      element.onload = () => {
        if (!cancelled) setImage({ element, safe })
      }
      // 对象存储没放开跨域时退回普通加载：画面照常显示，只是不做实时滤镜预览
      element.onerror = () => {
        if (!cancelled && safe) load(false)
      }
      element.src = url
    }

    load(true)

    return () => {
      cancelled = true
    }
  }, [url])

  return image
}
