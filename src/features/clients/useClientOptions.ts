import { useEffect, useState } from "react"
import { fetchClientRecords } from "./clientsTable"
import { fetchClientProfiles } from "./profiles"
import { clientsWithService, type ClientService } from "./clientServices"

export interface ClientOption {
    id: string
    name: string
    website: string
}

/**
 * The clients a module should offer, straight from Supabase. Replaces the
 * per-module hardcoded lists so a client added today shows up everywhere it
 * qualifies without a deploy.
 */
export function useClientOptions(service: ClientService) {
    const [options, setOptions] = useState<ClientOption[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let active = true

        Promise.all([fetchClientRecords(), fetchClientProfiles().catch(() => [])])
            .then(([records, profiles]) => {
                if (!active) return
                const websites = Object.fromEntries(
                    profiles.filter(p => p.website).map(p => [p.client_id, p.website as string]),
                )
                setOptions(
                    clientsWithService(records, service, websites)
                        .map(c => ({ id: c.id, name: c.name, website: websites[c.id] ?? "" })),
                )
            })
            .catch(() => { if (active) setOptions([]) })
            .finally(() => { if (active) setLoading(false) })

        return () => { active = false }
    }, [service])

    return { options, loading }
}
