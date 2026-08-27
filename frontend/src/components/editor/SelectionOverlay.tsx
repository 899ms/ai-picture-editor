import { Circle, Group, Image as KonvaImage, Layer as KonvaLayer, Line, Text } from 'react-konva'

import type { LayerDocument } from '@/api/sessions'
import { useCanvasImage } from '@/hooks/useCanvasImage'
import type { CanvasSelection } from '@/stores/editorUi'

export function SelectionOverlay({
  document,
  selection,
  scale,
  draft,
}: {
  document: LayerDocument
  selection: CanvasSelection | null
  scale: number
  draft: { x: number; y: number }[]
}) {
  const mask = useCanvasImage(selection?.maskUrl)

  return (
    <KonvaLayer listening={false}>
      {mask && (
        <KonvaImage
          image={mask.element}
          width={document.width}
          height={document.height}
          opacity={0.45}
          listening={false}
        />
      )}
      {draft.length > 1 && (
        <Line
          points={draft.flatMap((point) => [point.x * document.width, point.y * document.height])}
          stroke="#5f98ad"
          strokeWidth={18}
          lineCap="round"
          lineJoin="round"
          opacity={0.45}
          listening={false}
        />
      )}
      {(selection?.markers ?? []).map((marker) => (
        <MarkerBadge
          key={marker.index}
          x={marker.x * document.width}
          y={marker.y * document.height}
          index={marker.index}
          scale={scale}
        />
      ))}
    </KonvaLayer>
  )
}

function MarkerBadge({
  x,
  y,
  index,
  scale,
}: {
  x: number
  y: number
  index: number
  scale: number
}) {
  const invert = 1 / scale
  return (
    <Group x={x} y={y} scaleX={invert} scaleY={invert} listening={false}>
      <Circle radius={11} fill="#5f98ad" shadowColor="#141a14" shadowBlur={8} shadowOpacity={0.35} />
      <Text
        text={String(index)}
        width={22}
        height={22}
        offsetX={11}
        offsetY={11}
        align="center"
        verticalAlign="middle"
        fontSize={11}
        fontStyle="600"
        fill="#ffffff"
      />
    </Group>
  )
}

