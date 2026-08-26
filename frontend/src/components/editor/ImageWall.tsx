import type { Asset, AssetKind } from '@/api/assets'

const KIND_LABELS: Record<AssetKind, string> = {
  original: '原图',
  generated: '生成',
  subject: '主体',
  background: '背景',
  mask: '遮罩',
  marketing: '营销',
  export: '导出',
}

/** 会话内全部图片，含未采用的候选。点击切换画布当前图，不覆盖任何已有结果。 */
export default function ImageWall({
  assets,
  currentId,
  disabled,
  onPick,
}: {
  assets: Asset[]
  currentId: string
  disabled: boolean
  onPick: (assetId: string) => void
}) {
  return (
    <div className="border-line bg-paper shrink-0 border-t">
      <div className="flex items-center gap-2 overflow-x-auto px-4 py-3">
        {assets.map((asset) => {
          const active = asset.id === currentId
          return (
            <button
              key={asset.id}
              type="button"
              disabled={disabled || active}
              onClick={() => onPick(asset.id)}
              title={`${KIND_LABELS[asset.kind]} · ${asset.width} × ${asset.height}`}
              className={`bg-canvas relative size-16 shrink-0 overflow-hidden rounded-[10px] border-2 transition-colors disabled:cursor-default ${
                active ? 'border-brand' : 'border-line hover:border-line-strong'
              }`}
            >
              <img src={asset.url} alt="" loading="lazy" className="size-full object-contain" />
              <span className="bg-ink/70 absolute right-0 bottom-0 left-0 py-0.5 text-[10px] text-white">
                {KIND_LABELS[asset.kind]}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
