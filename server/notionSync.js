import { createClient } from "@supabase/supabase-js"
import { lookup } from "node:dns/promises"
import { isIP } from "node:net"

const NOTION_API_BASE = "https://api.notion.com/v1"
const NOTION_API_VERSION = "2026-03-11"
const MAX_LOGO_BYTES = 10 * 1024 * 1024
const NOTION_REQUEST_TIMEOUT_MS = 20_000

// Keep all workspace-specific column aliases in one place so a Notion rename
// only requires changing this mapping.
export const NOTION_CLIENT_PROPERTIES = Object.freeze({
  clientId: ["Dashboard Client ID", "Client ID", "Dashboard ID"],
  name: ["Client Name", "Name", "Client"],
  logo: ["Logo", "Client Logo", "Brand Logo"],
  monthlySemBudget: ["Monthly SEM Budget", "SEM Monthly Budget", "Monthly Budget", "SEM Budget"],
})

export class NotionSyncError extends Error {
  constructor(message, statusCode = 500) {
    super(message)
    this.name = "NotionSyncError"
    this.statusCode = statusCode
  }
}

function normalizeKey(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
}

export function normalizeClientIdentity(value) {
  return normalizeKey(value).replace(/[^a-z0-9]/g, "")
}

function richTextValue(items) {
  if (!Array.isArray(items)) return ""
  return items.map(item => item?.plain_text ?? item?.text?.content ?? "").join("").trim()
}

function propertyText(property) {
  if (!property || typeof property !== "object") return ""
  if (property.type === "title") return richTextValue(property.title)
  if (property.type === "rich_text") return richTextValue(property.rich_text)
  if (property.type === "url") return String(property.url ?? "").trim()
  if (property.type === "email") return String(property.email ?? "").trim()
  if (property.type === "phone_number") return String(property.phone_number ?? "").trim()
  if (property.type === "select") return String(property.select?.name ?? "").trim()
  if (property.type === "status") return String(property.status?.name ?? "").trim()
  if (property.type === "number" && property.number != null) return String(property.number)
  if (property.type === "formula") {
    const formula = property.formula
    if (formula?.type === "string") return String(formula.string ?? "").trim()
    if (formula?.type === "number" && formula.number != null) return String(formula.number)
  }
  if (property.type === "rollup") {
    const rollup = property.rollup
    if (rollup?.type === "number" && rollup.number != null) return String(rollup.number)
  }
  return ""
}

function findProperty(properties, aliases) {
  if (!properties || typeof properties !== "object") return undefined
  const entries = Object.entries(properties)
  for (const alias of aliases) {
    const normalizedAlias = normalizeKey(alias)
    const match = entries.find(([name]) => normalizeKey(name) === normalizedAlias)
    if (match) return match[1]
  }
  return undefined
}

function titleProperty(properties) {
  if (!properties || typeof properties !== "object") return undefined
  return Object.values(properties).find(property => property?.type === "title")
}

function parseBudget(property) {
  if (!property || typeof property !== "object") return null

  let value = null
  if (property.type === "number") value = property.number
  if (property.type === "formula" && property.formula?.type === "number") value = property.formula.number
  if (property.type === "rollup" && property.rollup?.type === "number") value = property.rollup.number

  if (value == null) {
    const text = propertyText(property)
    if (!text) return null
    const parsed = Number(text.replace(/[^0-9.-]/g, ""))
    value = Number.isFinite(parsed) ? parsed : null
  }

  const numberValue = Number(value)
  return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : null
}

function fileUrl(file) {
  if (!file || typeof file !== "object") return ""
  if (file.type === "file") return String(file.file?.url ?? "")
  if (file.type === "external") return String(file.external?.url ?? "")
  if (file.type === "file_upload") return String(file.file_upload?.url ?? "")
  return ""
}

function logoFromProperty(property) {
  if (!property || typeof property !== "object") return null
  if (property.type === "files" && Array.isArray(property.files)) {
    for (const file of property.files) {
      const url = fileUrl(file)
      if (url) return { url, name: String(file.name ?? "logo") }
    }
  }

  const externalUrl = propertyText(property)
  if (/^https:\/\//i.test(externalUrl)) return { url: externalUrl, name: "external-logo" }
  return null
}

function logoFromPageIcon(page) {
  const url = fileUrl(page?.icon)
  return url ? { url, name: "page-icon" } : null
}

export function extractNotionClientData(page) {
  const properties = page?.properties ?? {}
  const nameProperty = findProperty(properties, NOTION_CLIENT_PROPERTIES.name) ?? titleProperty(properties)
  const idProperty = findProperty(properties, NOTION_CLIENT_PROPERTIES.clientId)
  const logoProperty = findProperty(properties, NOTION_CLIENT_PROPERTIES.logo)
  const budgetProperty = findProperty(properties, NOTION_CLIENT_PROPERTIES.monthlySemBudget)

  return {
    pageId: String(page?.id ?? ""),
    dashboardClientId: propertyText(idProperty),
    name: propertyText(nameProperty),
    logo: logoFromProperty(logoProperty) ?? logoFromPageIcon(page),
    monthlySemBudget: parseBudget(budgetProperty),
  }
}

export function findNotionClientPage(pages, client, existingNotionPageId = "") {
  const activePages = (Array.isArray(pages) ? pages : []).filter(page => page?.object === "page" && !page?.in_trash)

  if (existingNotionPageId) {
    const existing = activePages.find(page => page.id === existingNotionPageId)
    if (existing) return existing
  }

  const exactIdMatches = activePages.filter(page => {
    const data = extractNotionClientData(page)
    return data.dashboardClientId && normalizeKey(data.dashboardClientId) === normalizeKey(client.id)
  })
  if (exactIdMatches.length === 1) return exactIdMatches[0]
  if (exactIdMatches.length > 1) {
    throw new NotionSyncError("More than one Notion record uses this Dashboard Client ID.", 409)
  }

  const expectedIdentities = new Set([
    normalizeClientIdentity(client.id),
    normalizeClientIdentity(client.name),
  ].filter(Boolean))
  const nameMatches = activePages.filter(page => {
    const data = extractNotionClientData(page)
    return !data.dashboardClientId && expectedIdentities.has(normalizeClientIdentity(data.name))
  })
  if (nameMatches.length === 1) return nameMatches[0]
  if (nameMatches.length > 1) {
    throw new NotionSyncError("Multiple Notion records match this client name. Add a unique Dashboard Client ID in Notion.", 409)
  }

  return null
}

export class NotionApiClient {
  constructor({ apiKey, dataSourceId, fetchImpl = fetch }) {
    if (!apiKey) throw new NotionSyncError("NOTION_API_KEY is not configured on the server.", 503)
    if (!dataSourceId) throw new NotionSyncError("NOTION_DATA_SOURCE_ID is not configured on the server.", 503)
    this.apiKey = apiKey
    this.dataSourceId = dataSourceId
    this.fetchImpl = fetchImpl
  }

  async queryAllPages() {
    const pages = []
    let startCursor
    const cursors = new Set()

    do {
      let response
      try {
        response = await this.fetchImpl(
          `${NOTION_API_BASE}/data_sources/${encodeURIComponent(this.dataSourceId)}/query`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${this.apiKey}`,
              "Content-Type": "application/json",
              "Notion-Version": NOTION_API_VERSION,
            },
            body: JSON.stringify({
              page_size: 100,
              result_type: "page",
              ...(startCursor ? { start_cursor: startCursor } : {}),
            }),
            signal: AbortSignal.timeout(NOTION_REQUEST_TIMEOUT_MS),
          },
        )
      } catch {
        throw new NotionSyncError("Notion could not be reached before the request timed out.", 502)
      }

      if (!response.ok) {
        if (response.status === 401) throw new NotionSyncError("Notion rejected NOTION_API_KEY.", 502)
        if (response.status === 403) throw new NotionSyncError("The Notion integration does not have permission to read this data source.", 502)
        if (response.status === 404) throw new NotionSyncError("The Notion data source was not found or has not been shared with the integration.", 502)
        if (response.status === 429) throw new NotionSyncError("Notion rate-limited the synchronization. Try again shortly.", 429)
        throw new NotionSyncError(`Notion returned HTTP ${response.status}.`, 502)
      }

      let payload
      try {
        payload = await response.json()
      } catch {
        throw new NotionSyncError("Notion returned an incomplete data-source response.", 502)
      }
      if (!payload || !Array.isArray(payload.results)) {
        throw new NotionSyncError("Notion returned an incomplete data-source response.", 502)
      }
      if (payload.request_status?.type === "incomplete") {
        throw new NotionSyncError("Notion returned an incomplete data-source response. Narrow the client data source before retrying.", 502)
      }

      pages.push(...payload.results)
      startCursor = payload.has_more && payload.next_cursor ? payload.next_cursor : undefined
      if (startCursor && cursors.has(startCursor)) {
        throw new NotionSyncError("Notion returned an invalid repeated pagination cursor.", 502)
      }
      if (startCursor) cursors.add(startCursor)
    } while (startCursor)

    return pages
  }
}

function bearerToken(authorization) {
  const value = Array.isArray(authorization) ? authorization[0] : authorization
  const match = typeof value === "string" ? /^Bearer\s+(.+)$/i.exec(value.trim()) : null
  return match?.[1] ?? ""
}

function validClientId(clientId) {
  return /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(clientId)
}

function imageExtension(contentType, fileName) {
  const normalizedType = String(contentType ?? "").split(";")[0].trim().toLowerCase()
  const byType = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/svg+xml": "svg",
  }
  if (byType[normalizedType]) return byType[normalizedType]
  const fileExtension = String(fileName ?? "").toLowerCase().match(/\.([a-z0-9]{2,5})$/)?.[1]
  return ["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(fileExtension) ? fileExtension.replace("jpeg", "jpg") : ""
}

function imageContentType(extension, reportedContentType) {
  if (String(reportedContentType).startsWith("image/")) return reportedContentType
  return {
    png: "image/png",
    jpg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
    svg: "image/svg+xml",
  }[extension]
}

function isPrivateAddress(address) {
  const normalized = String(address ?? "").toLowerCase().split("%")[0]
  if (isIP(normalized) === 4) {
    const [a, b] = normalized.split(".").map(Number)
    return a === 0
      || a === 10
      || a === 127
      || (a === 100 && b >= 64 && b <= 127)
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168)
      || (a === 198 && (b === 18 || b === 19))
      || a >= 224
  }
  if (isIP(normalized) === 6) {
    if (normalized.startsWith("::ffff:")) return isPrivateAddress(normalized.slice(7))
    return normalized === "::"
      || normalized === "::1"
      || normalized.startsWith("fc")
      || normalized.startsWith("fd")
      || /^fe[89ab]/.test(normalized)
  }
  return true
}

async function validateRemoteLogoUrl(value) {
  let parsedUrl
  try {
    parsedUrl = value instanceof URL ? value : new URL(value)
  } catch {
    throw new NotionSyncError("Notion returned an invalid logo URL.", 502)
  }

  const hostname = parsedUrl.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "").toLowerCase()
  if (parsedUrl.protocol !== "https:" || parsedUrl.username || parsedUrl.password) {
    throw new NotionSyncError("The Notion logo URL must be a public HTTPS URL.", 502)
  }
  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    throw new NotionSyncError("The Notion logo URL must be a public HTTPS URL.", 502)
  }

  if (isIP(hostname)) {
    if (isPrivateAddress(hostname)) throw new NotionSyncError("The Notion logo URL must be publicly reachable.", 502)
    return parsedUrl
  }

  let addresses
  try {
    addresses = await lookup(hostname, { all: true, verbatim: true })
  } catch {
    throw new NotionSyncError("The Notion logo host could not be resolved.", 502)
  }
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new NotionSyncError("The Notion logo URL must be publicly reachable.", 502)
  }
  return parsedUrl
}

async function fetchRemoteLogo(value, fetchImpl) {
  let currentUrl = await validateRemoteLogoUrl(value)

  for (let redirectCount = 0; redirectCount <= 5; redirectCount += 1) {
    let response
    try {
      response = await fetchImpl(currentUrl, {
        redirect: "manual",
        signal: AbortSignal.timeout(NOTION_REQUEST_TIMEOUT_MS),
      })
    } catch {
      throw new NotionSyncError("The client logo could not be downloaded from Notion.", 502)
    }

    if (response.status < 300 || response.status >= 400) return response
    const location = response.headers.get("location")
    if (!location) throw new NotionSyncError("The client logo returned an invalid redirect.", 502)
    await response.body?.cancel()
    currentUrl = await validateRemoteLogoUrl(new URL(location, currentUrl))
  }

  throw new NotionSyncError("The client logo returned too many redirects.", 502)
}

async function readLogoBytes(response) {
  if (!response.body || typeof response.body.getReader !== "function") {
    const bytes = new Uint8Array(await response.arrayBuffer())
    if (bytes.byteLength > MAX_LOGO_BYTES) throw new NotionSyncError("The Notion logo exceeds the 10 MB limit.", 413)
    return bytes
  }

  const reader = response.body.getReader()
  const chunks = []
  let totalBytes = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      totalBytes += value.byteLength
      if (totalBytes > MAX_LOGO_BYTES) {
        await reader.cancel()
        throw new NotionSyncError("The Notion logo exceeds the 10 MB limit.", 413)
      }
      chunks.push(value)
    }
  } catch (error) {
    if (error instanceof NotionSyncError) throw error
    throw new NotionSyncError("The client logo could not be downloaded from Notion.", 502)
  } finally {
    reader.releaseLock()
  }

  const bytes = new Uint8Array(totalBytes)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}

async function downloadLogo(logo, fetchImpl = fetch) {
  const response = await fetchRemoteLogo(logo.url, fetchImpl)
  if (!response.ok) throw new NotionSyncError("The client logo could not be downloaded from Notion.", 502)

  const declaredSize = Number(response.headers.get("content-length") ?? 0)
  if (declaredSize > MAX_LOGO_BYTES) throw new NotionSyncError("The Notion logo exceeds the 10 MB limit.", 413)

  const contentType = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() ?? ""
  const extension = imageExtension(contentType, logo.name)
  if (!extension) throw new NotionSyncError("The Notion logo is not a supported image type.", 422)

  const bytes = await readLogoBytes(response)
  return { bytes, contentType: imageContentType(extension, contentType), extension }
}

function databaseError(error, fallback) {
  if (!error) return
  const message = String(error.message ?? "")
  if (message.includes("notion_page_id") || message.includes("notion_last_synced_at")) {
    throw new NotionSyncError("Apply the Notion Supabase migration before synchronizing clients.", 503)
  }
  throw new NotionSyncError(`${fallback}: ${message || "Unknown Supabase error"}`, 500)
}

export async function syncClientFromNotion({
  clientId,
  authorization,
  notionApiKey,
  notionDataSourceId,
  supabaseUrl,
  supabaseAnonKey,
  fetchImpl = fetch,
}) {
  if (!validClientId(clientId)) throw new NotionSyncError("Invalid client ID.", 400)
  const accessToken = bearerToken(authorization)
  if (!accessToken) throw new NotionSyncError("A valid dashboard session is required.", 401)

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  })
  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken)
  if (userError || !userData.user) throw new NotionSyncError("The dashboard session is invalid or expired.", 401)

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("id, name, sem_account_id, notion_page_id")
    .eq("id", clientId)
    .maybeSingle()
  databaseError(clientError, "Unable to load the dashboard client")
  if (!client) throw new NotionSyncError("Client not found in Supabase.", 404)

  const notion = new NotionApiClient({ apiKey: notionApiKey, dataSourceId: notionDataSourceId, fetchImpl })
  const pages = await notion.queryAllPages()
  const page = findNotionClientPage(pages, client, client.notion_page_id ?? "")
  if (!page) {
    throw new NotionSyncError("No Notion record matches this client. Add its Dashboard Client ID to Notion.", 404)
  }

  const notionData = extractNotionClientData(page)
  const { data: duplicatePage, error: duplicateError } = await supabase
    .from("clients")
    .select("id")
    .eq("notion_page_id", notionData.pageId)
    .neq("id", client.id)
    .limit(1)
    .maybeSingle()
  databaseError(duplicateError, "Unable to validate the Notion mapping")
  if (duplicatePage) throw new NotionSyncError("This Notion record is already linked to another dashboard client.", 409)

  let logoUrl = null
  let logoStoragePath = null
  if (notionData.logo) {
    const logo = await downloadLogo(notionData.logo, fetchImpl)
    logoStoragePath = `${client.id}/notion-logo.${logo.extension}`
    const { error: uploadError } = await supabase.storage
      .from("client-assets")
      .upload(logoStoragePath, logo.bytes, {
        contentType: logo.contentType,
        cacheControl: "86400",
        upsert: true,
      })
    databaseError(uploadError, "Unable to store the Notion logo in Supabase")
    const publicUrl = supabase.storage.from("client-assets").getPublicUrl(logoStoragePath).data.publicUrl
    logoUrl = `${publicUrl}?v=${Date.now()}`

    const { error: profileError } = await supabase
      .from("client_profiles")
      .upsert({
        client_id: client.id,
        logo_url: logoUrl,
        logo_storage_path: logoStoragePath,
      }, { onConflict: "client_id" })
    databaseError(profileError, "Unable to save the client logo")
  }

  let budgetAppliedToAccount = false
  if (notionData.monthlySemBudget != null && client.sem_account_id) {
    const { error: budgetError } = await supabase
      .from("sem_report_budgets")
      .upsert({
        account_id: client.sem_account_id,
        report_type: "ads_monthly",
        budget: notionData.monthlySemBudget,
        updated_at: new Date().toISOString(),
      }, { onConflict: "account_id,report_type" })
    databaseError(budgetError, "Unable to save the monthly SEM budget")
    budgetAppliedToAccount = true
  }

  const syncedAt = new Date().toISOString()
  const { error: updateError } = await supabase
    .from("clients")
    .update({ notion_page_id: notionData.pageId, notion_last_synced_at: syncedAt })
    .eq("id", client.id)
  databaseError(updateError, "Unable to save the Notion synchronization status")

  const warnings = []
  if (!notionData.logo) warnings.push("No logo was found in the configured Notion properties.")
  if (notionData.monthlySemBudget == null) warnings.push("No monthly SEM budget was found in Notion.")
  if (notionData.monthlySemBudget != null && !client.sem_account_id) {
    warnings.push("The budget was found, but this client has no linked Google Ads account.")
  }

  return {
    success: true,
    clientId: client.id,
    notionPageId: notionData.pageId,
    notionClientName: notionData.name,
    lastSyncedAt: syncedAt,
    logoUrl,
    logoStoragePath,
    monthlySemBudget: notionData.monthlySemBudget,
    budgetAppliedToAccount,
    warnings,
  }
}

export async function handleNotionClientSyncRequest(req, res, options) {
  try {
    const result = await syncClientFromNotion({
      clientId: options.clientId,
      authorization: req.headers?.authorization,
      notionApiKey: options.notionApiKey,
      notionDataSourceId: options.notionDataSourceId,
      supabaseUrl: options.supabaseUrl,
      supabaseAnonKey: options.supabaseAnonKey,
    })
    res.statusCode = 200
    res.setHeader("Content-Type", "application/json")
    res.setHeader("Cache-Control", "no-store")
    res.end(JSON.stringify(result))
  } catch (error) {
    const statusCode = error instanceof NotionSyncError ? error.statusCode : 500
    const message = error instanceof NotionSyncError ? error.message : "Unexpected Notion synchronization error."
    console.error("[notion-sync]", message)
    res.statusCode = statusCode
    res.setHeader("Content-Type", "application/json")
    res.setHeader("Cache-Control", "no-store")
    res.end(JSON.stringify({ error: message }))
  }
}
