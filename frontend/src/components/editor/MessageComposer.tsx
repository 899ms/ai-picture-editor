import { useState } from 'react'

export default function MessageComposer({
  pending,
  error,
  onSend,
}: {
  pending: boolean
  error?: string | null
  onSend: (text: string) => void
}) {
  const [text, setText] = useState('')
  const canSend = text.trim().length > 0 && !pending

  const submit = () => {
    if (!canSend) return
    onSend(text.trim())
    setText('')
  }

  return (
    <div className="border-line shrink-0 border-t p-3">
      <textarea
        rows={2}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault()
            submit()
          }
        }}
        placeholder="说明要怎么改，例如：去背景、水平翻转。回车发送"
        aria-label="修图指令"
        className="border-line text-ink placeholder:text-faint rounded-control focus:border-line-strong w-full resize-none border px-3 py-2 text-xs leading-relaxed outline-none transition-colors"
      />
      <button
        type="button"
        onClick={submit}
        disabled={!canSend}
        className="bg-ink hover:bg-dark rounded-control mt-2 w-full py-2 text-xs font-medium text-white transition-all duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100"
      >
        {pending ? '思考中…' : '发送'}
      </button>
      {error && <p className="text-danger mt-2 text-[11px] leading-relaxed">{error}</p>}
    </div>
  )
}
