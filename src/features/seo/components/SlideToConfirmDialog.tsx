import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Trash2, X } from 'lucide-react'

// Irreversible-action confirmation: the user must drag the slider all the way to confirm,
// so a stray click can never trigger it. Releasing early snaps it back to 0.
export function SlideToConfirmDialog({ title, description, busy, onConfirm, onClose }: {
  title: string
  description: string
  busy: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  const [value, setValue] = useState(0)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  const release = () => {
    if (value >= 100) onConfirm()
    else setValue(0)
  }

  return createPortal(
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/50 p-4" onClick={() => { if (!busy) onClose() }}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="slide-confirm-title"
        aria-describedby="slide-confirm-desc"
        onClick={e => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-stroke bg-white p-5 shadow-2xl dark:border-strokedark dark:bg-boxdark"
      >
        <div className="flex items-start justify-between gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400">
            <Trash2 className="h-5 w-5" />
          </span>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close" className="rounded-md p-1 text-body hover:bg-gray-100 disabled:opacity-50 dark:text-bodydark dark:hover:bg-white/10">
            <X className="h-4 w-4" />
          </button>
        </div>
        <h2 id="slide-confirm-title" className="mt-3 text-base font-bold text-black dark:text-[#E2E5E9]">{title}</h2>
        <p id="slide-confirm-desc" className="mt-1 break-words text-sm text-body dark:text-bodydark">{description}</p>
        <p className="mt-2 text-xs font-semibold text-red-600 dark:text-red-400">This action is permanent and cannot be undone.</p>

        <div className="relative mt-5 h-11 select-none overflow-hidden rounded-full bg-red-50 dark:bg-red-500/10">
          <div className="absolute inset-y-0 left-0 bg-red-500/80" style={{ width: `${value}%` }} />
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs font-semibold text-red-700 dark:text-red-300">
            {busy ? 'Deleting…' : 'Slide to delete →'}
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={value}
            disabled={busy}
            aria-label="Slide to confirm deletion"
            onChange={e => setValue(Number(e.target.value))}
            onPointerUp={release}
            onKeyUp={release}
            className="slide-confirm absolute inset-0 h-full w-full cursor-grab appearance-none bg-transparent active:cursor-grabbing disabled:cursor-wait"
          />
        </div>
      </div>
    </div>,
    document.body,
  )
}
