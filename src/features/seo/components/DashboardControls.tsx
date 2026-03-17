import { useState } from 'react'
import { DATE_PRESETS } from '../hooks/useSEODashboardState'
import { exportPageToPdf } from '../lib/exportPdf'

interface SelectOption { value: string; label: string }

function PropertySelect({ label, value, onChange, options, placeholder, disabled }: {
  label: string; value: string; onChange: (v: string) => void
  options: SelectOption[]; placeholder: string; disabled?: boolean
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-body dark:text-bodydark whitespace-nowrap">{label}</span>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="appearance-none rounded-lg border border-stroke bg-white
                     py-1.5 pl-3 pr-8 text-xs font-medium text-black shadow-card
                     transition-colors hover:border-[#1A72D9] focus:border-[#1A72D9]
                     focus:outline-none disabled:opacity-50
                     dark:border-strokedark dark:bg-boxdark dark:text-white
                     max-w-[220px] truncate"
        >
          <option value="">{placeholder}</option>
          {options.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2">
          <svg className="h-3.5 w-3.5 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </span>
      </div>
    </div>
  )
}

interface DashboardControlsProps {
  propertiesError?: string | null
  selectedGscSite: string; setSelectedGscSite: (v: string) => void; gscOptions: SelectOption[]
  selectedGa4Id: string;   setSelectedGa4Id:   (v: string) => void; ga4Options: SelectOption[]
  showGsc?: boolean; showGa4?: boolean; showDateRange?: boolean
  selectedPreset: number; handlePresetChange: (idx: number) => void
  loading?: boolean; onRefresh: () => void
  pageTitle?: string
}

export function DashboardControls({
  propertiesError: _propertiesError,
  selectedGscSite, setSelectedGscSite, gscOptions,
  selectedGa4Id,   setSelectedGa4Id,   ga4Options,
  showGsc = true, showGa4 = true, showDateRange = true,
  selectedPreset, handlePresetChange,
  loading, onRefresh,
  pageTitle = 'Dashboard',
}: DashboardControlsProps) {
  const [exporting, setExporting] = useState(false)

  async function handleExport() {
    setExporting(true)
    try { await exportPageToPdf(pageTitle) } finally { setExporting(false) }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {showGsc && (
        <PropertySelect label="GSC" value={selectedGscSite} onChange={setSelectedGscSite}
          options={gscOptions} placeholder={gscOptions.length === 0 ? 'Loading…' : 'Select property…'}
          disabled={gscOptions.length === 0} />
      )}
      {showGa4 && (
        <PropertySelect label="GA4" value={selectedGa4Id} onChange={setSelectedGa4Id}
          options={ga4Options} placeholder={ga4Options.length === 0 ? 'Loading…' : 'Select property…'}
          disabled={ga4Options.length === 0} />
      )}

      {showDateRange && (
        <div className="flex items-center gap-1 rounded-lg border border-stroke
                        bg-white p-1 shadow-card dark:border-strokedark dark:bg-boxdark">
          <svg className="h-4 w-4 text-body dark:text-bodydark" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
                  d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
          </svg>
          {DATE_PRESETS.map((preset, idx) => (
            <button key={preset.days} onClick={() => handlePresetChange(idx)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-150
                      ${selectedPreset === idx
                        ? 'bg-[#1A72D9] text-white shadow-sm'
                        : 'text-body hover:text-black dark:text-bodydark dark:hover:text-white'
                      }`}>
              {preset.label}
            </button>
          ))}
        </div>
      )}

      <button onClick={onRefresh} disabled={loading}
              className="flex items-center gap-2 rounded-lg border border-stroke
                         bg-white px-4 py-2 text-sm font-medium text-black shadow-card
                         transition-colors hover:border-[#1A72D9] hover:text-[#1A72D9]
                         disabled:opacity-60 dark:border-strokedark dark:bg-boxdark dark:text-white">
        <svg className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round"
                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
        </svg>
        Refresh
      </button>

      <button onClick={handleExport} disabled={exporting}
              className="flex items-center gap-2 rounded-lg border border-stroke
                         bg-white px-4 py-2 text-sm font-medium text-black shadow-card
                         transition-colors hover:border-[#1A72D9] hover:text-[#1A72D9]
                         disabled:opacity-60 dark:border-strokedark dark:bg-boxdark dark:text-white">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
        </svg>
        {exporting ? 'Exporting…' : 'Export PDF'}
      </button>
    </div>
  )
}
