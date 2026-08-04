export async function fetchNotionCovers(accessToken: string): Promise<Record<string, string>> {
    const response = await fetch("/api/notion/clients/covers", { headers: { Authorization: `Bearer ${accessToken}` } })
    const payload = await response.json() as { covers?: Record<string, string>; error?: string }
    if (!response.ok || payload.error) throw new Error(payload.error ?? "Unable to load Notion covers.")
    return payload.covers ?? {}
}
