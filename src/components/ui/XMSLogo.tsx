interface XMSLogoProps {
    /** "dark" = dark bg, "light" = light bg, "auto" = switches with theme */
    mode?: "dark" | "light" | "auto"
    className?: string
    height?: number
}

export function XMSLogo({ mode = "dark", className = "", height = 48 }: XMSLogoProps) {
    if (mode === "auto") {
        return (
            <>
                <img
                    src="/xms-logo-light.webp"
                    alt="XMS – Xperience Ai Marketing Solutions"
                    style={{ height }}
                    className={`object-contain dark:hidden ${className}`}
                    draggable={false}
                />
                <img
                    src="/xms-logo-dark.webp"
                    alt="XMS – Xperience Ai Marketing Solutions"
                    style={{ height }}
                    className={`object-contain hidden dark:block ${className}`}
                    draggable={false}
                />
            </>
        )
    }
    const src = mode === "dark" ? "/xms-logo-dark.webp" : "/xms-logo-light.webp"
    return (
        <img
            src={src}
            alt="XMS – Xperience Ai Marketing Solutions"
            style={{ height }}
            className={`object-contain ${className}`}
            draggable={false}
        />
    )
}
