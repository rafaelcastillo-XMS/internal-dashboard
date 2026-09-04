export function normalizeMondayLabel(label: string | null | undefined): string

export function buildMondayEmailMap(raw: string | null | undefined): Record<string, string>

export interface MondayTask {
  id: string
  name: string
  board: string
  status: string
  statusIndex: number | null
  priority: string | null
  priorityIndex: number | null
  dueDate: string | null
  updatedAt: string
}

export function fetchMondayTasksForUser(input: {
  mondayToken: string
  sessionEmail: string
  bust?: boolean
}): Promise<{ user: { id: string; name: string; email: string; avatar: string } | null; tasks: MondayTask[] }>

export interface MondayTaskDetail {
  id: string
  boardId: string | null
  boardName: string
  mondayUrl: string | null
  updates: { id: string; body: string; createdAt: string; creatorName: string; creatorAvatar: string | null }[]
}

export function fetchMondayTaskDetail(input: { mondayToken: string; taskId: string }): Promise<MondayTaskDetail>
