import type { ClientRecord } from "./clientsTable"

/**
 * Which dashboard modules apply to a client, derived from the integrations
 * actually configured on it. One rule, one place — every module selector reads
 * this instead of inventing its own filter.
 *
 * `contracted` vs `configured`: sem_enabled says the client bought Google Ads,
 * sem_account_id says it is wired up. A client that contracted but is not wired
 * yet is what the reconciliation view flags.
 */
export type ClientService = "seo" | "sem" | "lsa" | "social" | "design"

export function seoAccount(client: ClientRecord): string | null {
    return client.gsc_property || client.ga4_property_id || null
}

export function semAccount(client: ClientRecord): string | null {
    return client.sem_enabled ? client.sem_account_id : null
}

// LSA campaigns live inside the regular Ads account unless the client has a
// dedicated one (Holt's has both).
export function lsaAccount(client: ClientRecord): string | null {
    return client.lsa_account_id ?? semAccount(client)
}

export function hasService(client: ClientRecord, service: ClientService, website?: string | null): boolean {
    if (client.status !== "active") return false
    switch (service) {
        case "seo": return seoAccount(client) !== null
        case "sem": return semAccount(client) !== null
        case "lsa": return lsaAccount(client) !== null
        // ponytail: Social has no per-client integration yet, so every active
        // client is eligible. Narrow this once social accounts are linked.
        case "social": return true
        // Design runs PageSpeed against the client site, so a website is the
        // only requirement.
        case "design": return Boolean(website)
    }
}

export function clientsWithService(
    clients: ClientRecord[],
    service: ClientService,
    websites: Record<string, string> = {},
): ClientRecord[] {
    return clients.filter(c => hasService(c, service, websites[c.id]))
}
