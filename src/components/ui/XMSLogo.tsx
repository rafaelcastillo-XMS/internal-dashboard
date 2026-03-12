interface XMSLogoProps {
    /** "dark" = logo for dark backgrounds (sidebar), "light" = logo for light backgrounds */
    mode?: "dark" | "light"
    className?: string
    height?: number
}

export function XMSLogo({ mode = "dark", className = "", height = 48 }: XMSLogoProps) {
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
