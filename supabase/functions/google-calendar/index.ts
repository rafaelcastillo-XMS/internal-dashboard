import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { importPKCS8, SignJWT } from "https://esm.sh/jose@5"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

async function getGoogleAccessToken(userEmail: string): Promise<string> {
  const sa = JSON.parse(Deno.env.get("GOOGLE_SERVICE_ACCOUNT")!)
  const privateKey = await importPKCS8(sa.private_key, "RS256")

  const assertion = await new SignJWT({
    scope: "https://www.googleapis.com/auth/calendar.readonly",
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(sa.client_email)
    .setSubject(userEmail) // domain-wide delegation: impersonate this user
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(privateKey)

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  })

  const tokenData = await tokenRes.json()
  if (!tokenData.access_token) {
    throw new Error(tokenData.error_description ?? "Google token exchange failed")
  }
  return tokenData.access_token
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS })
  }

  try {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) throw new Error("Missing Authorization header")

    // Verify Supabase JWT and get user
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    )

    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user?.email) throw new Error("Unauthorized")

    const email = user.email
    console.log("[google-calendar] Attempting impersonation for:", email)
    if (!email.endsWith("@xperienceusa.com")) {
      throw new Error("Domain-wide delegation is only available for @xperienceusa.com accounts")
    }

    // Parse time range from request body
    const body = await req.json().catch(() => ({}))
    const now = Date.now()
    const timeMin: string = body.timeMin ?? new Date(now - 7 * 86_400_000).toISOString()
    const timeMax: string = body.timeMax ?? new Date(now + 60 * 86_400_000).toISOString()

    // Impersonate user via service account and get Google access token
    const accessToken = await getGoogleAccessToken(email)

    // Fetch events from Google Calendar primary calendar
    const gcalRes = await fetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events?" +
        new URLSearchParams({
          timeMin,
          timeMax,
          singleEvents: "true",
          orderBy: "startTime",
          maxResults: "250",
        }),
      { headers: { Authorization: `Bearer ${accessToken}` } },
    )

    const gcalData = await gcalRes.json()
    console.log("[google-calendar] gcalRes status:", gcalRes.status, "items:", gcalData?.items?.length ?? gcalData?.error ?? "no items key")

    return new Response(JSON.stringify(gcalData), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    })
  } catch (err) {
    const message = (err as Error).message ?? String(err)
    console.error("[google-calendar] caught error:", message)
    return new Response(
      JSON.stringify({ error: message }),
      { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    )
  }
})
