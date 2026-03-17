import type { Client } from "@/data/dummy"
import { supabase } from "@/lib/supabase"

export type ClientProfileRow = {
    client_id: string
    logo_url: string | null
    logo_storage_path: string | null
    poc_owner_name: string | null
    level_of_service: string | null
    industry: string | null
    location: string | null
    phone: string | null
    email: string | null
    website: string | null
    created_at: string
    updated_at: string
}

export type ClientProfileForm = {
    logoUrl: string
    logoStoragePath: string
    pocOwnerName: string
    levelOfService: string
    industry: string
    location: string
    phone: string
    email: string
    website: string
}

export function createClientProfileForm(client: Client, profile?: ClientProfileRow | null): ClientProfileForm {
    return {
        logoUrl: profile?.logo_url ?? client.avatar ?? "",
        logoStoragePath: profile?.logo_storage_path ?? "",
        pocOwnerName: profile?.poc_owner_name ?? client.pocOwnerName,
        levelOfService: profile?.level_of_service ?? client.levelOfService,
        industry: profile?.industry ?? client.industry,
        location: profile?.location ?? client.location,
        phone: profile?.phone ?? client.phone,
        email: profile?.email ?? client.email,
        website: profile?.website ?? client.website,
    }
}

export function mergeClientWithProfile(client: Client, profile?: ClientProfileRow | null): Client {
    if (!profile) return client

    return {
        ...client,
        avatar: profile.logo_url ?? client.avatar,
        pocOwnerName: profile.poc_owner_name ?? client.pocOwnerName,
        levelOfService: profile.level_of_service ?? client.levelOfService,
        industry: profile.industry ?? client.industry,
        location: profile.location ?? client.location,
        phone: profile.phone ?? client.phone,
        email: profile.email ?? client.email,
        website: profile.website ?? client.website,
    }
}

export async function fetchClientProfile(clientId: string) {
    const { data, error } = await supabase
        .from("client_profiles")
        .select("*")
        .eq("client_id", clientId)
        .maybeSingle()

    if (error) throw error
    return data as ClientProfileRow | null
}

export async function saveClientProfile(clientId: string, form: ClientProfileForm) {
    const payload = {
        client_id: clientId,
        logo_url: form.logoUrl || null,
        logo_storage_path: form.logoStoragePath || null,
        poc_owner_name: form.pocOwnerName || null,
        level_of_service: form.levelOfService || null,
        industry: form.industry || null,
        location: form.location || null,
        phone: form.phone || null,
        email: form.email || null,
        website: form.website || null,
    }

    const { data, error } = await supabase
        .from("client_profiles")
        .upsert(payload, { onConflict: "client_id" })
        .select("*")
        .single()

    if (error) throw error
    return data as ClientProfileRow
}

export async function uploadClientLogo(clientId: string, file: File, previousPath?: string | null) {
    const extension = file.name.includes(".") ? file.name.split(".").pop()?.toLowerCase() ?? "png" : "png"
    const filePath = `${clientId}/logo-${Date.now()}.${extension}`

    const { error: uploadError } = await supabase
        .storage
        .from("client-assets")
        .upload(filePath, file, {
            cacheControl: "3600",
            upsert: false,
        })

    if (uploadError) throw uploadError

    const { data } = supabase.storage.from("client-assets").getPublicUrl(filePath)

    if (previousPath && previousPath !== filePath) {
        const { error: removeError } = await supabase.storage.from("client-assets").remove([previousPath])
        if (removeError) {
            console.warn("[client-assets] previous logo cleanup failed:", removeError.message)
        }
    }

    return {
        logoUrl: data.publicUrl,
        logoStoragePath: filePath,
    }
}
