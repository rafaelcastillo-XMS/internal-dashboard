export type NotebookIntegrationConfig = {
    enabled: boolean
    notebookId: string
    notebookTitle: string
}

export type ClientIntegrationConfig = {
    notebooklm: NotebookIntegrationConfig
}

const STORAGE_KEY = "xms-client-integrations"

const defaultConfigs: Record<string, ClientIntegrationConfig> = {
    "holts-garage": {
        notebooklm: {
            enabled: true,
            notebookId: "a1b92187-70ae-4ebf-a627-169a9ceda0ec",
            notebookTitle: "Holt's Garage - CKB",
        },
    },
}

function isBrowser() {
    return typeof window !== "undefined"
}

function cloneConfig(config: ClientIntegrationConfig): ClientIntegrationConfig {
    return {
        notebooklm: { ...config.notebooklm },
    }
}

export function getDefaultIntegrationConfig(clientId: string): ClientIntegrationConfig {
    return cloneConfig(defaultConfigs[clientId] ?? {
        notebooklm: {
            enabled: false,
            notebookId: "",
            notebookTitle: "",
        },
    })
}

export function getClientIntegrationConfig(clientId: string): ClientIntegrationConfig {
    if (!isBrowser()) {
        return getDefaultIntegrationConfig(clientId)
    }

    try {
        const raw = window.localStorage.getItem(STORAGE_KEY)
        if (!raw) return getDefaultIntegrationConfig(clientId)

        const parsed = JSON.parse(raw) as Record<string, ClientIntegrationConfig>
        const config = parsed[clientId]

        return config
            ? {
                notebooklm: {
                    enabled: Boolean(config.notebooklm?.enabled),
                    notebookId: config.notebooklm?.notebookId ?? "",
                    notebookTitle: config.notebooklm?.notebookTitle ?? "",
                },
            }
            : getDefaultIntegrationConfig(clientId)
    } catch {
        return getDefaultIntegrationConfig(clientId)
    }
}

export function saveClientIntegrationConfig(clientId: string, config: ClientIntegrationConfig) {
    if (!isBrowser()) return

    let nextState: Record<string, ClientIntegrationConfig> = {}

    try {
        const raw = window.localStorage.getItem(STORAGE_KEY)
        nextState = raw ? JSON.parse(raw) as Record<string, ClientIntegrationConfig> : {}
    } catch {
        nextState = {}
    }

    nextState[clientId] = cloneConfig(config)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState))
}

export function getNotebookIntegrationBadge(clientId: string) {
    const config = getClientIntegrationConfig(clientId)
    return config.notebooklm.enabled && config.notebooklm.notebookId
}
