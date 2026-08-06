const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses"
const DEFAULT_OPENAI_MODEL = "gpt-5.6"

const promptOptimizationSchema = {
  type: "object",
  properties: {
    summary: { type: "string" },
    strengths: { type: "array", items: { type: "string" } },
    improvements: { type: "array", items: { type: "string" } },
    optimizedPrompt: { type: "string" },
  },
  required: ["summary", "strengths", "improvements", "optimizedPrompt"],
  additionalProperties: false,
}

function apiError(message, statusCode) {
  const error = new Error(message)
  error.statusCode = statusCode
  return error
}

function getResponseText(payload) {
  if (typeof payload?.output_text === "string") return payload.output_text
  const parts = (payload?.output || []).flatMap(item => item?.content || [])
  return parts.find(part => typeof part?.text === "string")?.text || ""
}

function parseStructuredResult(payload) {
  const raw = getResponseText(payload).trim()
  if (!raw) return null
  const candidates = [raw]
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  if (fenced) candidates.push(fenced[1])
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate)
      if (parsed && typeof parsed.summary === "string" && Array.isArray(parsed.strengths) &&
          Array.isArray(parsed.improvements) && typeof parsed.optimizedPrompt === "string") return parsed
    } catch { /* Try the next representation. */ }
  }
  return null
}

/**
 * Uses the server-side OpenAI Responses API. The API key must never be sent
 * to the browser; callers only receive the structured result below.
 */
export async function optimizePromptWithOpenAI(prompt) {
  if (!process.env.OPENAI_API_KEY) {
    throw apiError("OPENAI_API_KEY not configured in the server environment", 503)
  }

  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL,
      input: [
        {
          role: "system",
          content: "You are an expert prompt engineer. Analyze and improve ONLY the exact prompt between <user_prompt> and </user_prompt>. Do not substitute a generic example or invent a different task. Preserve the user's language, topic, channel, audience, requested length, and intent. Respond in the same language as the user. Be concrete, preserve useful domain details, remove ambiguity, and make the output ready to paste into an AI model. Return only the requested structured fields.",
        },
        { role: "user", content: `<user_prompt>\n${prompt}\n</user_prompt>` },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "prompt_optimization",
          strict: true,
          schema: promptOptimizationSchema,
        },
      },
      max_output_tokens: 1400,
    }),
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const detail = payload?.error?.message || `OpenAI API HTTP ${response.status}`
    throw apiError(detail, 502)
  }
  if (payload.status === "incomplete") {
    throw apiError(`OpenAI response incomplete: ${payload.incomplete_details?.reason || "unknown reason"}`, 502)
  }

  const result = parseStructuredResult(payload)
  if (!result) {
    throw apiError("OpenAI returned an invalid structured prompt analysis", 502)
  }
  return result
}
