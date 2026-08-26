import { useToasts } from '@/stores/toasts'

export default function ToastHost() {
  const items = useToasts((state) => state.items)
  const dismiss = useToasts((state) => state.dismiss)

  if (items.length === 0) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex flex-col items-center gap-2">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => dismiss(item.id)}
          className={`shadow-control pointer-events-auto rounded-full px-3.5 py-1.5 text-xs font-medium ${
            item.leaving ? 'animate-fade-out' : 'animate-pop'
          } ${item.tone === 'danger' ? 'bg-danger text-white' : 'bg-ink text-white'}`}
        >
          {item.text}
        </button>
      ))}
    </div>
  )
}
