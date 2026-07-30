import { HelpCircle } from 'lucide-react'

// CSS-only hover/focus bubble. Keyboard reachable via tabIndex so the
// explanation is not mouse-only.
export function InfoTip({ text, className = '' }: { text: string; className?: string }) {
    return (
        <span className={`group/tip relative inline-flex align-middle ${className}`} tabIndex={0} role="note" aria-label={text}>
            <HelpCircle className="h-3.5 w-3.5 cursor-help text-body opacity-60 transition-opacity hover:opacity-100 dark:text-bodydark" />
            <span
                className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 hidden -translate-x-1/2
                           whitespace-normal rounded-lg bg-slate-800 px-2.5 py-1.5 text-[11px] font-medium leading-snug
                           text-white shadow-lg group-hover/tip:block group-focus/tip:block"
                style={{ width: 'max-content', maxWidth: 220 }}
            >
                {text}
                <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
            </span>
        </span>
    )
}
