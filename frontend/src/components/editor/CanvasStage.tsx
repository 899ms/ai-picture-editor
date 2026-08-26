import { useEffect, useRef } from 'react'
import type Konva from 'konva'
import { Group, Image as KonvaImage, Layer as KonvaLayer, Rect, Stage, Transformer } from 'react-konva'

import type { Layer, LayerDocument } from '@/api/sessions'
import { useCanvasImage } from '@/hooks/useCanvasImage'
import { useElementSize } from '@/hooks/useElementSize'
import { ZOOM_STEP, useCanvasView } from '@/stores/canvasView'
import { useEditorUi, type CropRect } from '@/stores/editorUi'

export default function CanvasStage({
  document,
  previous,
  urls,
}: {
  document: LayerDocument
  previous: LayerDocument | null
  urls: Map<string, string>
}) {
  const [containerRef, size] = useElementSize<HTMLDivElement>()
  const { scale, x, y, setViewport, fit, zoomBy, pan } = useCanvasView()
  const { cropOpen, cropRect, cropRatio, compareOpen, compareAt, setCropRect } = useEditorUi()
  const fitted = useRef('')

  useEffect(() => setViewport(size), [size, setViewport])

  useEffect(() => {
    const shape = `${size.width}x${size.height}:${document.width}x${document.height}`
    if (!size.width || !size.height || fitted.current === shape) return
    fitted.current = shape
    fit(document)
  }, [size, document, fit])

  const split = document.width * compareAt
  const interactive = !cropOpen && !compareOpen

  return (
    <div ref={containerRef} className="bg-canvas relative h-full w-full overflow-hidden">
      <Stage
        width={size.width}
        height={size.height}
        x={x}
        y={y}
        scaleX={scale}
        scaleY={scale}
        draggable={interactive}
        onDragMove={(event) => {
          if (event.target !== event.target.getStage()) return
          pan({ x: event.target.x(), y: event.target.y() })
        }}
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

        {compareOpen && previous ? (
          <>
            <DocumentLayer
              document={previous}
              urls={urls}
              clip={{ x: 0, y: 0, width: split, height: document.height }}
            />
            <DocumentLayer
              document={document}
              urls={urls}
              clip={{ x: split, y: 0, width: document.width - split, height: document.height }}
            />
          </>
        ) : (
          <DocumentLayer document={document} urls={urls} />
        )}

        {cropOpen && cropRect && (
          <CropLayer
            canvas={document}
            rect={cropRect}
            keepRatio={cropRatio !== 'free'}
            onChange={setCropRect}
          />
        )}
      </Stage>
    </div>
  )
}

function DocumentLayer({
  document,
  urls,
  clip,
}: {
  document: LayerDocument
  urls: Map<string, string>
  clip?: { x: number; y: number; width: number; height: number }
}) {
  const images = document.layers.filter((layer) => layer.visible && layer.kind === 'image')
  return (
    <KonvaLayer
      listening={false}
      clipX={clip?.x ?? 0}
      clipY={clip?.y ?? 0}
      clipWidth={clip?.width ?? document.width}
      clipHeight={clip?.height ?? document.height}
    >
      {images.map((layer) => (
        <ImageLayer
          key={layer.id}
          layer={layer}
          url={layer.asset_id ? urls.get(layer.asset_id) : undefined}
        />
      ))}
    </KonvaLayer>
  )
}

function ImageLayer({ layer, url }: { layer: Layer; url: string | undefined }) {
  const image = useCanvasImage(url)
  if (!image) return null

  return (
    <KonvaImage
      image={image}
      x={layer.transform.x + layer.width / 2}
      y={layer.transform.y + layer.height / 2}
      offsetX={layer.width / 2}
      offsetY={layer.height / 2}
      width={layer.width}
      height={layer.height}
      scaleX={layer.transform.scale_x}
      scaleY={layer.transform.scale_y}
      rotation={layer.transform.rotation}
      opacity={layer.opacity}
    />
  )
}

function CropLayer({
  canvas,
  rect,
  keepRatio,
  onChange,
}: {
  canvas: LayerDocument
  rect: CropRect
  keepRatio: boolean
  onChange: (rect: CropRect) => void
}) {
  const rectRef = useRef<Konva.Rect>(null)
  const transformerRef = useRef<Konva.Transformer>(null)

  useEffect(() => {
    const transformer = transformerRef.current
    const node = rectRef.current
    if (!transformer || !node) return
    transformer.nodes([node])
    transformer.getLayer()?.batchDraw()
  }, [rect])

  const commit = (next: CropRect) => onChange(clampRect(next, canvas))

  return (
    <KonvaLayer>
      <Group listening={false}>
        <Rect x={0} y={0} width={canvas.width} height={rect.y} fill="rgba(20,26,20,0.45)" />
        <Rect
          x={0}
          y={rect.y + rect.height}
          width={canvas.width}
          height={Math.max(0, canvas.height - rect.y - rect.height)}
          fill="rgba(20,26,20,0.45)"
        />
        <Rect x={0} y={rect.y} width={rect.x} height={rect.height} fill="rgba(20,26,20,0.45)" />
        <Rect
          x={rect.x + rect.width}
          y={rect.y}
          width={Math.max(0, canvas.width - rect.x - rect.width)}
          height={rect.height}
          fill="rgba(20,26,20,0.45)"
        />
      </Group>
      <Rect
        ref={rectRef}
        x={rect.x}
        y={rect.y}
        width={rect.width}
        height={rect.height}
        stroke="#5f98ad"
        strokeWidth={2}
        dash={[8, 4]}
        draggable
        onDragEnd={(event) =>
          commit({ ...rect, x: event.target.x(), y: event.target.y() })
        }
        onTransformEnd={() => {
          const node = rectRef.current
          if (!node) return
          const next = {
            x: node.x(),
            y: node.y(),
            width: Math.max(32, node.width() * node.scaleX()),
            height: Math.max(32, node.height() * node.scaleY()),
          }
          node.scaleX(1)
          node.scaleY(1)
          commit(next)
        }}
      />
      <Transformer
        ref={transformerRef}
        rotateEnabled={false}
        keepRatio={keepRatio}
        boundBoxFunc={(oldBox, newBox) =>
          newBox.width < 32 || newBox.height < 32 ? oldBox : newBox
        }
      />
    </KonvaLayer>
  )
}

function clampRect(rect: CropRect, canvas: LayerDocument): CropRect {
  const width = Math.min(rect.width, canvas.width)
  const height = Math.min(rect.height, canvas.height)
  return {
    width,
    height,
    x: Math.min(Math.max(0, rect.x), canvas.width - width),
    y: Math.min(Math.max(0, rect.y), canvas.height - height),
  }
}
