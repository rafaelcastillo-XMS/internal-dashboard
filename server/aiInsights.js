/**
 * server/aiInsights.js
 * Shared dashboard AI endpoints, used by both the
 * production server (server.js) and the Vite dev middleware (vite.config.ts)
 * so the prompts/logic live in exactly one place.
 */

import Anthropic from "@anthropic-ai/sdk"
import { getResponseText } from "./openaiPromptOptimizer.js"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// The SEM and SEO insight panels run on OpenAI; /api/ai/ask, /api/ai/task-insight
// and /api/ai/social-insights still run on Anthropic. Prod only ever had an
// OPENAI_API_KEY, so the two panels the team actually uses live on that side.
const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses"
// ponytail: model pinned, not read from OPENAI_MODEL — that var is set to the
// non-existent "gpt-5.6" and would 404. Change here if the model moves.
const INSIGHTS_MODEL = "gpt-5"

const INSIGHT_ITEM = {
  type: "object",
  properties: {
    action: { type: "string" },
    impact: { type: "string", enum: ["high", "medium", "low"] },
  },
  required: ["action", "impact"],
  additionalProperties: false,
}

export const INSIGHTS_SCHEMA = {
  type: "object",
  properties: {
    short_term: { type: "array", items: INSIGHT_ITEM },
    medium_term: { type: "array", items: INSIGHT_ITEM },
    long_term: { type: "array", items: INSIGHT_ITEM },
  },
  required: ["short_term", "medium_term", "long_term"],
  additionalProperties: false,
}

// Shared by the SEM and SEO insight routes. strict json_schema means the reply
// is already schema-valid, so there are no code fences to strip.
export async function callOpenAiInsights({ system, user, schemaName }) {
  if (!process.env.OPENAI_API_KEY) throw statusErr(503, "AI not configured")

  const res = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: INSIGHTS_MODEL,
      input: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      text: {
        format: { type: "json_schema", name: schemaName, strict: true, schema: INSIGHTS_SCHEMA },
      },
      // gpt-5 spends output tokens on reasoning before emitting the JSON, so the
      // budget covers both. Low effort is enough for 6-9 bounded action items;
      // at 2000 total the reply came back status:"incomplete".
      reasoning: { effort: "low" },
      max_output_tokens: 6000,
    }),
  })

  const payload = await res.json().catch(() => ({}))
  if (!res.ok) throw statusErr(502, payload?.error?.message || `OpenAI API HTTP ${res.status}`)
  if (payload.status === "incomplete") {
    throw statusErr(502, `OpenAI response incomplete: ${payload.incomplete_details?.reason || "unknown reason"}`)
  }

  try {
    return JSON.parse(getResponseText(payload).trim())
  } catch {
    throw statusErr(502, "OpenAI returned an invalid insights payload")
  }
}

function statusErr(statusCode, message) {
  return Object.assign(new Error(message), { statusCode })
}

function requireAnthropicConfigured() {
  if (!process.env.ANTHROPIC_API_KEY) throw statusErr(503, "AI not configured")
}

function parseJsonResponse(text) {
  const clean = (text ?? "{}").replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
  return JSON.parse(clean)
}

function textFrom(message) {
  return message.content.find(b => b.type === "text")?.text ?? ""
}

// ─── /api/ai/ask ──────────────────────────────────────────────────────────────
export async function askDashboardAi({ query, context }) {
  requireAnthropicConfigured()
  if (!query?.trim()) throw statusErr(400, "query is required")

  let contextBlock = ""
  if (context) {
    const parts = []
    if (context.today) parts.push(`Today is: ${context.today}`)
    if (context.currentPage) parts.push(`User is currently on page: ${context.currentPage}`)
    if (Array.isArray(context.tasks) && context.tasks.length > 0) {
      const taskLines = context.tasks.map(t =>
        `- [${t.status ?? "—"}] ${t.name} (board: ${t.board}, priority: ${t.priority ?? "none"}, due: ${t.dueDate ?? "no date"})`
      ).join("\n")
      parts.push(`User's current tasks from Monday.com:\n${taskLines}`)
    } else if (Array.isArray(context.tasks)) {
      parts.push("User has no tasks assigned in Monday.com right now.")
    }
    if (parts.length) contextBlock = `\n\n---\n${parts.join("\n\n")}\n---`
  }

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: `You are XMS AI, an assistant embedded in a marketing agency dashboard called XMS (Xperience Marketing Suite).
You help the team with tasks, campaigns, clients, SEM/SEO performance, and scheduling.
Respond in the same language the user writes in (Spanish or English).

Formatting rules (strictly follow these):
- Never use markdown tables, headers (###), or horizontal rules.
- Use plain short sentences or simple bullet points with "·" as the bullet character.
- Keep responses to 3–6 lines max. Be direct and conversational.
- If listing tasks, write each on its own line like: "· Task name — due May 13"
- No bold overuse — only bold 1–2 key words at most per response.

Use the dashboard context below to give specific, data-driven answers. Never invent data you don't have.${contextBlock}`,
    messages: [{ role: "user", content: query }],
  })

  return { response: textFrom(message) }
}

// ─── /api/ai/task-insight ─────────────────────────────────────────────────────
export async function getTaskInsight({ task, updates }) {
  requireAnthropicConfigured()
  if (!task?.name) throw statusErr(400, "task is required")

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  })
  const updatesText = updates?.length
    ? updates.map(u =>
        `[${new Date(u.createdAt).toLocaleDateString()}] ${u.creatorName}: ${u.body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()}`
      ).join("\n")
    : "No updates yet."

  const userPrompt = `Task: "${task.name}"
Status: ${task.status}
Priority: ${task.priority ?? "Not set"}
Due date: ${task.dueDate ?? "Not set"}
Board: ${task.board}
Today: ${today}

Recent updates/comments:
${updatesText}

Based on this task context, what should I do RIGHT NOW to move this forward? Give me 2–4 immediate next steps.`

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    system: `You are XMS AI, embedded in a marketing agency dashboard. You analyze task details and give concise, actionable next-step recommendations.
Respond in the same language as the task content (Spanish or English).
Format: 2–4 bullet points using "·" as the bullet character. Each point = one clear immediate action.
No intro sentence, no conclusion. Just the actions. Keep each bullet under 20 words.`,
    messages: [{ role: "user", content: userPrompt }],
  })

  return { insight: textFrom(message) }
}

// ─── /api/ai/sem-insights ─────────────────────────────────────────────────────
export async function getSemInsights({ accountName, summary, campaigns }) {
  if (!accountName) throw statusErr(400, "accountName is required")

  const campaignText = (campaigns ?? []).slice(0, 8).map(c =>
    `• ${c.name}: ${Number(c.impressions).toLocaleString()} impressions, ${c.clicks} clicks, ${Number(c.ctr).toFixed(2)}% CTR, $${Number(c.avg_cpc).toFixed(2)} CPC, $${Number(c.cost).toFixed(2)} spend, ${c.conversions} conversions`
  ).join("\n") || "No campaign data available"

  const userPrompt = `Account: ${accountName}

Performance Summary:
• Impressions: ${Number(summary?.impressions ?? 0).toLocaleString()}
• Clicks: ${Number(summary?.clicks ?? 0).toLocaleString()}
• CTR: ${Number(summary?.ctr ?? 0).toFixed(2)}%
• Avg CPC: $${Number(summary?.avg_cpc ?? 0).toFixed(2)}
• Total Spend: $${Number(summary?.cost ?? 0).toFixed(2)}
• Conversions: ${summary?.conversions ?? 0}
• Cost per Conversion: ${(summary?.conversions ?? 0) > 0 ? "$" + Number(summary?.cost_per_conversion ?? 0).toFixed(2) : "N/A"}

Top Campaigns by Spend:
${campaignText}

Provide 2-3 specific, data-driven action items per timeframe. Reference actual numbers from the data. Return ONLY valid JSON (no markdown, no explanation):
{
  "short_term": [{"action": "...", "impact": "high|medium|low"}],
  "medium_term": [{"action": "...", "impact": "high|medium|low"}],
  "long_term": [{"action": "...", "impact": "high|medium|low"}]
}`

  return callOpenAiInsights({
    schemaName: "sem_insights",
    user: userPrompt,
    system: `You are a senior Google Ads strategist with 10+ years of agency experience. Analyze SEM performance data and provide specific, data-driven action items for each timeframe:
SHORT-TERM (7-14 days): immediate bid adjustments, budget reallocation, pausing underperformers.
MEDIUM-TERM (30-60 days): A/B tests, audience refinements, ad copy experiments, keyword expansion.
LONG-TERM (3-6 months): account restructuring, automation setup, campaign type diversification.
Each action must cite specific metrics from the provided data. Always respond in English.
Return ONLY the JSON object. No markdown, no code fences, no explanation.`,
  })
}

// ─── /api/ai/seo-insights ─────────────────────────────────────────────────────
export async function getSeoInsights({ clientName, gscSite, gsc, ga4, psiScore }) {
  if (!gscSite) throw statusErr(400, "gscSite is required")

  const displayName = clientName || String(gscSite).replace(/^https?:\/\//, "").replace(/\/$/, "")
  const topQueries = (gsc?.queries ?? []).slice(0, 8).map(q =>
    `• "${q.query}": ${q.clicks} clicks, ${q.impressions} impr, pos ${Number(q.position).toFixed(1)}, ${Number(q.ctr * 100).toFixed(1)}% CTR`
  ).join("\n") || "No query data"
  const topPages = (ga4?.topPages ?? []).slice(0, 5).map(p =>
    `• ${p.page}${p.sessions ? `: ${p.sessions} sessions` : ""}`
  ).join("\n") || "No page data"

  const userPrompt = `Website: ${displayName} (${gscSite})

Google Search Console (selected period):
• Total Clicks: ${Number(gsc?.totalClicks ?? 0).toLocaleString()}
• Total Impressions: ${Number(gsc?.totalImpressions ?? 0).toLocaleString()}
• Avg. Position: ${Number(gsc?.avgPosition ?? 0).toFixed(1)}
• Click-through Rate: ${gsc?.totalImpressions > 0 ? ((gsc.totalClicks / gsc.totalImpressions) * 100).toFixed(2) : "0.00"}%

Top Queries:
${topQueries}

Google Analytics 4:
• Engaged Sessions: ${Number(ga4?.engagedSessions ?? 0).toLocaleString()}
• Conversion Rate: ${Number(ga4?.conversionRate ?? 0).toFixed(2)}%

Top Pages:
${topPages}

${psiScore != null ? `PageSpeed Score (mobile): ${psiScore}/100` : ""}

Provide 2-3 specific, data-driven SEO action items per timeframe. Reference actual numbers from the data. Return ONLY valid JSON (no markdown, no explanation):
{"short_term":[{"action":"...","impact":"high|medium|low"}],"medium_term":[{"action":"...","impact":"high|medium|low"}],"long_term":[{"action":"...","impact":"high|medium|low"}]}`

  return callOpenAiInsights({
    schemaName: "seo_insights",
    user: userPrompt,
    system: `You are a senior SEO strategist with 10+ years of agency experience. Analyze organic search performance data and provide specific, data-driven action items for each timeframe:
SHORT-TERM (7-14 days): quick wins — meta descriptions for high-impression/low-CTR queries, internal linking, fixing crawl issues.
MEDIUM-TERM (30-60 days): content optimization for near-first-page keywords, structured data, page speed fixes, content gaps.
LONG-TERM (3-6 months): authority building, content cluster strategy, technical architecture, Core Web Vitals.
Each action must cite specific numbers or query names from the data. Always respond in English.
Return ONLY the JSON object. No markdown, no code fences, no explanation.`,
  })
}

// ─── /api/ai/social-insights ──────────────────────────────────────────────────
export async function getSocialInsights({ accountName, platforms, metrics, posts }) {
  requireAnthropicConfigured()
  if (!platforms?.length) throw statusErr(400, "platforms is required")

  const platformList = platforms.join(", ")
  const engagementRate = metrics?.impresiones > 0
    ? ((metrics.interacciones / metrics.impresiones) * 100).toFixed(2)
    : "0.00"

  const topPosts = (posts ?? []).slice(0, 8).map(p =>
    `• [${p.platform}] ${p.type} — "${p.title}": ${Number(p.impresiones).toLocaleString()} impr, ${Number(p.alcance).toLocaleString()} reach, ${p.interacciones} interactions`
  ).join("\n") || "No post data available"

  const userPrompt = `Account: ${accountName || "Social Media Account"}
Active platforms: ${platformList}

Aggregated metrics:
• Followers: ${Number(metrics?.seguidores ?? 0).toLocaleString()}
• Impressions: ${Number(metrics?.impresiones ?? 0).toLocaleString()}
• Reach: ${Number(metrics?.alcance ?? 0).toLocaleString()}
• Interactions: ${Number(metrics?.interacciones ?? 0).toLocaleString()}
• Engagement Rate: ${engagementRate}%
• Profile Visits: ${Number(metrics?.visitasPerfil ?? 0).toLocaleString()}

Top performing posts:
${topPosts}

Return ONLY valid JSON: {"short_term":[{"action":"...","impact":"high|medium|low"}],"medium_term":[...],"long_term":[]}`

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: `You are a senior social media strategist with 10+ years of agency experience. Analyze social media performance data and provide specific, data-driven action items for each timeframe:
SHORT-TERM (7-14 days): posting frequency adjustments, content format optimization, best time to post, engagement tactics.
MEDIUM-TERM (30-60 days): content calendar strategy, A/B testing formats, cross-platform repurposing, hashtag strategy.
LONG-TERM (3-6 months): audience growth strategy, brand voice consistency, influencer collaborations, platform-specific growth.
Each action must cite specific numbers or platform names from the data. Always respond in English.
Return ONLY the JSON object. No markdown, no code fences, no explanation.`,
    messages: [{ role: "user", content: userPrompt }],
  })

  return parseJsonResponse(textFrom(message))
}
