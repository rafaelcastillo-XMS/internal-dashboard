import { readFileSync } from 'node:fs'

const root = new URL('../prompts/sem-auditor/', import.meta.url)
const master = readFileSync(new URL('master.md', root), 'utf8')
const areas = [
  ['conversion-tracking', /conversion|conversi[oó]n|conversi[oó]nes|tracking|medici[oó]n|lead|ga4|gtm|tag|llamada|call|cpa|cpl/i],
  ['account-structure', /campaign|campa[nñ]a|estructura|structure|presupuesto|budget|gasto|spend|puja|bidd?ing|pmax|performance max|rendimiento|performance/i],
  ['search-terms', /search term|search quer|t[eé]rmino|b[uú]squeda|negativ|keyword|palabra|consulta|desperdicio|wast/i],
  ['ads-assets', /\bads?\b|anuncio|asset|recurso|rsa|titular|headline|copy|creativ|sitelink|ctr/i],
  ['landing-pages', /landing|p[aá]gina|website|sitio|web|formulario|form\b|velocidad|speed|cwv/i],
].map(([name, matches]) => ({ name, matches, text: readFileSync(new URL(`resources/${name}.md`, root), 'utf8') }))
const negatives = readFileSync(new URL('resources/negative-keyword-library.md', root), 'utf8')

// The downloaded skills are reference material for this app, not installed
// agent tools. Only send the checklists relevant to the current conversation.
export function getSemAuditorInstructions(messages = []) {
  const question = messages.filter(m => m.role === 'user').map(m => m.content).join('\n')
  const full = /full audit|complete audit|auditor[ií]a (completa|integral)|revis(a|ar|i[oó]n) (todo|completa)/i.test(question)
  let selected = full ? areas : areas.filter(area => area.matches.test(question))
  if (!selected.length) selected = areas.slice(0, 2)
  const resources = selected.map(area => area.text)
  if (selected.some(area => area.name === 'search-terms')) resources.push(negatives)
  return `${master}\n\nReference checklists (subordinate to the evidence and judgment rules above):\n\n${resources.join('\n\n')}`
}
