export type NotionRelatedSource = {
    category: "sem" | "seo" | "design" | "social"
    source: string
    sourceIdSuffix: string
    records: { id: string; properties: Record<string, unknown> }[]
}

export type NotionRelatedData = {
    clientPageId: string
    sources: NotionRelatedSource[]
}

export async function fetchRelatedNotionData(clientId: string, accessToken: string): Promise<NotionRelatedData> {
    const response = await fetch(`/api/notion/clients/${encodeURIComponent(clientId)}/related`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    })
    const payload = await response.json() as NotionRelatedData & { error?: string }
    if (!response.ok || payload.error) throw new Error(payload.error ?? `Unable to load related Notion data (HTTP ${response.status}).`)
    return payload
}
