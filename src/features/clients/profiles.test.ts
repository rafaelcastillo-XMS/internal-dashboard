import { describe, expect, it } from "vitest"
import { createClientProfileForm, mergeClientWithProfile, type ClientProfileRow } from "@/features/clients/profiles"
import { clients } from "@/data/dummy"

describe("client profiles", () => {
    const baseClient = clients.find(client => client.id === "holts-garage")!

    it("creates a form seeded from the base client when no profile exists", () => {
        const form = createClientProfileForm(baseClient, null)

        expect(form.logoUrl).toBe(baseClient.avatar)
        expect(form.logoStoragePath).toBe("")
        expect(form.pocOwnerName).toBe(baseClient.pocOwnerName)
        expect(form.email).toBe(baseClient.email)
    })

    it("creates a form seeded from Supabase profile values when available", () => {
        const profile: ClientProfileRow = {
            client_id: baseClient.id,
            logo_url: "https://cdn.example.com/holts-logo.png",
            logo_storage_path: "holts-garage/logo.png",
            poc_owner_name: "Updated Owner",
            level_of_service: "Premium",
            industry: "Auto Service",
            location: "Miami, USA",
            phone: "+1 555 000 0000",
            email: "new@holtsgarage.com",
            website: "https://new-holts.example.com",
            created_at: "2026-03-17T00:00:00Z",
            updated_at: "2026-03-17T00:00:00Z",
        }

        const form = createClientProfileForm(baseClient, profile)

        expect(form.logoUrl).toBe(profile.logo_url)
        expect(form.logoStoragePath).toBe(profile.logo_storage_path)
        expect(form.pocOwnerName).toBe(profile.poc_owner_name)
        expect(form.website).toBe(profile.website)
    })

    it("merges Supabase profile data into the client record", () => {
        const profile: ClientProfileRow = {
            client_id: baseClient.id,
            logo_url: "https://cdn.example.com/holts-logo.png",
            logo_storage_path: "holts-garage/logo.png",
            poc_owner_name: "Updated Owner",
            level_of_service: "Premium",
            industry: "Auto Service",
            location: "Miami, USA",
            phone: "+1 555 000 0000",
            email: "new@holtsgarage.com",
            website: "https://new-holts.example.com",
            created_at: "2026-03-17T00:00:00Z",
            updated_at: "2026-03-17T00:00:00Z",
        }

        const merged = mergeClientWithProfile(baseClient, profile)

        expect(merged.avatar).toBe(profile.logo_url)
        expect(merged.pocOwnerName).toBe(profile.poc_owner_name)
        expect(merged.levelOfService).toBe(profile.level_of_service)
        expect(merged.location).toBe(profile.location)
        expect(merged.website).toBe(profile.website)
    })
})
