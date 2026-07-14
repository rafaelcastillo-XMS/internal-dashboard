import type { ReactNode } from 'react'

interface AuditWorkflowHeaderProps {
  eyebrow?: string
  title: string
  description: string
  icon: ReactNode
  actions?: ReactNode
}

export function AuditWorkflowHeader({
  eyebrow = 'Audit Workflow',
  title,
  description,
  icon,
  actions,
}: AuditWorkflowHeaderProps) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-body dark:text-bodydark">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#1A72D9]/20 bg-[#1A72D9]/10 text-[#1A72D9]">
            {icon}
          </span>
          {eyebrow}
        </div>
        <h1 className="text-2xl font-bold leading-tight text-black dark:text-[#E2E5E9]">{title}</h1>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-body dark:text-bodydark">{description}</p>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}
