import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { CORS_HEADERS as CORS } from "../_shared/cors.ts"

import { fetchAdsReport } from "./reporting.ts"

// Read the per-client OpenAI Ads token using the service role (bypasses the
// write-only column privileges that block the browser from reading it).
async function getClientToken(clientId: string): Promise<string | null> {
  const base = Deno.env.get("SUPABASE_URL")!
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  const res = await fetch(
    `${base}/rest/v1/client_ad_secrets?client_id=eq.${encodeURIComponent(clientId)}&provider=eq.openai_ads&select=token`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  )
  if (!res.ok) throw new Error(`secret lookup failed: ${res.status}`)
  const rows = await res.json()
  return rows?.[0]?.token ?? null
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })

  const url = new URL(req.url)
  const segment = url.pathname.split("/").pop()

  try {
    if (segment === "campaigns") {
      const clientId = url.searchParams.get("clientId") ?? ""
      if (!clientId) throw new Error("Missing clientId")
      const token = await getClientToken(clientId)
      if (!token) throw new Error("No OpenAI Ads token configured for this client")
      const result = await fetchAdsReport(token, {
        startDate: url.searchParams.get("startDate") ?? undefined,
        endDate: url.searchParams.get("endDate") ?? undefined,
        startTime: url.searchParams.get("startTime") ?? undefined,
        endTime: url.searchParams.get("endTime") ?? undefined,
      })
      return new Response(JSON.stringify(result), { headers: { ...CORS, "Content-Type": "application/json" } })
    }

    return new Response(JSON.stringify({ error: `Unknown endpoint: ${segment}` }), {
      status: 404,
      headers: { ...CORS, "Content-Type": "application/json" },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    })
  }
})
