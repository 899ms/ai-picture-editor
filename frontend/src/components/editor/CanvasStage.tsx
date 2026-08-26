import { useEffect, useRef } from 'react'
import { Image as KonvaImage, Layer as KonvaLayer, Rect, Stage } from 'react-konva'

import type { Layer, LayerDocument } from '@/api/sessions'
import { useCanvasImage } from '@/hooks/useCanvasImage'
import { useElementSize } from '@/hooks/useElementSize'
import { ZOOM_STEP, useCanvasView } from '@/stores/canvasView'

export default function CanvasStage({
  document,
  urls,
}: {
  document: LayerDocument
  urls: Map<string, string>
}) {
  const [containerRef, size] = useElementSize<HTMLDivElement>()
  const { scale, x, y, setViewport, fit, zoomBy, pan } = useCanvasView()
  const fitted = useRef('')

  useEffect(() => setViewport(size), [size, setViewport])

  useEffect(() => {
    const shape = `${size.width}x${size.height}:${document.width}x${document.height}`
    // 只在画幅或视口真正变化时重新适应，否则会覆盖用户手动调整的倍率
    if (!size.width || !size.height || fitted.current === shape) return
    fitted.current = shape
    fit(document)
  }, [size, document, fit])

  const images = document.layers.filter((layer) => layer.visible && layer.kind === 'image')

  return (
    <div ref={containerRef} className="bg-canvas relative h-full w-full overflow-hidden">
      <Stage
        width={size.width}
        height={size.height}
        x={x}
        y={y}
        scaleX={scale}
        scaleY={scale}
        draggable
        onDragMove={(event) => pan({ x: event.target.x(), y: event.target.y() })}
        onWheel={(event) => {
          event.evt.preventDefault()
          const pointer = event.target.getStage()?.getPointerPosition()
          zoomBy(event.evt.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP, pointer ?? undefined)
        }}
      >
        <KonvaLayer listening={false}>
          <Rect
            width={document.width}
            height={document.height}
            fill="#ffffff"
            shadowColor="#141a14"
            shadowBlur={32}
            shadowOpacity={0.16}
          />
        </KonvaLayer>
        <KonvaLayer listening={false}>
          {images.map((layer) => (
            <ImageLayer
              key={layer.id}
              layer={layer}
              url={layer.asset_id ? urls.get(layer.asset_id) : undefined}
            />
          ))}
        </KonvaLayer>
      </Stage>
    </div>
  )
}

function ImageLayer({ layer, url }: { layer: Layer; url: string | undefined }) {
  const image = useCanvasImage(url)
  if (!image) return null

  return (
    <KonvaImage
      image={image}
      x={layer.transform.x}
      y={layer.transform.y}
      width={layer.width}
      height={layer.height}
      scaleX={layer.transform.scale_x}
      scaleY={layer.transform.scale_y}
      rotation={layer.transform.rotation}
      opacity={layer.opacity}
    />
  )
}
