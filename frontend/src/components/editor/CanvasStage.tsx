import { useEffect, useMemo, useRef, useState } from 'react'
import type Konva from 'konva'
import {
  Circle,
  Group,
  Image as KonvaImage,
  Layer as KonvaLayer,
  Line,
  Rect,
  Stage,
  Text,
  Transformer,
} from 'react-konva'

import type { Layer, LayerDocument } from '@/api/sessions'
import { SelectionOverlay } from '@/components/editor/SelectionOverlay'
import { useSelectStroke } from '@/hooks/useSelectStroke'
import { useCanvasImage } from '@/hooks/useCanvasImage'
import { useElementSize } from '@/hooks/useElementSize'
import { makeAdjustFilter, toAdjustPreview, type AdjustPreview } from '@/lib/adjustPreview'
import { useCanvasView } from '@/stores/canvasView'
import { useEditorUi, type CanvasSelection, type CropRect, type LayerPreview } from '@/stores/editorUi'

const NO_FILTERS: ((imageData: ImageData) => void)[] = []
// 预览按屏幕分辨率量级缓存，滤镜每帧重算才跟得上滑杆
const PREVIEW_PIXEL_RATIO = 0.6

export default function CanvasStage({
  document,
  previous,
  urls,
  selection = null,
  onPoint,
  onStroke,
  onMove,
}: {
  document: LayerDocument
  previous: LayerDocument | null
  urls: Map<string, string>
  selection?: CanvasSelection | null
  onPoint?: (x: number, y: number) => void
  onStroke?: (points: { x: number; y: number }[]) => void
  onMove?: (layerId: string, x: number, y: number) => void
}) {
  const [containerRef, size] = useElementSize<HTMLDivElement>()
  const scale = useCanvasView((state) => state.scale)
  const x = useCanvasView((state) => state.x)
  const y = useCanvasView((state) => state.y)
  const setViewport = useCanvasView((state) => state.setViewport)
  const fit = useCanvasView((state) => state.fit)
  const zoomByWheel = useCanvasView((state) => state.zoomByWheel)
  const panBy = useCanvasView((state) => state.panBy)
  const pan = useCanvasView((state) => state.pan)

  const cropOpen = useEditorUi((state) => state.cropOpen)
  const cropRect = useEditorUi((state) => state.cropRect)
  const cropRatio = useEditorUi((state) => state.cropRatio)
  const setCropRect = useEditorUi((state) => state.setCropRect)
  const compareOpen = useEditorUi((state) => state.compareOpen)
  const compareAt = useEditorUi((state) => state.compareAt)
  const setCompareAt = useEditorUi((state) => state.setCompareAt)
  const adjustPreview = useEditorUi((state) => state.adjustPreview)
  const layerPreview = useEditorUi((state) => state.layerPreview)
  const selectMode = useEditorUi((state) => state.selectMode)
  const selectedLayerId = useEditorUi((state) => state.selectedLayerId)
  const selectLayer = useEditorUi((state) => state.selectLayer)
  const stroke = useSelectStroke()

  const fitted = useRef('')
  const [holdingStage, setHoldingStage] = useState(false)
  const selecting = Boolean(selectMode)
  const interactive = !selecting && !cropOpen && !compareOpen
  const stageDraggable = !cropOpen && !selecting && !holdingStage

  const canvasPoint = (stage: Konva.Stage | null) => {
    const pointer = stage?.getRelativePointerPosition()
    if (!pointer) return null
    const x = pointer.x / document.width
    const y = pointer.y / document.height
    if (x < 0 || y < 0 || x > 1 || y > 1) return null
    return { x, y }
  }

  useEffect(() => {
    setViewport(size)
  }, [size, setViewport])

  useEffect(() => {
    if (!size.width || !size.height) return
    const shape = `${document.width}x${document.height}`
    if (fitted.current === shape) return
    // 首次落位不做动画，之后画布尺寸变化时平滑归位
    fit(document, { animate: fitted.current !== '' })
    fitted.current = shape
  }, [size.width, size.height, document, fit])

  const split = document.width * compareAt
  const color = useMemo(() => toAdjustPreview(adjustPreview), [adjustPreview])
  const compareWith = compareOpen ? previous : null

  return (
    <div
      ref={containerRef}
      className={`bg-canvas relative h-full w-full overflow-hidden ${
        selecting ? 'cursor-crosshair' : cropOpen ? '' : 'cursor-grab active:cursor-grabbing'
      }`}
    >
      <Stage
        width={size.width}
        height={size.height}
        x={x}
        y={y}
        scaleX={scale}
        scaleY={scale}
        draggable={stageDraggable}
        onMouseDown={(event) => {
          if (selectMode !== 'brush') return
          const point = canvasPoint(event.target.getStage())
          if (point) stroke.start(point)
        }}
        onMouseMove={(event) => {
          if (selectMode !== 'brush') return
          const point = canvasPoint(event.target.getStage())
          if (point) stroke.move(point)
        }}
        onMouseUp={() => {
          if (selectMode !== 'brush') return
          const points = stroke.end()
          if (points.length) onStroke?.(points)
        }}
        onClick={(event) => {
          if (selectMode !== 'point') return
          const point = canvasPoint(event.target.getStage())
          if (point) onPoint?.(point.x, point.y)
        }}
        onDragMove={(event) => {
          if (event.target !== event.target.getStage()) return
          pan({ x: event.target.x(), y: event.target.y() })
        }}
        onDblClick={() => {
          if (!selecting) fit(document)
        }}
        onWheel={(event) => {
          event.evt.preventDefault()
          // 捏合与 ⌘ 滚动缩放，普通滚动平移，与主流画布一致
          if (event.evt.ctrlKey || event.evt.metaKey) {
            const pointer = event.target.getStage()?.getPointerPosition()
            zoomByWheel(event.evt.deltaY, pointer ?? undefined)
            return
          }
          panBy(-event.evt.deltaX, -event.evt.deltaY)
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

        {compareWith ? (
          <>
            <DocumentLayer
              document={compareWith}
              urls={urls}
              clip={{ x: 0, y: 0, width: split, height: document.height }}
            />
            <DocumentLayer
              document={document}
              urls={urls}
              color={color}
              layerPreview={layerPreview}
              clip={{
                x: split,
                y: 0,
                width: document.width - split,
                height: document.height,
              }}
            />
          </>
        ) : (
          <DocumentLayer
            document={document}
            urls={urls}
            color={color}
            layerPreview={layerPreview}
            interactive={interactive}
            stageDraggable={stageDraggable}
            selectedId={selectedLayerId}
            onSelect={selectLayer}
            onMove={onMove}
            onHoldStage={setHoldingStage}
          />
        )}

        {compareWith && (
          <CompareDivider canvas={document} split={split} scale={scale} onChange={setCompareAt} />
        )}

        {cropOpen && cropRect && (
          <CropLayer
            canvas={document}
            rect={cropRect}
            scale={scale}
            keepRatio={cropRatio !== 'free'}
            onChange={setCropRect}
          />
        )}

        {(selection || stroke.draft.length > 0) && (
          <SelectionOverlay
            document={document}
            selection={selection}
            scale={scale}
            draft={stroke.draft}
          />
        )}
      </Stage>
    </div>
  )
}

function DocumentLayer({
  document,
  urls,
  color,
  layerPreview,
  clip,
  interactive = false,
  stageDraggable = false,
  selectedId = null,
  onSelect,
  onMove,
  onHoldStage,
}: {
  document: LayerDocument
  urls: Map<string, string>
  color?: AdjustPreview | null
  layerPreview?: LayerPreview | null
  clip?: { x: number; y: number; width: number; height: number }
  interactive?: boolean
  stageDraggable?: boolean
  selectedId?: string | null
  onSelect?: (id: string) => void
  onMove?: (layerId: string, x: number, y: number) => void
  onHoldStage?: (held: boolean) => void
}) {
  const layers = document.layers.filter((layer) => layer.visible)
  return (
    <KonvaLayer
      listening={interactive}
      clipX={clip?.x ?? 0}
      clipY={clip?.y ?? 0}
      clipWidth={clip?.width ?? document.width}
      clipHeight={clip?.height ?? document.height}
    >
      {layers.map((layer) =>
        layer.kind === 'text' ? (
          <TextLayer
            key={layer.id}
            layer={layer}
            preview={layerPreview?.id === layer.id ? layerPreview : null}
            interactive={interactive}
            stageDraggable={stageDraggable}
            selected={selectedId === layer.id}
            onSelect={onSelect}
            onMove={onMove}
            onHoldStage={onHoldStage}
          />
        ) : layer.kind === 'image' ? (
          <ImageLayer
            key={layer.id}
            layer={layer}
            url={layer.asset_id ? urls.get(layer.asset_id) : undefined}
            color={color ?? null}
            preview={layerPreview?.id === layer.id ? layerPreview : null}
            interactive={interactive}
            stageDraggable={stageDraggable}
            selected={selectedId === layer.id}
            onSelect={onSelect}
            onMove={onMove}
            onHoldStage={onHoldStage}
          />
        ) : null,
      )}
    </KonvaLayer>
  )
}

function TextLayer({
  layer,
  preview,
  interactive = false,
  stageDraggable = false,
  selected = false,
  onSelect,
  onMove,
  onHoldStage,
}: {
  layer: Layer
  preview: LayerPreview | null
  interactive?: boolean
  stageDraggable?: boolean
  selected?: boolean
  onSelect?: (id: string) => void
  onMove?: (layerId: string, x: number, y: number) => void
  onHoldStage?: (held: boolean) => void
}) {
  const drag = useLayerDrag(layer, interactive, stageDraggable, onSelect, onMove, onHoldStage)
  const { transform } = layer
  const point = layerPoint(layer, preview, drag.drop)

  return (
    <Text
      text={layer.text || layer.name}
      x={point.x}
      y={point.y}
      offsetX={layer.width / 2}
      offsetY={layer.height / 2}
      width={layer.width}
      height={layer.height}
      fontSize={layer.font_size ?? Math.max(12, layer.height * 0.72)}
      fill={layer.fill ?? '#141414'}
      align="center"
      verticalAlign="middle"
      scaleX={preview?.scale ?? transform.scale_x}
      scaleY={preview?.scale ?? transform.scale_y}
      rotation={preview?.rotation ?? transform.rotation}
      opacity={preview?.opacity ?? layer.opacity}
      {...drag.handlers}
      stroke={selected && interactive ? '#5f98ad' : undefined}
      strokeWidth={selected && interactive ? 2 : 0}
      strokeScaleEnabled={false}
    />
  )
}

function ImageLayer({
  layer,
  url,
  color,
  preview,
  interactive = false,
  stageDraggable = false,
  selected = false,
  onSelect,
  onMove,
  onHoldStage,
}: {
  layer: Layer
  url: string | undefined
  color: AdjustPreview | null
  preview: LayerPreview | null
  interactive?: boolean
  stageDraggable?: boolean
  selected?: boolean
  onSelect?: (id: string) => void
  onMove?: (layerId: string, x: number, y: number) => void
  onHoldStage?: (held: boolean) => void
}) {
  const image = useCanvasImage(url)
  const ref = useRef<Konva.Image>(null)
  const drag = useLayerDrag(layer, interactive, stageDraggable, onSelect, onMove, onHoldStage)
  const filtered = color !== null && image?.safe === true
  // 数值不变时保持数组同一引用，平移缩放才不会白白重算滤镜
  const filters = useMemo(
    () => (filtered && color ? [makeAdjustFilter(color)] : NO_FILTERS),
    [filtered, color],
  )

  // 滤镜要求节点先缓存；缓存后的位图同时让缩放平移更省算力
  useEffect(() => {
    const node = ref.current
    if (!node || !image) return
    if (filtered) node.cache({ pixelRatio: PREVIEW_PIXEL_RATIO })
    else node.clearCache()
  }, [image, filtered, layer.width, layer.height])

  if (!image) return null

  const { transform } = layer
  const scale = preview?.scale
  const direction = {
    x: Math.sign(transform.scale_x) || 1,
    y: Math.sign(transform.scale_y) || 1,
  }
  const point = layerPoint(layer, preview, drag.drop)

  return (
    <KonvaImage
      ref={ref}
      image={image.element}
      x={point.x}
      y={point.y}
      offsetX={layer.width / 2}
      offsetY={layer.height / 2}
      width={layer.width}
      height={layer.height}
      scaleX={scale === undefined ? transform.scale_x : direction.x * scale}
      scaleY={scale === undefined ? transform.scale_y : direction.y * scale}
      rotation={preview?.rotation ?? transform.rotation}
      opacity={preview?.opacity ?? layer.opacity}
      filters={filters}
      {...drag.handlers}
      stroke={selected && interactive ? '#5f98ad' : undefined}
      strokeWidth={selected && interactive ? 2 : 0}
      strokeScaleEnabled={false}
    />
  )
}

type Drop = { x: number; y: number }

function layerPoint(layer: Layer, preview: LayerPreview | null, drop: Drop | null) {
  return {
    x: (drop?.x ?? preview?.x ?? layer.transform.x) + layer.width / 2,
    y: (drop?.y ?? preview?.y ?? layer.transform.y) + layer.height / 2,
  }
}

function useLayerDrag(
  layer: Layer,
  interactive: boolean,
  stageDraggable: boolean,
  onSelect?: (id: string) => void,
  onMove?: (layerId: string, x: number, y: number) => void,
  onHoldStage?: (held: boolean) => void,
) {
  const [drop, setDrop] = useState<Drop | null>(null)
  const dragged = useRef(false)
  const movable = interactive && !layer.locked

  useEffect(() => {
    if (!drop) return
    if (Math.abs(layer.transform.x - drop.x) < 0.5 && Math.abs(layer.transform.y - drop.y) < 0.5) {
      setDrop(null)
    }
  }, [layer.transform.x, layer.transform.y, drop])

  const restoreStage = (node: Konva.Node) => {
    node.getStage()?.draggable(stageDraggable)
  }

  const pick = () => {
    if (dragged.current) {
      dragged.current = false
      return
    }
    onSelect?.(layer.id)
  }

  return {
    drop,
    handlers: {
      listening: interactive,
      draggable: movable,
      dragDistance: 2,
      onMouseDown: (event: Konva.KonvaEventObject<MouseEvent>) => {
        event.cancelBubble = true
        if (movable) event.target.getStage()?.draggable(false)
      },
      onMouseUp: (event: Konva.KonvaEventObject<MouseEvent>) => {
        if (!dragged.current) restoreStage(event.target)
      },
      onMouseEnter: (event: Konva.KonvaEventObject<MouseEvent>) => {
        const container = event.target.getStage()?.container()
        if (container && movable) container.style.cursor = 'move'
      },
      onMouseLeave: (event: Konva.KonvaEventObject<MouseEvent>) => {
        const container = event.target.getStage()?.container()
        if (container) container.style.cursor = ''
      },
      onClick: pick,
      onTap: pick,
      onDragStart: (event: Konva.KonvaEventObject<DragEvent>) => {
        event.cancelBubble = true
        dragged.current = true
        event.target.getStage()?.draggable(false)
        onHoldStage?.(true)
      },
      onDragMove: (event: Konva.KonvaEventObject<DragEvent>) => {
        event.cancelBubble = true
      },
      onDragEnd: (event: Konva.KonvaEventObject<DragEvent>) => {
        event.cancelBubble = true
        restoreStage(event.target)
        onHoldStage?.(false)
        const next = {
          x: event.target.x() - layer.width / 2,
          y: event.target.y() - layer.height / 2,
        }
        onSelect?.(layer.id)
        if (Math.abs(next.x - layer.transform.x) < 0.5 && Math.abs(next.y - layer.transform.y) < 0.5) {
          return
        }
        setDrop(next)
        onMove?.(layer.id, next.x, next.y)
      },
    },
  }
}

/** 对比分割线随画布一起缩放平移，手柄与线宽保持屏幕尺寸不变。 */
function CompareDivider({
  canvas,
  split,
  scale,
  onChange,
}: {
  canvas: LayerDocument
  split: number
  scale: number
  onChange: (value: number) => void
}) {
  const cursor = (node: Konva.Node, shape: string) => {
    const container = node.getStage()?.container()
    if (container) container.style.cursor = shape
  }

  return (
    <KonvaLayer>
      <Line
        points={[split, 0, split, canvas.height]}
        stroke="#ffffff"
        strokeWidth={2}
        strokeScaleEnabled={false}
        shadowColor="#141a14"
        shadowBlur={8}
        shadowOpacity={0.45}
        listening={false}
      />
      <Group
        x={split}
        y={canvas.height / 2}
        scaleX={1 / scale}
        scaleY={1 / scale}
        draggable
        onMouseEnter={(event) => cursor(event.target, 'ew-resize')}
        onMouseLeave={(event) => cursor(event.target, '')}
        onDragMove={(event) => {
          const node = event.target
          // 直接用画布坐标系下的指针位置，手柄自身的反向缩放不参与换算
          const pointer = node.getStage()?.getRelativePointerPosition()
          if (!pointer) return
          const next = Math.min(canvas.width, Math.max(0, pointer.x))
          node.position({ x: next, y: canvas.height / 2 })
          onChange(next / canvas.width)
        }}
      >
        <Circle
          radius={15}
          fill="#ffffff"
          shadowColor="#141a14"
          shadowBlur={10}
          shadowOpacity={0.3}
        />
        <Line points={[-7, -4, -11, 0, -7, 4]} stroke="#6f746f" strokeWidth={1.6} lineCap="round" />
        <Line points={[7, -4, 11, 0, 7, 4]} stroke="#6f746f" strokeWidth={1.6} lineCap="round" />
      </Group>
    </KonvaLayer>
  )
}

function CropLayer({
  canvas,
  rect,
  scale,
  keepRatio,
  onChange,
}: {
  canvas: LayerDocument
  rect: CropRect
  scale: number
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

  // 夹取后的值可能与上一帧相同，此时不会触发重渲染，得手动把节点摆回边界内
  const commit = (next: CropRect) => {
    const clamped = clampRect(next, canvas)
    onChange(clamped)
    return clamped
  }

  // 手柄与描边按倍率反向补偿，缩放后依然是同样的点按面积
  const invert = 1 / scale
  const shade = 'rgba(20,26,20,0.45)'

  return (
    <KonvaLayer>
      <Group listening={false}>
        <Rect width={canvas.width} height={rect.y} fill={shade} />
        <Rect
          y={rect.y + rect.height}
          width={canvas.width}
          height={Math.max(0, canvas.height - rect.y - rect.height)}
          fill={shade}
        />
        <Rect y={rect.y} width={rect.x} height={rect.height} fill={shade} />
        <Rect
          x={rect.x + rect.width}
          y={rect.y}
          width={Math.max(0, canvas.width - rect.x - rect.width)}
          height={rect.height}
          fill={shade}
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
        strokeScaleEnabled={false}
        dash={[7 * invert, 5 * invert]}
        draggable
        onDragMove={(event) => {
          const next = commit({
            ...rect,
            x: event.target.x(),
            y: event.target.y(),
          })
          event.target.position({ x: next.x, y: next.y })
        }}
        onTransform={() => {
          const node = rectRef.current
          if (!node) return
          const next = commit({
            x: node.x(),
            y: node.y(),
            width: Math.max(32, node.width() * node.scaleX()),
            height: Math.max(32, node.height() * node.scaleY()),
          })
          node.setAttrs({ ...next, scaleX: 1, scaleY: 1 })
        }}
      />
      <Transformer
        ref={transformerRef}
        rotateEnabled={false}
        flipEnabled={false}
        keepRatio={keepRatio}
        ignoreStroke
        anchorSize={10 * invert}
        anchorCornerRadius={3 * invert}
        anchorStrokeWidth={1.5 * invert}
        borderStrokeWidth={invert}
        anchorStroke="#427f95"
        borderStroke="#5f98ad"
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
