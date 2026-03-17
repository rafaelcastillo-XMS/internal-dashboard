import { useEffect, useMemo, useState } from "react"
import { getClientById } from "@/features/clients/repository"
import { fetchClientProfile, mergeClientWithProfile, type ClientProfileRow } from "./profiles"
import { useTrackPageLoading } from "@/context/PageLoadingContext"

export function useClientRecord(clientId?: string) {
    const baseClient = getClientById(clientId)
    const [profile, setProfile] = useState<ClientProfileRow | null | undefined>(undefined)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useTrackPageLoading(loading, `client-record:${baseClient.id}`)

    useEffect(() => {
        let active = true

        async function loadProfile() {
            setLoading(true)
            setError(null)

            try {
                const data = await fetchClientProfile(baseClient.id)
                if (active) setProfile(data)
            } catch (err) {
                if (active) {
                    setError(err instanceof Error ? err.message : "Unable to load client profile.")
                    setProfile(null)
                }
            } finally {
                if (active) setLoading(false)
            }
        }

        void loadProfile()
        return () => {
            active = false
        }
    }, [baseClient.id])

    const client = useMemo(
        () => profile === undefined ? baseClient : mergeClientWithProfile(baseClient, profile),
        [baseClient, profile],
    )

    return { client, profile, loading, error, setProfile }
}
