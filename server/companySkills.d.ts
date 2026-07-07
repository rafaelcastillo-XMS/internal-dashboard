export interface CompanySkill {
  id: string
  name: string
  title: string
  category: string
  status: "available" | "draft" | "deprecated" | "archived"
  path: string
  filePath: string
  url: string
  summary: string
  createdAt: string | null
  updatedAt: string | null
  commitCount: number
  historyComplete: boolean
}

export interface CompanySkillCategory {
  name: string
  count: number
  available: number
  draft: number
  deprecated: number
  archived: number
}

export interface CompanySkillsCatalog {
  repository: {
    owner: string
    name: string
    fullName: string
    url: string
    defaultBranch: string
    private: boolean
    archived: boolean
    updatedAt: string | null
    fetchedAt: string
  }
  totals: {
    skills: number
    categories: number
    available: number
    draft: number
    deprecated: number
    archived: number
  }
  categories: CompanySkillCategory[]
  skills: CompanySkill[]
}

export function getCompanySkillsCatalog(options?: { refresh?: boolean }): Promise<CompanySkillsCatalog>
