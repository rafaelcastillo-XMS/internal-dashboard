import { describe, expect, it } from "vitest"
import { auditPrompt, buildStructuredPrompt } from "./promptAudit"

describe("auditPrompt", () => {
  it("scores an empty prompt at zero", () => {
    expect(auditPrompt("   ").score).toBe(0)
    expect(auditPrompt("").pillars.every(p => !p.pass)).toBe(true)
  })

  it("scores a prompt with all five pillars at 100", () => {
    const prompt = `Act as a Senior SEO strategist.
Analyze the keyword data below.
Context: our client ranks page 2 for 40 terms.
Return only a markdown table.
Max 150 words, English only.`
    const result = auditPrompt(prompt)
    expect(result.score).toBe(100)
    expect(result.pillars.find(p => p.key === "format")?.pass).toBe(true)
  })

  it("flags the missing pillars of a bare prompt", () => {
    const result = auditPrompt("write me a blog post about seo")
    expect(result.score).toBe(20)
    const failing = result.pillars.filter(p => !p.pass).map(p => p.key)
    expect(failing).toEqual(["role", "context", "format", "constraints"])
  })

  it("credits context to long prompts without explicit markers", () => {
    const long = `Act as a reviewer. ${"analyze this line of the report. ".repeat(12)}`
    expect(auditPrompt(long).pillars.find(p => p.key === "context")?.pass).toBe(true)
  })
})

describe("buildStructuredPrompt", () => {
  it("routes each sentence to its pillar", () => {
    const out = buildStructuredPrompt("Act as a DevOps engineer. Write a deploy script. Return only a code block. Max 40 lines.")
    expect(out).toContain("## Role\nAct as a DevOps engineer.")
    expect(out).toContain("## Task\nWrite a deploy script.")
    expect(out).toContain("## Output format\nReturn only a code block.")
    expect(out).toContain("## Constraints\nMax 40 lines.")
  })

  it("placeholders the pillars it cannot fill, without inventing content", () => {
    const out = buildStructuredPrompt("write me a blog post about seo")
    expect(out).toContain("## Task\nwrite me a blog post about seo")
    expect(out).toContain("## Role\n[TODO")
    expect(out).toContain("## Output format\n[TODO")
    expect(out).not.toMatch(/Senior SEO strategist with 10 years[^\]]*$/m)
  })

  it("always emits the five headings in order", () => {
    const headings = buildStructuredPrompt("hello").match(/^## .+$/gm)
    expect(headings).toEqual(["## Role", "## Task", "## Context", "## Output format", "## Constraints"])
  })
})
