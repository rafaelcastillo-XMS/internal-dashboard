import { useEffect, useMemo, useState } from "react"
import type { Client } from "@/data/dummy"
import { getClients } from "@/features/clients/repository"
import { fetchClientRecord, type ClientRecord } from "./clientsTable"
import { fetchClientProfile, mergeClientWithProfile, type ClientProfileRow } from "./profiles"
import { useTrackPageLoading } from "@/context/PageLoadingContext"

const AVATAR_COLORS = [
    'bg-blue-600', 'bg-violet-600', 'bg-amber-600', 'bg-rose-600',
    'bg-cyan-600', 'bg-indigo-600', 'bg-teal-600', 'bg-emerald-600',
]

export function clientColor(id: string): string {
    let hash = 0
    for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
    return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

export function clientInitials(name: string): string {
    const words = name.trim().split(/\s+/)
    return words.length >= 2
        ? (words[0][0] + words[1][0]).toUpperCase()
        : name.substring(0, 2).toUpperCase()
}

function baseClientFrom(clientId: string, record: ClientRecord | null): Client {
    const dummy = getClients().find(c => c.id === clientId)
    const name = record?.name ?? dummy?.name ?? clientId

    return {
        ...(dummy ?? {
            id: clientId,
            industry: "",
            contact: "",
            role: "",
            email: "",
            location: "",
            avatar: "",
            tagColor: "",
            note: "",
            pocOwnerName: "",
            levelOfService: "",
            phone: "",
            website: "",
            geoTargets: "",
            nextInteraction: "",
            customersProLink: "",
        }),
        id: clientId,
        name,
        initials: clientInitials(name),
        color: dummy?.color ?? clientColor(clientId),
        status: (record?.status ?? dummy?.status ?? "active") === "active" ? "active" : "inactive",
    }
}

export function useClientRecord(clientId?: string) {
    const id = clientId ?? "holts-garage"
    const [record, setRecord] = useState<ClientRecord | null>(null)
    const [profile, setProfile] = useState<ClientProfileRow | null | undefined>(undefined)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useTrackPageLoading(loading, `client-record:${id}`)

    useEffect(() => {
        let active = true

        async function load() {
            setLoading(true)
            setError(null)

            try {
                const [rec, prof] = await Promise.all([
                    fetchClientRecord(id),
                    fetchClientProfile(id),
                ])
                if (active) {
                    setRecord(rec)
                    setProfile(prof)
                }
            } catch (err) {
                if (active) {
                    setError(err instanceof Error ? err.message : "Unable to load client.")
                    setProfile(null)
                }
            } finally {
                if (active) setLoading(false)
            }
        }

        void load()
        return () => {
            active = false
        }
    }, [id])

    const client = useMemo(
        () => mergeClientWithProfile(baseClientFrom(id, record), profile ?? null),
        [id, record, profile],
    )

    return { client, profile, record, loading, error, setProfile, setRecord }
}
