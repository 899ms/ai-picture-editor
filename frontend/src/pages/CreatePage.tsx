import { useNavigate } from 'react-router-dom'

import AssetCard from '@/components/AssetCard'
import GenerateForm from '@/components/GenerateForm'
import ImageDropzone from '@/components/ImageDropzone'
import { errorMessage } from '@/hooks/useAuth'
import { useAssets, useUploadAsset } from '@/hooks/useAssets'
import { useGenerate } from '@/hooks/useRun'
import { readPromptDraft, savePromptDraft } from '@/lib/promptDraft'

export default function CreatePage() {
  const navigate = useNavigate()
  const { data: assets = [], isPending } = useAssets()
  const upload = useUploadAsset()
  const generate = useGenerate()

  return (
    <div className="mx-auto max-w-4xl px-8 py-10">
      <h1 className="text-ink mb-6 text-2xl font-semibold tracking-tight">创作</h1>

      <GenerateForm
        defaultPrompt={readPromptDraft()}
        pending={generate.isPending}
        onSubmit={(input) =>
          generate.mutate(input, {
            onSuccess: (run) => {
              savePromptDraft('')
              navigate(`/candidates/${run.id}`)
            },
          })
        }
      />
      {generate.isError && (
        <p className="text-danger mt-2 text-sm">{errorMessage(generate.error)}</p>
      )}

      <section className="mt-10">
        <h2 className="text-muted mb-3 text-sm font-medium">上传已有图片</h2>
        <ImageDropzone onFile={(file) => upload.mutate(file)} disabled={upload.isPending} />
        {upload.isError && (
          <p className="text-danger mt-2 text-sm">{errorMessage(upload.error)}</p>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-muted mb-3 text-sm font-medium">历史素材</h2>

        {isPending ? (
          <p className="text-faint text-sm">加载中…</p>
        ) : assets.length === 0 ? (
          <p className="text-faint text-sm">还没有素材，先描述画面或上传一张图片。</p>
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
