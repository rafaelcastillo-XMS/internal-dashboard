import { useRef, useState } from 'react'
import { HelpCircle } from 'lucide-react'

// Positioned via getBoundingClientRect + `position: fixed` (not CSS-only
// absolute) so the bubble escapes clipping from ancestors that scroll
// horizontally, like a table wrapped in `overflow-x-auto`.
export function InfoTip({ text, className = '' }: { text: string; className?: string }) {
    const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
    const anchorRef = useRef<HTMLSpanElement>(null)

    const show = () => {
        const rect = anchorRef.current?.getBoundingClientRect()
        if (!rect) return
        setPos({ top: rect.top - 8, left: rect.left + rect.width / 2 })
    }
    const hide = () => setPos(null)

    return (
        <span
            ref={anchorRef}
            className={`relative inline-flex align-middle ${className}`}
            tabIndex={0}
            role="note"
            aria-label={text}
            onMouseEnter={show}
            onMouseLeave={hide}
            onFocus={show}
            onBlur={hide}
        >
            <HelpCircle className="h-3.5 w-3.5 cursor-help text-body opacity-60 transition-opacity hover:opacity-100 dark:text-bodydark" />
            {pos && (
                <span
                    className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full
                               whitespace-normal rounded-lg bg-slate-800 px-2.5 py-1.5 text-[11px] font-medium leading-snug
                               text-white shadow-lg"
                    style={{ top: pos.top, left: pos.left, width: 'max-content', maxWidth: 220 }}
                >
                    {text}
                    <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
                </span>
            )}
        </span>
    )
}
