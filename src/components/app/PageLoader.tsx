import Skeleton, { SkeletonTheme } from "react-loading-skeleton"
import "react-loading-skeleton/dist/skeleton.css"

function getIsDark() {
    try {
        return (
            localStorage.getItem("xms-theme") === "dark" ||
            document.documentElement.classList.contains("dark")
        )
    } catch {
        return true
    }
}

export function PageLoader({ label: _label }: { label?: string } = {}) {
    const isDark = getIsDark()

    return (
        <SkeletonTheme
            baseColor={isDark ? "#1e293b" : "#f1f5f9"}
            highlightColor={isDark ? "#334155" : "#e2e8f0"}
            borderRadius={12}
        >
            <div className="p-6 space-y-6 h-full bg-slate-50 dark:bg-slate-900 overflow-auto">
                {/* Welcome row */}
                <div className="flex items-center justify-between">
                    <div>
                        <Skeleton width={260} height={28} />
                        <div className="mt-1.5">
                            <Skeleton width={180} height={14} />
                        </div>
                    </div>
                    <Skeleton width={100} height={32} />
                </div>

                {/* Stats row — 3 cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="rounded-2xl p-5 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                            <div className="flex items-center justify-between mb-3">
                                <Skeleton width={40} height={40} borderRadius={12} />
                                <Skeleton width={16} height={16} borderRadius={4} />
                            </div>
                            <Skeleton width={56} height={36} />
                            <div className="mt-1">
                                <Skeleton width={120} height={14} />
                            </div>
                            <div className="mt-1">
                                <Skeleton width={80} height={12} />
                            </div>
                        </div>
                    ))}
                </div>

                {/* Calendar / Events row */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    {[...Array(3)].map((_, i) => (
                        <Skeleton key={i} height={300} borderRadius={16} />
                    ))}
                </div>

                {/* Tasks + Chart row */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    <Skeleton height={280} borderRadius={16} />
                    <Skeleton height={280} borderRadius={16} />
                </div>
            </div>
        </SkeletonTheme>
    )
}
