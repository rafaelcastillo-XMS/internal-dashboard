import type { IncomingMessage, ServerResponse } from "node:http"

export const NOTION_CLIENT_PROPERTIES: Readonly<{
  clientId: readonly string[]
  name: readonly string[]
  logo: readonly string[]
  monthlySemBudget: readonly string[]
}>

export class NotionSyncError extends Error {
  statusCode: number
  constructor(message: string, statusCode?: number)
}

export class NotionApiClient {
  constructor(options: { apiKey: string; dataSourceId: string; fetchImpl?: typeof fetch })
  queryAllPages(): Promise<Record<string, unknown>[]>
}

export function normalizeClientIdentity(value: unknown): string
export function extractNotionClientData(page: Record<string, unknown>): {
  pageId: string
  dashboardClientId: string
  name: string
  logo: { url: string; name: string } | null
  monthlySemBudget: number | null
}
export function findNotionClientPage(
  pages: Record<string, unknown>[],
  client: { id: string; name: string },
  existingNotionPageId?: string,
): Record<string, unknown> | null

export function syncClientFromNotion(options: {
  clientId: string
  authorization: string | string[] | undefined
  notionApiKey: string
  notionDataSourceId: string
  supabaseUrl: string
  supabaseAnonKey: string
  fetchImpl?: typeof fetch
}): Promise<Record<string, unknown>>

export function handleNotionClientSyncRequest(
  req: IncomingMessage,
  res: ServerResponse,
  options: {
    clientId: string
    notionApiKey: string
    notionDataSourceId: string
    supabaseUrl: string
    supabaseAnonKey: string
  },
): Promise<void>
