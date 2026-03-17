import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react"
import { useEffect } from "react"

type PageLoadingContextValue = {
  activeCount: number
  beginLoading: (id: string) => void
  endLoading: (id: string) => void
}

const PageLoadingContext = createContext<PageLoadingContextValue | null>(null)

export function PageLoadingProvider({ children }: { children: React.ReactNode }) {
  const activeIdsRef = useRef(new Set<string>())
  const [activeCount, setActiveCount] = useState(0)

  const beginLoading = useCallback((id: string) => {
    if (activeIdsRef.current.has(id)) return
    activeIdsRef.current.add(id)
    setActiveCount(activeIdsRef.current.size)
  }, [])

  const endLoading = useCallback((id: string) => {
    if (!activeIdsRef.current.has(id)) return
    activeIdsRef.current.delete(id)
    setActiveCount(activeIdsRef.current.size)
  }, [])

  const value = useMemo(
    () => ({ activeCount, beginLoading, endLoading }),
    [activeCount, beginLoading, endLoading],
  )

  return <PageLoadingContext.Provider value={value}>{children}</PageLoadingContext.Provider>
}

export function usePageLoading() {
  const context = useContext(PageLoadingContext)
  if (!context) {
    throw new Error("usePageLoading must be used within a PageLoadingProvider")
  }
  return context
}

export function useTrackPageLoading(isLoading: boolean, key: string) {
  const { beginLoading, endLoading } = usePageLoading()

  useEffect(() => {
    if (isLoading) {
      beginLoading(key)
      return () => endLoading(key)
    }

    endLoading(key)
    return undefined
  }, [beginLoading, endLoading, isLoading, key])
}
