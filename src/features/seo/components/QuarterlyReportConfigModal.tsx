import { useEffect } from 'react'
import { FileText, ImagePlus, Loader2, Trash2, X } from 'lucide-react'
import { formatDateLabel } from '@/features/seo/hooks/useSEODashboardState'
import { getQuarterlyMonthLabels, type QuarterlyReportPeriod } from '@/features/seo/lib/quarterlyReportConfig'

interface QuarterlyReportConfigModalProps {
  period: QuarterlyReportPeriod
  title: string
  imageName: string
  imageDataUrl: string
  imageError: string
  reportError: string
  preparingImage: boolean
  generating: boolean
  onTitleChange: (title: string) => void
  onImageChange: (file?: File) => void
  onRemoveImage: () => void
  onClose: () => void
  onGenerate: () => void
}

export function QuarterlyReportConfigModal({
  period,
  title,
  imageName,
  imageDataUrl,
  imageError,
  reportError,
  preparingImage,
  generating,
  onTitleChange,
  onImageChange,
  onRemoveImage,
  onClose,
  onGenerate,
}: QuarterlyReportConfigModalProps) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose()
      }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="quarterly-report-config-title"
        className="max-h-[calc(100vh-2rem)] w-full max-w-xl overflow-y-auto rounded-2xl border border-stroke bg-white shadow-2xl dark:border-strokedark dark:bg-boxdark"
      >
        <div className="flex items-center justify-between border-b border-stroke px-6 py-4 dark:border-strokedark">
          <div>
            <h2 id="quarterly-report-config-title" className="text-lg font-semibold text-black dark:text-[#E2E5E9]">
              Configure Quarterly Report
            </h2>
            <p className="mt-0.5 text-xs text-body dark:text-bodydark">Review the details before generating the report.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={generating}
            aria-label="Close report configuration"
            className="rounded-lg p-2 text-body transition-colors hover:bg-[var(--bg-subtle)] hover:text-black disabled:opacity-50 dark:text-bodydark dark:hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6 px-6 py-5">
          <div>
            <label htmlFor="quarterly-report-title" className="mb-2 block text-sm font-semibold text-black dark:text-[#E2E5E9]">
              Report Name
            </label>
            <input
              id="quarterly-report-title"
              value={title}
              maxLength={120}
              onChange={(event) => onTitleChange(event.target.value)}
              placeholder="Optional, e.g. September Report"
              autoFocus
              disabled={generating}
              className="w-full rounded-lg border border-stroke bg-transparent px-3 py-2.5 text-sm text-black outline-none transition-colors focus:border-[#1A72D9] disabled:opacity-60 dark:border-strokedark dark:text-[#E2E5E9]"
            />
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-black dark:text-[#E2E5E9]">Months</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {getQuarterlyMonthLabels(period.endDate).map((month) => (
                <div key={month} className="rounded-lg border border-stroke bg-[var(--bg-subtle)] px-3 py-2.5 text-center text-sm font-medium text-black dark:border-strokedark dark:text-[#E2E5E9]">
                  {month}
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-body dark:text-bodydark">
              Data range: {formatDateLabel(period.startDate, period.endDate)}
            </p>
          </div>

          <div>
            <div className="mb-2">
              <p className="text-sm font-semibold text-black dark:text-[#E2E5E9]">Google Business Profile Image <span className="font-normal text-body dark:text-bodydark">(Optional)</span></p>
              <p className="mt-0.5 text-xs text-body dark:text-bodydark">PNG, JPG, or WEBP up to 10 MB. Used only for this generated report.</p>
            </div>

            {imageDataUrl ? (
              <div className="overflow-hidden rounded-xl border border-stroke bg-[var(--bg-subtle)] dark:border-strokedark">
                <div className="flex h-64 items-center justify-center p-3">
                  <img src={imageDataUrl} alt="Google Business Profile preview" className="max-h-full max-w-full object-contain" />
                </div>
                <div className="flex items-center justify-between border-t border-stroke bg-white px-3 py-2.5 dark:border-strokedark dark:bg-boxdark">
                  <p className="min-w-0 truncate pr-3 text-xs text-body dark:text-bodydark">{imageName}</p>
                  <div className="flex shrink-0 items-center gap-2">
                    <label htmlFor="quarterly-gbp-image" className="cursor-pointer rounded-lg border border-stroke px-3 py-1.5 text-xs font-semibold text-[#1A72D9] transition-colors hover:bg-[var(--bg-subtle)] dark:border-strokedark">
                      Replace
                    </label>
                    <button
                      type="button"
                      onClick={onRemoveImage}
                      disabled={generating}
                      className="rounded-lg border border-stroke p-1.5 text-body transition-colors hover:border-danger/40 hover:text-danger disabled:opacity-50 dark:border-strokedark dark:text-bodydark"
                      aria-label="Remove Google Business Profile image"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <label htmlFor="quarterly-gbp-image" className="flex h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#1A72D9]/50 bg-[#1A72D9]/5 px-6 text-center text-[#1A72D9] transition-colors hover:bg-[#1A72D9]/10">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white shadow-sm dark:bg-boxdark">
                  {preparingImage ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
                </span>
                <span className="text-sm font-semibold">{preparingImage ? 'Preparing image…' : 'Choose an image'}</span>
                <span className="text-xs text-body dark:text-bodydark">Select a file from your computer</span>
              </label>
            )}
            <input
              id="quarterly-gbp-image"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={generating}
              className="sr-only"
              onChange={(event) => {
                onImageChange(event.target.files?.[0])
                event.currentTarget.value = ''
              }}
            />
            {imageError && <p className="mt-2 text-xs text-danger">{imageError}</p>}
          </div>

          {reportError && (
            <div className="rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">{reportError}</div>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-stroke px-6 py-4 dark:border-strokedark">
          <button
            type="button"
            onClick={onClose}
            disabled={generating}
            className="rounded-lg border border-stroke px-4 py-2 text-sm font-semibold text-body transition-colors hover:bg-[var(--bg-subtle)] disabled:opacity-50 dark:border-strokedark dark:text-bodydark"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onGenerate}
            disabled={generating || preparingImage}
            className="flex items-center gap-2 rounded-lg bg-[#1A72D9] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#1A72D9]/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            {generating ? 'Generating report…' : 'Generate Report'}
          </button>
        </div>
      </div>
    </div>
  )
}
