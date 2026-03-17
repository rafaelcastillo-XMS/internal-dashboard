import { useEffect, useRef, useState } from "react"
import { useLocation } from "react-router-dom"
import { usePageLoading } from "@/context/PageLoadingContext"

function getSectionColors(pathname: string) {
    if (pathname.startsWith("/seo")) {
        return {
            background: "linear-gradient(90deg, #1A72D9, #3B82F6)",
            shadow: "0 0 10px rgba(26,114,217,0.45)",
        }
    }

    if (pathname.startsWith("/sem")) {
        return {
            background: "linear-gradient(90deg, #15803D, #22C55E)",
            shadow: "0 0 10px rgba(34,197,94,0.4)",
        }
    }

    if (pathname.startsWith("/social")) {
        return {
            background: "linear-gradient(90deg, #DB2777, #F472B6)",
            shadow: "0 0 10px rgba(244,114,182,0.45)",
        }
    }

    if (pathname.startsWith("/design")) {
        return {
            background: "linear-gradient(90deg, #EA580C, #EF4444)",
            shadow: "0 0 10px rgba(239,68,68,0.45)",
        }
    }

    return {
        background: "linear-gradient(90deg, #4B5563, #9CA3AF)",
        shadow: "0 0 10px rgba(107,114,128,0.35)",
    }
}

export function TopLoadingBar() {
    const location = useLocation()
    const { activeCount } = usePageLoading()
    const [width, setWidth] = useState(0)
    const [visible, setVisible] = useState(false)
    const timers = useRef<ReturnType<typeof setTimeout>[]>([])
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const routePendingRef = useRef(false)
    const colors = getSectionColors(location.pathname)

    useEffect(() => {
        timers.current.forEach(clearTimeout)
        timers.current = []
        if (intervalRef.current) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
        }

        setWidth(0)
        setVisible(true)
        routePendingRef.current = true

        timers.current.push(setTimeout(() => setWidth(14), 10))
        timers.current.push(setTimeout(() => setWidth(28), 90))
        timers.current.push(setTimeout(() => {
            routePendingRef.current = false
            if (activeCount === 0) {
                setWidth(100)
                timers.current.push(setTimeout(() => setVisible(false), 240))
            }
        }, 220))

        return () => {
            timers.current.forEach(clearTimeout)
            if (intervalRef.current) {
                clearInterval(intervalRef.current)
                intervalRef.current = null
            }
        }
    }, [location.pathname])

    useEffect(() => {
        if (!visible) return

        if (activeCount > 0) {
            if (intervalRef.current) clearInterval(intervalRef.current)
            setWidth((current) => (current < 42 ? 42 : current))
            intervalRef.current = setInterval(() => {
                setWidth((current) => {
                    if (current >= 88) return current
                    const nextStep = current + Math.max(2, (88 - current) * 0.12)
                    return Math.min(88, nextStep)
                })
            }, 180)
            return () => {
                if (intervalRef.current) {
                    clearInterval(intervalRef.current)
                    intervalRef.current = null
                }
            }
        }

        if (routePendingRef.current) return

        if (intervalRef.current) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
        }

        setWidth(100)
        const hideTimer = setTimeout(() => setVisible(false), 240)
        return () => clearTimeout(hideTimer)
    }, [activeCount, visible])

    if (!visible) return null

    return (
        <div
            className="fixed top-0 left-0 right-0 h-[2px] z-[9999] pointer-events-none"
            style={{
                width: `${width}%`,
                background: colors.background,
                transition: width === 0 ? "none" : "width 220ms cubic-bezier(0.4,0,0.2,1)",
                boxShadow: colors.shadow,
            }}
        />
    )
}
