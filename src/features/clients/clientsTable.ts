import { supabase } from "@/lib/supabase"

export type ClientRecord = {
    id: string
    name: string
    status: string
    gsc_property: string | null
    ga4_property_id: string | null
    sem_account_id: string | null
    notebooklm_enabled: boolean
    notebooklm_id: string | null
    notebooklm_title: string | null
}

const COLUMNS = "id, name, status, gsc_property, ga4_property_id, sem_account_id, notebooklm_enabled, notebooklm_id, notebooklm_title"

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

    if (error) throw error
    return data as ClientRecord
}

export async function updateClientRecord(clientId: string, patch: Partial<Omit<ClientRecord, "id">>): Promise<ClientRecord> {
    const { data, error } = await supabase
        .from("clients")
        .update(patch)
        .eq("id", clientId)
        .select(COLUMNS)
        .single()

    if (error) throw error
    return data as ClientRecord
}

export async function deleteClientRecord(clientId: string): Promise<void> {
    const { error } = await supabase
        .from("clients")
        .delete()
        .eq("id", clientId)

    if (error) throw error
}
