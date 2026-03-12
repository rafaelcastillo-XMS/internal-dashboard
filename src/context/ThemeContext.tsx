import { useEffect, useState } from "react"
import { ThemeContext } from "./theme-context"

type Theme = "light" | "dark"

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setTheme] = useState<Theme>(() => {
        if (typeof window === "undefined") return "light"
        const saved = localStorage.getItem("xms-theme")
        return saved === "dark" ? "dark" : "light"
    })

    useEffect(() => {
        const root = document.documentElement
        if (theme === "dark") {
            root.classList.add("dark")
        } else {
            root.classList.remove("dark")
        }
        if (typeof window !== "undefined") {
            localStorage.setItem("xms-theme", theme)
        }
    }, [theme])

    const toggleTheme = () => setTheme(t => t === "light" ? "dark" : "light")

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    )
}
