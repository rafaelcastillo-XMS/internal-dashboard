export const DASHBOARD_EMAIL_DOMAIN = "xperienceusa.com"

export function normalizeDashboardEmail(email: string | null | undefined) {
    return email?.trim().toLowerCase() ?? ""
}

export function isAllowedDashboardEmail(email: string | null | undefined) {
    return normalizeDashboardEmail(email).endsWith(`@${DASHBOARD_EMAIL_DOMAIN}`)
}
