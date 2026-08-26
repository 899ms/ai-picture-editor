import AssetCard from '@/components/AssetCard'
import ImageDropzone from '@/components/ImageDropzone'
import { errorMessage } from '@/hooks/useAuth'
import { useAssets, useUploadAsset } from '@/hooks/useAssets'

export default function CreatePage() {
  const { data: assets = [], isPending } = useAssets()
  const upload = useUploadAsset()

  return (
    <div className="mx-auto max-w-4xl px-8 py-10">
      <h1 className="text-ink mb-6 text-2xl font-semibold tracking-tight">创作</h1>

      <ImageDropzone onFile={(file) => upload.mutate(file)} disabled={upload.isPending} />
      {upload.isError && <p className="text-danger mt-2 text-sm">{errorMessage(upload.error)}</p>}

      <section className="mt-10">
        <h2 className="text-muted mb-3 text-sm font-medium">历史素材</h2>

        {isPending ? (
          <p className="text-faint text-sm">加载中…</p>
        ) : assets.length === 0 ? (
          <p className="text-faint text-sm">还没有素材，上传一张图片开始。</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {assets.map((asset) => (
              <AssetCard key={asset.id} asset={asset} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
