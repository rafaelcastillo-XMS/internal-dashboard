import { useEffect } from 'react'
import { FileText, ImagePlus, Loader2, Trash2, X } from 'lucide-react'
import { formatDateLabel } from '@/features/seo/hooks/useSEODashboardState'
import { getQuarterlyMonthLabels, MAX_GBP_IMAGES, type GbpReportImage, type QuarterlyReportPeriod } from '@/features/seo/lib/quarterlyReportConfig'

interface QuarterlyReportConfigModalProps {
  period: QuarterlyReportPeriod
  title: string
  images: GbpReportImage[]
  imageError: string
  reportError: string
  preparingImage: boolean
  generating: boolean
  onTitleChange: (title: string) => void
  onImageChange: (files: File[], replaceId?: string) => void
  onRemoveImage: (id: string) => void
  onClose: () => void
  onGenerate: () => void
}

export function QuarterlyReportConfigModal({
  period,
  title,
  images,
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
  const imageControlsDisabled = generating || preparingImage
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
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-black dark:text-[#E2E5E9]">Google Business Profile Images <span className="font-normal text-body dark:text-bodydark">(Optional)</span></p>
                <span className="shrink-0 rounded-full bg-[#1A72D9]/10 px-2 py-0.5 text-xs font-semibold text-[#1A72D9]" aria-live="polite">{images.length}/{MAX_GBP_IMAGES}</span>
              </div>
              <p className="mt-0.5 text-xs text-body dark:text-bodydark">Up to 3 images: PNG, JPG, or WEBP up to 10 MB each. Used only for this generated report.</p>
            </div>

            {images.length > 0 && (
              <div className="mb-3 grid gap-3 sm:grid-cols-2">
                {images.map((image, index) => (
                  <div key={image.id} className="overflow-hidden rounded-xl border border-stroke bg-[var(--bg-subtle)] dark:border-strokedark">
                    <div className="flex h-40 items-center justify-center p-3">
                      <img src={image.dataUrl} alt={`Google Business Profile preview ${index + 1}`} className="max-h-full max-w-full object-contain" />
                    </div>
                    <div className="border-t border-stroke bg-white px-3 py-2.5 dark:border-strokedark dark:bg-boxdark">
                      <p title={image.name} className="mb-2 truncate text-xs text-body dark:text-bodydark">{image.name}</p>
                      <div className="flex items-center justify-between gap-2">
                        <label className={`rounded-lg border border-stroke px-3 py-1.5 text-xs font-semibold text-[#1A72D9] transition-colors focus-within:ring-2 focus-within:ring-[#1A72D9] dark:border-strokedark ${imageControlsDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-[var(--bg-subtle)]'}`}>
                          Replace
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            disabled={imageControlsDisabled}
                            className="sr-only"
                            aria-label={`Replace Google Business Profile image ${index + 1}`}
                            onChange={(event) => {
                              onImageChange(Array.from(event.target.files ?? []), image.id)
                              event.currentTarget.value = ''
                            }}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => onRemoveImage(image.id)}
                          disabled={imageControlsDisabled}
                          className="rounded-lg border border-stroke p-1.5 text-body transition-colors hover:border-danger/40 hover:text-danger disabled:opacity-50 dark:border-strokedark dark:text-bodydark"
                          aria-label={`Remove Google Business Profile image ${index + 1}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {images.length < MAX_GBP_IMAGES ? (
              <label className={`flex h-32 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#1A72D9]/50 bg-[#1A72D9]/5 px-6 text-center text-[#1A72D9] transition-colors focus-within:ring-2 focus-within:ring-[#1A72D9] ${imageControlsDisabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-[#1A72D9]/10'}`}>
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white shadow-sm dark:bg-boxdark">
                  {preparingImage ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
                </span>
                <span className="text-sm font-semibold">{preparingImage ? 'Preparing images…' : images.length ? 'Add more images' : 'Choose images'}</span>
                <span className="text-xs text-body dark:text-bodydark">Select up to {MAX_GBP_IMAGES - images.length} {MAX_GBP_IMAGES - images.length === 1 ? 'file' : 'files'} from your computer</span>
                <input
                  type="file"
                  multiple
                  accept="image/png,image/jpeg,image/webp"
                  disabled={imageControlsDisabled}
                  className="sr-only"
                  aria-label="Add Google Business Profile images"
                  onChange={(event) => {
                    onImageChange(Array.from(event.target.files ?? []))
                    event.currentTarget.value = ''
                  }}
                />
              </label>
            ) : (
              <p className="text-xs text-body dark:text-bodydark" role="status">All 3 images are ready. You can replace or remove any image before generating.</p>
            )}
            {imageError && <p className="mt-2 text-xs text-danger" role="alert">{imageError}</p>}
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
