import { describe, it, expect, vi, afterEach } from "vitest"
import { INSIGHTS_SCHEMA, SEM_ANALYSIS_SCHEMA, callOpenAiInsights, getSemInsights } from "./aiInsights.js"

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

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

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

describe('SEM overview auditor', () => {
  it('uses a single strict analysis schema and retains dates, account ID, all loaded campaigns and missing metrics', async () => {
    assertStrict(SEM_ANALYSIS_SCHEMA)
    vi.stubEnv('OPENAI_API_KEY', 'test-key')
    const analysis = { analysis: 'Conversions are not verified.', findings: [], notVerified: ['Conversion actions'], followUpQuestion: 'What would you like to know?' }
    const fetch = vi.fn().mockResolvedValue(ok(analysis))
    vi.stubGlobal('fetch', fetch)
    const context = {
      accountName: 'Example', accountId: '1234567890',
      dateRange: { startDate: '2026-10-01', endDate: '2026-10-28' },
      summary: { cost: 200, conversions: null },
      campaigns: Array.from({ length: 12 }, (_, i) => ({ name: `Campaign ${i}`, conversions: 0 })),
    }
    await expect(getSemInsights(context)).resolves.toEqual(analysis)
    const body = JSON.parse(fetch.mock.calls[0][1].body)
    expect(body.store).toBe(false)
    expect(body.text.format.schema).toEqual(SEM_ANALYSIS_SCHEMA)
    expect(body.text.format.schema.properties).not.toHaveProperty('short_term')
    const sentContext = JSON.parse(body.input[1].content.split('Overview data (JSON):\n')[1])
    expect(sentContext).toEqual(context)
    expect(body.input[0].content).toContain('Registered conversions are reported events')
    expect(body.input[0].content).toContain('Conversion tracking')
    expect(body.input[0].content).toContain('Account structure')
  })

  it.each([null, {}, { accountName: '' }, { accountName: 'Example', text: 'a'.repeat(100001) }])('rejects unusable context without a provider request', async context => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
    await expect(getSemInsights(context)).rejects.toMatchObject({ statusCode: 400 })
    expect(fetch).not.toHaveBeenCalled()
  })
})
