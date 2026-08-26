import { useState } from 'react'

import type { Asset } from '@/api/assets'
import { ACTION_LABELS, type Layer, type SessionDetail } from '@/api/sessions'
import { useSessionHistory, type SessionTools } from '@/hooks/useSessions'
import { formatBytes, formatDateTime } from '@/lib/format'
import { useEditorUi } from '@/stores/editorUi'

const ADJUST_FIELDS: { key: string; label: string; min?: number }[] = [
  { key: 'brightness', label: '亮度' },
  { key: 'contrast', label: '对比度' },
  { key: 'highlights', label: '高光' },
  { key: 'shadows', label: '阴影' },
  { key: 'temperature', label: '色温' },
  { key: 'tint', label: '色调' },
  { key: 'saturation', label: '饱和度' },
  { key: 'vibrance', label: '自然饱和度' },
  { key: 'sharpness', label: '锐化' },
  { key: 'clarity', label: '清晰度' },
  { key: 'vignette', label: '晕影', min: 0 },
]

export default function LayerPanel({
  session,
  tools,
}: {
  session: SessionDetail
  tools: SessionTools
}) {
  const current = session.assets.find((asset) => asset.id === session.current_asset_id)
  const { data: history = [] } = useSessionHistory(session.id)
  const { selectedLayerId, selectLayer, panel } = useEditorUi()
  const selected =
    session.document.layers.find((layer) => layer.id === selectedLayerId) ??
    session.document.layers.at(-1)

  return (
    <aside className="border-line bg-paper w-72 shrink-0 overflow-y-auto border-l">
      {panel === 'adjust' && (
        <AdjustForm
          disabled={tools.busy}
          onApply={(params) => tools.invoke('adjust_image', params)}
        />
      )}

      <Section title="图层">
        <ul className="space-y-1">
          {[...session.document.layers].reverse().map((layer) => (
            <LayerRow
              key={layer.id}
              layer={layer}
              active={selected?.id === layer.id}
              onSelect={() => selectLayer(layer.id)}
            />
          ))}
        </ul>
      </Section>

      {selected && (
        <Section title="变换">
          <LayerControls
            layer={selected}
            disabled={tools.busy}
            onOpacity={(opacity) =>
              tools.invoke('set_layer_opacity', { layer_id: selected.id, opacity })
            }
            onScale={(scale) =>
              tools.invoke('scale_layer', { layer_id: selected.id, scale_x: scale, scale_y: scale })
            }
            onRotate={(rotation) =>
              tools.invoke('rotate_layer', { layer_id: selected.id, rotation })
            }
            onReorder={(place) => tools.invoke('reorder_layer', { layer_id: selected.id, place })}
          />
        </Section>
      )}

      <Section title="属性">
        <Properties document={session.document} current={current} revision={session.revision} />
      </Section>

      <Section title="编辑记录">
        {history.length === 0 ? (
          <p className="text-faint text-xs">暂无记录</p>
        ) : (
          <ol className="space-y-1.5">
            {history.map((entry) => (
              <li key={entry.seq} className="flex items-baseline justify-between gap-2 text-xs">
                <span className="text-ink">{ACTION_LABELS[entry.action] ?? entry.action}</span>
                <span className="text-faint shrink-0 tabular-nums">
                  {formatDateTime(entry.created_at)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Section>
    </aside>
  )
}

function LayerRow({
  layer,
  active,
  onSelect,
}: {
  layer: Layer
  active: boolean
  onSelect: () => void
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={`rounded-control flex w-full items-center gap-2 border px-2.5 py-2 text-left ${
          active ? 'border-brand bg-brand-soft' : 'border-line'
        }`}
      >
        <span className="text-ink min-w-0 flex-1 truncate text-xs font-medium">{layer.name}</span>
        <span className="text-faint shrink-0 text-[10px] tabular-nums">
          {Math.round(layer.opacity * 100)}%
        </span>
      </button>
    </li>
  )
}

function LayerControls({
  layer,
  disabled,
  onOpacity,
  onScale,
  onRotate,
  onReorder,
}: {
  layer: Layer
  disabled: boolean
  onOpacity: (value: number) => void
  onScale: (value: number) => void
  onRotate: (value: number) => void
  onReorder: (place: 'top' | 'bottom' | 'up' | 'down') => void
}) {
  const scale = Math.abs(layer.transform.scale_x)

  return (
    <div className="space-y-3">
      <SliderField
        label="透明度"
        value={layer.opacity}
        min={0}
        max={1}
        step={0.01}
            format={(value) => `${Math.round(value * 100)}%`}
            disabled={disabled}
            onCommit={onOpacity}
          />
          <SliderField
            label="图层缩放"
            value={scale}
            min={0.1}
            max={3}
            step={0.05}
            format={(value) => `${Math.round(value * 100)}%`}
            disabled={disabled}
            onCommit={onScale}
          />
          <SliderField
            label="旋转"
            value={layer.transform.rotation}
            min={-180}
            max={180}
            step={1}
            format={(value) => `${Math.round(value)}°`}
            disabled={disabled}
            onCommit={onRotate}
          />
      <div className="grid grid-cols-4 gap-1">
        {(['top', 'up', 'down', 'bottom'] as const).map((place) => (
          <button
            key={place}
            type="button"
            disabled={disabled}
            onClick={() => onReorder(place)}
            className="border-line text-muted hover:text-ink rounded-control border py-1 text-[10px] disabled:opacity-40"
          >
            {{ top: '置顶', up: '上移', down: '下移', bottom: '置底' }[place]}
          </button>
        ))}
      </div>
    </div>
  )
}

function AdjustForm({
  disabled,
  onApply,
}: {
  disabled: boolean
  onApply: (params: Record<string, number>) => void
}) {
  const [values, setValues] = useState<Record<string, number>>({})

  return (
    <Section title="调色">
      <div className="space-y-2.5">
        {ADJUST_FIELDS.map((field) => (
          <SliderField
            key={field.key}
            label={field.label}
            value={values[field.key] ?? 0}
            min={field.min ?? -1}
            max={1}
            step={0.05}
            format={(value) => value.toFixed(2)}
            disabled={disabled}
            onCommit={(value) => setValues((current) => ({ ...current, [field.key]: value }))}
          />
        ))}
        <div className="flex gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => setValues({})}
            className="border-line text-muted hover:text-ink rounded-control flex-1 border py-1.5 text-xs"
          >
            重置
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              onApply(values)
              setValues({})
            }}
            className="bg-ink rounded-control flex-1 py-1.5 text-xs font-medium text-white disabled:opacity-40"
          >
            应用
          </button>
        </div>
      </div>
    </Section>
  )
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  format,
  disabled,
  onCommit,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  format: (value: number) => string
  disabled: boolean
  onCommit: (value: number) => void
}) {
  const [draft, setDraft] = useState<number | null>(null)

  return (
    <label className="block">
      <span className="mb-1 flex justify-between text-[11px]">
        <span className="text-muted">{label}</span>
        <span className="text-ink tabular-nums">{format(draft ?? value)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        value={draft ?? value}
        onChange={(event) => setDraft(Number(event.target.value))}
        onPointerUp={() => {
          if (draft !== null && draft !== value) onCommit(draft)
          setDraft(null)
        }}
        className="accent-brand w-full"
      />
    </label>
  )
}

function Properties({
  document,
  current,
  revision,
}: {
  document: { width: number; height: number }
  current: Asset | undefined
  revision: number
}) {
  const rows: [string, string][] = [
    ['画布', `${document.width} × ${document.height}`],
    ['修订号', String(revision)],
  ]
  if (current) {
    rows.push(['格式', current.image_format])
    rows.push(['大小', formatBytes(current.size_bytes)])
    rows.push(['透明通道', current.has_alpha ? '有' : '无'])
  }

  return (
    <dl className="space-y-1.5 text-xs">
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-2">
          <dt className="text-muted">{label}</dt>
          <dd className="text-ink tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-line border-b px-4 py-4 last:border-b-0">
      <h2 className="text-muted mb-2.5 text-xs font-medium">{title}</h2>
      {children}
    </section>
  )
}
