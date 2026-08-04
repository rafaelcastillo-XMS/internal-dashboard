// Anatomy of an efficient prompt — five pillars, audited with plain regex.
// No LLM involved: everything here is deterministic and runs in the browser.

export type PillarKey = "role" | "task" | "context" | "format" | "constraints"

interface PillarDef {
  key: PillarKey
  label: string
  heading: string
  /** Shown when the pillar is missing. */
  tip: string
  /** Shown when the pillar is present. */
  ok: string
  match: RegExp
  placeholder: string
}

export const PILLARS: PillarDef[] = [
  {
    key: "role",
    label: "Role / Persona",
    heading: "Role",
    tip: 'No persona defined — open with "Act as a Senior SEO strategist…".',
    ok: "The model knows who it is supposed to be.",
    match: /\b(act as|you are|your role|role:|persona:|behave as|as an? (senior|expert|experienced|professional))\b/i,
    placeholder: "[TODO: define the persona — e.g. \"Act as a Senior SEO strategist with 10 years of agency experience.\"]",
  },
  {
    key: "task",
    label: "Concrete task",
    heading: "Task",
    tip: "No clear instruction — start with an action verb: write, analyze, generate…",
    ok: "There is a direct instruction to act on.",
    match: /\b(write|create|generate|analyz|summariz|list|build|review|translate|optimiz|extract|audit|draft|refactor|explain|compare|classif|rewrite)\w*\b/i,
    placeholder: "[TODO: state one concrete task — e.g. \"Write a 10-row keyword table.\"]",
  },
  {
    key: "context",
    label: "Necessary context",
    heading: "Context",
    tip: "No context supplied — paste the data the model needs, and nothing else.",
    ok: "Supporting data is included.",
    match: /\b(context|background|given|here is|here's|the following|based on|our|data:|input:)\b/i,
    placeholder: "[TODO: paste only the data the model needs to do the task.]",
  },
  {
    key: "format",
    label: "Output format",
    heading: "Output format",
    tip: "Output shape is open-ended — demand JSON, a table, bullets or a code block.",
    ok: "The output shape is specified.",
    match: /\b(json|yaml|csv|xml|markdown|table|bullet|bullets|code block|output format|format:|return only|respond with|schema)\b/i,
    placeholder: "[TODO: demand a shape — e.g. \"Return only a markdown table with columns X, Y, Z.\"]",
  },
  {
    key: "constraints",
    label: "Constraints",
    heading: "Constraints",
    tip: "Nothing is bounded — limit length, tone, language or allowed libraries.",
    ok: "Limits are set.",
    match: /\b(max|maximum|no more than|at most|limit|under \d+|within \d+|tone|in (english|spanish)|do not|don't|never|avoid|only use|must not|words|characters|sentences)\b/i,
    placeholder: "[TODO: bound it — e.g. \"Max 150 words, English, no marketing fluff.\"]",
  },
]

export interface PillarResult {
  key: PillarKey
  label: string
  pass: boolean
  feedback: string
}

export interface AuditResult {
  pillars: PillarResult[]
  score: number
}

export function auditPrompt(prompt: string): AuditResult {
  const filled = prompt.trim().length > 0
  const pillars = PILLARS.map(p => {
    // A long prompt without context markers still carries context in practice.
    const pass = filled && (p.match.test(prompt) || (p.key === "context" && prompt.trim().length > 280))
    return { key: p.key, label: p.label, pass, feedback: pass ? p.ok : p.tip }
  })
  return { pillars, score: pillars.filter(p => p.pass).length * 20 }
}

/**
 * Reorders the prompt into the five pillars. Each sentence lands in the first
 * pillar whose pattern it matches; leftovers become context. Nothing is
 * invented — missing pillars get a [TODO] placeholder for the user to fill.
 */
export function buildStructuredPrompt(prompt: string): string {
  const sentences = prompt
    .split(/\n+|(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(Boolean)

  const buckets: Record<PillarKey, string[]> = { role: [], task: [], context: [], format: [], constraints: [] }
  // Context last: it is the catch-all, so specific pillars claim a sentence first.
  const order: PillarKey[] = ["role", "format", "constraints", "task", "context"]

  for (const sentence of sentences) {
    const hit = order.find(key => {
      const pillar = PILLARS.find(p => p.key === key)!
      return key !== "context" && pillar.match.test(sentence)
    })
    buckets[hit ?? "context"].push(sentence)
  }

  return PILLARS.map(p => {
    const body = buckets[p.key].join(" ").trim()
    return `## ${p.heading}\n${body || p.placeholder}`
  }).join("\n\n")
}
