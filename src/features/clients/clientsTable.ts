import { supabase } from "@/lib/supabase"

export type ClientRecord = {
    id: string
    name: string
    status: string
    gsc_property: string | null
    ga4_property_id: string | null
    sem_account_id: string | null
    lsa_account_id: string | null
    sem_enabled: boolean
}

const COLUMNS = "id, name, status, gsc_property, ga4_property_id, sem_account_id, lsa_account_id, sem_enabled"

type DatabaseError = { code?: string; message?: string; details?: string }

export function clientMutationError(error: DatabaseError, operation: "create" | "update") {
    if (error.code !== "23505") return new Error(error.message || "Unable to save client.")

    const source = `${error.message ?? ""} ${error.details ?? ""}`
    if (source.includes("clients_gsc_property_uq")) return new Error("This Search Console property is already assigned to another client.")
    if (source.includes("clients_ga4_property_id_uq")) return new Error("This GA4 property is already assigned to another client.")
    if (source.includes("clients_sem_account_id_uq")) return new Error("This Google Ads account is already assigned to another client.")
    if (operation === "create") return new Error("A client with this name already exists.")
    return new Error("This integration is already assigned to another client.")
}

export async function fetchClientRecords(): Promise<ClientRecord[]> {
    const { data, error } = await supabase
        .from("clients")
        .select(COLUMNS)
        .order("name")

    if (error) throw error
    return (data ?? []) as ClientRecord[]
}

export async function fetchClientRecord(clientId: string): Promise<ClientRecord | null> {
    const { data, error } = await supabase
        .from("clients")
        .select(COLUMNS)
        .eq("id", clientId)
        .maybeSingle()

    if (error) throw error
    return data as ClientRecord | null
}

export async function createClientRecord(name: string): Promise<ClientRecord> {
    const id = name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")

    const { data, error } = await supabase
        .from("clients")
        .insert({ id, name })
        .select(COLUMNS)
        .single()

    if (error) throw clientMutationError(error, "create")
    return data as ClientRecord
}

export async function updateClientRecord(clientId: string, patch: Partial<Omit<ClientRecord, "id">>): Promise<ClientRecord> {
    const { data, error } = await supabase
        .from("clients")
        .update(patch)
        .eq("id", clientId)
        .select(COLUMNS)
        .single()

    if (error) throw clientMutationError(error, "update")
    return data as ClientRecord
}

export async function deleteClientRecord(clientId: string): Promise<void> {
    const { error } = await supabase
        .from("clients")
        .delete()
        .eq("id", clientId)

    if (error) throw error
}
