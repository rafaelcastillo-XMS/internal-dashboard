import { describe, it, expect } from "vitest"
import { hasService, lsaAccount, clientsWithService } from "@/features/clients/clientServices"
import type { ClientRecord } from "@/features/clients/clientsTable"

const base: ClientRecord = {
    id: "acme", name: "Acme", status: "active",
    gsc_property: null, ga4_property_id: null,
    sem_account_id: null, lsa_account_id: null, sem_enabled: false,
    notebooklm_enabled: false, notebooklm_id: null, notebooklm_title: null,
}

describe("clientServices", () => {
    it("derives SEO from either Google property", () => {
        expect(hasService(base, "seo")).toBe(false)
        expect(hasService({ ...base, gsc_property: "sc-domain:acme.com" }, "seo")).toBe(true)
        expect(hasService({ ...base, ga4_property_id: "123" }, "seo")).toBe(true)
    })

    it("requires both the flag and the account for SEM", () => {
        expect(hasService({ ...base, sem_account_id: "111" }, "sem")).toBe(false)
        expect(hasService({ ...base, sem_enabled: true }, "sem")).toBe(false)
        expect(hasService({ ...base, sem_enabled: true, sem_account_id: "111" }, "sem")).toBe(true)
    })

    it("falls back to the Ads account for LSA, and prefers a dedicated one", () => {
        expect(lsaAccount({ ...base, sem_enabled: true, sem_account_id: "111" })).toBe("111")
        expect(lsaAccount({ ...base, sem_enabled: true, sem_account_id: "111", lsa_account_id: "222" })).toBe("222")
        expect(lsaAccount(base)).toBe(null)
    })

    it("needs a website for Design", () => {
        expect(hasService(base, "design")).toBe(false)
        expect(hasService(base, "design", "https://acme.com")).toBe(true)
    })

    it("excludes inactive clients from every module", () => {
        const inactive = { ...base, status: "inactive", gsc_property: "sc-domain:acme.com" }
        expect(hasService(inactive, "seo")).toBe(false)
        expect(hasService(inactive, "social")).toBe(false)
    })

    it("filters a list by service", () => {
        const clients = [
            { ...base, id: "seo-only", gsc_property: "sc-domain:a.com" },
            { ...base, id: "ads-only", sem_enabled: true, sem_account_id: "111" },
        ]
        expect(clientsWithService(clients, "seo").map(c => c.id)).toEqual(["seo-only"])
        expect(clientsWithService(clients, "sem").map(c => c.id)).toEqual(["ads-only"])
    })
})
