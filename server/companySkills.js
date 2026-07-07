const COMPANY_SKILLS_DEFAULT_REPO = "XMS-Ai/company-skills"
const COMPANY_SKILLS_CACHE_TTL_MS = 5 * 60 * 1000
const COMPANY_SKILLS_HISTORY_PAGE_LIMIT = 10

let companySkillsCache = {
  key: "",
  at: 0,
  payload: null,
}

function parseRepoSlug(value) {
  const cleaned = String(value || COMPANY_SKILLS_DEFAULT_REPO)
    .trim()
    .replace(/^https:\/\/github\.com\//, "")
    .replace(/\.git$/, "")
    .replace(/^\/+|\/+$/g, "")

  const [owner, repo] = cleaned.split("/")
  if (!owner || !repo) {
    throw new Error("COMPANY_SKILLS_REPO must be formatted as owner/repo")
  }
  return { owner, repo, fullName: `${owner}/${repo}` }
}

function githubToken() {
  return process.env.GITHUB_TOKEN || process.env.GH_TOKEN || ""
}

async function githubJson(endpoint, token) {
  const response = await fetch(`https://api.github.com${endpoint}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "xms-dashboard-company-skills",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })

  if (!response.ok) {
    const body = await response.text().catch(() => "")
    if (response.status === 401 || response.status === 404) {
      throw new Error(`GitHub API ${response.status}: ${response.statusText}. Add GITHUB_TOKEN or GH_TOKEN with access to XMS-Ai/company-skills if the repo is private.`)
    }
    throw new Error(`GitHub API ${response.status}: ${response.statusText}.${body ? ` ${body.slice(0, 220)}` : ""}`)
  }

  return response.json()
}

function decodeGithubBlob(blob) {
  if (!blob || typeof blob.content !== "string") return ""
  const raw = blob.content.replace(/\s/g, "")
  if (blob.encoding === "base64") return Buffer.from(raw, "base64").toString("utf8")
  return raw
}

function titleCase(value) {
  return String(value || "General")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, letter => letter.toUpperCase())
}

function cleanMetaValue(value) {
  return String(value || "")
    .trim()
    .replace(/^["']|["']$/g, "")
}

function readMeta(content, key) {
  const match = content.match(new RegExp(`^${key}:\\s*(.+)$`, "im"))
  return match ? cleanMetaValue(match[1]) : ""
}

function summarizeSkill(content) {
  const metaDescription = readMeta(content, "description")
  if (metaDescription) return metaDescription

  const lines = content
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean)
    .filter(line => !line.startsWith("#"))
    .filter(line => !line.startsWith("---"))
    .filter(line => !/^[a-z_ -]+:\s+/i.test(line))

  return (lines[0] || "No description available.").slice(0, 180)
}

function inferStatus(path, content, repoArchived) {
  if (repoArchived) return "archived"
  const explicit = readMeta(content, "status").toLowerCase()
  const haystack = `${path}\n${content}`.toLowerCase()

  if (explicit.includes("deprecated") || /deprecated|do not use/.test(haystack)) return "deprecated"
  if (explicit.includes("archived") || /archive|archived/.test(path.toLowerCase())) return "archived"
  if (explicit.includes("draft") || explicit.includes("wip") || /draft|wip|experimental/.test(haystack)) return "draft"
  if (explicit.includes("available") || explicit.includes("active")) return "available"
  return "available"
}

function skillNameFromPath(path) {
  const parts = path.split("/").filter(Boolean)
  const skillDir = parts.length > 1 ? parts[parts.length - 2] : parts[0] || "skill"
  return skillDir
}

function skillCategory(path, content) {
  const explicit = readMeta(content, "category")
  if (explicit) return titleCase(explicit)

  const parts = path.split("/").filter(Boolean)
  if (parts.length <= 2) return "General"
  return titleCase(parts[0])
}

function skillTitle(path, content) {
  const explicit = readMeta(content, "name") || readMeta(content, "title")
  if (explicit) return explicit

  const heading = content.match(/^#\s+(.+)$/m)
  if (heading?.[1]) return heading[1].trim()

  return titleCase(skillNameFromPath(path))
}

function commitDate(commit) {
  return commit?.commit?.committer?.date || commit?.commit?.author?.date || null
}

async function fetchSkillDates(owner, repo, branch, path, token) {
  let page = 1
  let newest = null
  let oldest = null
  let commitCount = 0
  let historyComplete = false

  while (page <= COMPANY_SKILLS_HISTORY_PAGE_LIMIT) {
    const params = new URLSearchParams({
      sha: branch,
      path,
      per_page: "100",
      page: String(page),
    })
    const commits = await githubJson(`/repos/${owner}/${repo}/commits?${params.toString()}`, token)
    if (!Array.isArray(commits) || commits.length === 0) {
      historyComplete = true
      break
    }

    if (!newest) newest = commitDate(commits[0])
    oldest = commitDate(commits[commits.length - 1])
    commitCount += commits.length

    if (commits.length < 100) {
      historyComplete = true
      break
    }
    page += 1
  }

  return { createdAt: oldest, updatedAt: newest, commitCount, historyComplete }
}

async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length)
  let nextIndex = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex
      nextIndex += 1
      results[index] = await mapper(items[index], index)
    }
  })
  await Promise.all(workers)
  return results
}

function buildCategorySummary(skills) {
  const byCategory = new Map()
  for (const skill of skills) {
    const row = byCategory.get(skill.category) || {
      name: skill.category,
      count: 0,
      available: 0,
      draft: 0,
      deprecated: 0,
      archived: 0,
    }
    row.count += 1
    row[skill.status] = (row[skill.status] || 0) + 1
    byCategory.set(skill.category, row)
  }
  return [...byCategory.values()].sort((a, b) => a.name.localeCompare(b.name))
}

export async function getCompanySkillsCatalog(options = {}) {
  const refresh = Boolean(options.refresh)
  const repoSlug = parseRepoSlug(process.env.COMPANY_SKILLS_REPO)
  const cacheKey = `${repoSlug.fullName}:${process.env.COMPANY_SKILLS_BRANCH || ""}`

  if (!refresh && companySkillsCache.payload && companySkillsCache.key === cacheKey && Date.now() - companySkillsCache.at < COMPANY_SKILLS_CACHE_TTL_MS) {
    return companySkillsCache.payload
  }

  const token = githubToken()
  const repoMeta = await githubJson(`/repos/${repoSlug.owner}/${repoSlug.repo}`, token)
  const branch = process.env.COMPANY_SKILLS_BRANCH || repoMeta.default_branch || "main"
  const tree = await githubJson(`/repos/${repoSlug.owner}/${repoSlug.repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`, token)
  const skillFiles = (tree.tree || [])
    .filter(item => {
      const itemPath = String(item.path || "").toLowerCase()
      return item.type === "blob" && (itemPath === "skill.md" || itemPath.endsWith("/skill.md"))
    })
    .sort((a, b) => String(a.path).localeCompare(String(b.path)))

  const skills = await mapLimit(skillFiles, 4, async item => {
    const path = String(item.path)
    const blob = await githubJson(`/repos/${repoSlug.owner}/${repoSlug.repo}/git/blobs/${item.sha}`, token)
    const content = decodeGithubBlob(blob)
    const dates = await fetchSkillDates(repoSlug.owner, repoSlug.repo, branch, path, token).catch(() => ({
      createdAt: null,
      updatedAt: null,
      commitCount: 0,
      historyComplete: false,
    }))
    const skillPath = path.replace(/\/SKILL\.md$/i, "")
    const status = inferStatus(path, content, Boolean(repoMeta.archived))

    return {
      id: skillPath.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, ""),
      name: skillNameFromPath(path),
      title: skillTitle(path, content),
      category: skillCategory(path, content),
      status,
      path: skillPath,
      filePath: path,
      url: `https://github.com/${repoSlug.fullName}/blob/${branch}/${path}`,
      summary: summarizeSkill(content),
      createdAt: dates.createdAt,
      updatedAt: dates.updatedAt,
      commitCount: dates.commitCount,
      historyComplete: dates.historyComplete,
    }
  })

  const categories = buildCategorySummary(skills)
  const totals = {
    skills: skills.length,
    categories: categories.length,
    available: skills.filter(skill => skill.status === "available").length,
    draft: skills.filter(skill => skill.status === "draft").length,
    deprecated: skills.filter(skill => skill.status === "deprecated").length,
    archived: skills.filter(skill => skill.status === "archived").length,
  }

  const payload = {
    repository: {
      owner: repoSlug.owner,
      name: repoSlug.repo,
      fullName: repoSlug.fullName,
      url: repoMeta.html_url || `https://github.com/${repoSlug.fullName}`,
      defaultBranch: branch,
      private: Boolean(repoMeta.private),
      archived: Boolean(repoMeta.archived),
      updatedAt: repoMeta.updated_at || null,
      fetchedAt: new Date().toISOString(),
    },
    totals,
    categories,
    skills,
  }

  companySkillsCache = { key: cacheKey, at: Date.now(), payload }
  return payload
}
