import { describe, it, expect, vi, afterEach } from "vitest"
import { INSIGHTS_SCHEMA, callOpenAiInsights } from "./aiInsights.js"

/** OpenAI rejects a strict json_schema unless every object lists all its
 *  properties in `required` and sets additionalProperties:false. */
function assertStrict(node, path = "root") {
  if (node.type === "object") {
    expect(node.additionalProperties, `${path}.additionalProperties`).toBe(false)
    expect(new Set(node.required), `${path}.required`).toEqual(new Set(Object.keys(node.properties)))
    for (const [k, v] of Object.entries(node.properties)) assertStrict(v, `${path}.${k}`)
  }
  if (node.type === "array") assertStrict(node.items, `${path}[]`)
}

const ok = body => ({ ok: true, json: async () => ({ status: "completed", output_text: JSON.stringify(body) }) })
const args = { system: "s", user: "u", schemaName: "n" }

afterEach(() => vi.unstubAllGlobals())

describe("INSIGHTS_SCHEMA", () => {
  it("is strict-mode compliant", () => assertStrict(INSIGHTS_SCHEMA))

  it("carries the three timeframes the panels render", () => {
    expect(Object.keys(INSIGHTS_SCHEMA.properties)).toEqual(["short_term", "medium_term", "long_term"])
    expect(Object.keys(INSIGHTS_SCHEMA.properties.short_term.items.properties)).toEqual(["action", "impact"])
  })
})

describe("callOpenAiInsights", () => {
  const payload = { short_term: [{ action: "a", impact: "high" }], medium_term: [], long_term: [] }

  it("returns the parsed insights", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok(payload)))
    await expect(callOpenAiInsights(args)).resolves.toEqual(payload)
  })

  it("maps an API error to 502 and surfaces the message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false, status: 400, json: async () => ({ error: { message: "bad model" } }),
    }))
    await expect(callOpenAiInsights(args)).rejects.toMatchObject({ statusCode: 502, message: "bad model" })
  })

  it("maps a truncated reply to 502 naming the reason", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: "incomplete", incomplete_details: { reason: "max_output_tokens" } }),
    }))
    await expect(callOpenAiInsights(args)).rejects.toMatchObject({
      statusCode: 502, message: /max_output_tokens/,
    })
  })

  it("503s when the key is absent instead of calling out", async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal("fetch", fetchSpy)
    const key = process.env.OPENAI_API_KEY
    delete process.env.OPENAI_API_KEY
    try {
      await expect(callOpenAiInsights(args)).rejects.toMatchObject({ statusCode: 503 })
      expect(fetchSpy).not.toHaveBeenCalled()
    } finally {
      if (key !== undefined) process.env.OPENAI_API_KEY = key
    }
  })
})
