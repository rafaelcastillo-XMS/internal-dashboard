import type { ClientRecord } from "./clientsTable"

export type NotebookIntegrationConfig = {
    enabled: boolean
    notebookId: string
    notebookTitle: string
}

export function notebookConfigFromRecord(record: ClientRecord | null | undefined): NotebookIntegrationConfig {
    return {
        enabled: Boolean(record?.notebooklm_enabled),
        notebookId: record?.notebooklm_id ?? "",
        notebookTitle: record?.notebooklm_title ?? "",
    }
}
