import { useState } from 'react'

import type { Ratio } from '@/api/runs'

const RATIOS: { value: Ratio; label: string }[] = [
  { value: '1:1', label: '1:1' },
  { value: '4:5', label: '4:5' },
  { value: '3:4', label: '3:4' },
  { value: '9:16', label: '9:16' },
  { value: '16:9', label: '16:9' },
]

export function BackgroundForm({
  disabled,
  onApply,
}: {
  disabled: boolean
  onApply: (params: { prompt: string; count: number }) => void
}) {
  const [prompt, setPrompt] = useState('')
  const [count, setCount] = useState(1)
  const ready = prompt.trim().length > 0

  return (
    <section className="border-line border-b px-4 py-4">
      <h2 className="text-muted mb-2.5 text-xs font-medium">换背景</h2>
      <p className="text-faint mb-2.5 text-[11px] leading-relaxed">
        写出新背景。一张直接上画布；多张进图片墙，点选采用。
      </p>
      <textarea
        rows={3}
        value={prompt}
        disabled={disabled}
        onChange={(event) => setPrompt(event.target.value)}
        placeholder="例如：浅木色桌面，晨光从左侧照入"
        className="border-line text-ink placeholder:text-faint rounded-control focus:border-line-strong w-full resize-none border px-3 py-2 text-xs leading-relaxed outline-none"
      />
      <div className="mt-2 flex gap-1">
        {[1, 2, 4].map((value) => (
          <button
            key={value}
            type="button"
            disabled={disabled}
            onClick={() => setCount(value)}
            className={`rounded-control flex-1 py-1.5 text-[11px] transition-all duration-150 ${
              count === value
                ? 'bg-ink text-white'
                : 'border-line text-muted hover:text-ink border'
            }`}
          >
            {value} 张
          </button>
        ))}
      </div>
      <button
        type="button"
        disabled={disabled || !ready}
        onClick={() => {
          onApply({ prompt: prompt.trim(), count })
          setPrompt('')
        }}
        className="bg-ink hover:bg-dark rounded-control mt-3 w-full py-1.5 text-xs font-medium text-white transition-all duration-150 active:scale-[0.98] disabled:opacity-40"
      >
        生成
      </button>
    </section>
  )
}

export function ExpandForm({
  disabled,
  onApply,
}: {
  disabled: boolean
  onApply: (params: { ratio: Ratio }) => void
}) {
  const [ratio, setRatio] = useState<Ratio>('16:9')

  return (
    <section className="border-line border-b px-4 py-4">
      <h2 className="text-muted mb-2.5 text-xs font-medium">扩图</h2>
      <p className="text-faint mb-2.5 text-[11px] leading-relaxed">
        扩展到目标比例，主体保留在画面中。
      </p>
      <div className="grid grid-cols-5 gap-1">
        {RATIOS.map((item) => (
          <button
            key={item.value}
            type="button"
            disabled={disabled}
            onClick={() => setRatio(item.value)}
            className={`rounded-control py-1.5 text-[11px] transition-all duration-150 ${
              ratio === item.value
                ? 'bg-ink text-white'
                : 'border-line text-muted hover:text-ink border'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onApply({ ratio })}
        className="bg-ink hover:bg-dark rounded-control mt-3 w-full py-1.5 text-xs font-medium text-white transition-all duration-150 active:scale-[0.98] disabled:opacity-40"
      >
        扩展
      </button>
    </section>
  )
}

export function ReplaceForm({
  disabled,
  onApply,
}: {
  disabled: boolean
  onApply: (params: { prompt: string }) => void
}) {
  const [prompt, setPrompt] = useState('')
  const ready = prompt.trim().length > 0

  return (
    <section className="border-line border-b px-4 py-4">
      <h2 className="text-muted mb-2.5 text-xs font-medium">局部替换</h2>
      <p className="text-faint mb-2.5 text-[11px] leading-relaxed">
        只改当前选区。选区外的画面会保持不动。
      </p>
      <textarea
        rows={3}
        value={prompt}
        disabled={disabled}
        onChange={(event) => setPrompt(event.target.value)}
        placeholder="例如：把杯子换成陶瓷马克杯"
        className="border-line text-ink placeholder:text-faint rounded-control focus:border-line-strong w-full resize-none border px-3 py-2 text-xs leading-relaxed outline-none"
      />
      <button
        type="button"
        disabled={disabled || !ready}
        onClick={() => {
          onApply({ prompt: prompt.trim() })
          setPrompt('')
        }}
        className="bg-ink hover:bg-dark rounded-control mt-3 w-full py-1.5 text-xs font-medium text-white transition-all duration-150 active:scale-[0.98] disabled:opacity-40"
      >
        替换
      </button>
    </section>
  )
}
