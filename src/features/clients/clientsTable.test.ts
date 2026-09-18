import { describe, expect, it } from "vitest"
import { clientMutationError } from "./clientsTable"

describe("client mutation errors", () => {
    it.each([
        ["clients_gsc_property_uq", "Search Console"],
        ["clients_ga4_property_id_uq", "GA4"],
        ["clients_sem_account_id_uq", "Google Ads"],
    ])("names the duplicated integration for %s", (constraint, label) => {
        const error = clientMutationError({ code: "23505", message: `violates ${constraint}` }, "update")
        expect(error.message).toContain(label)
    })

    it("explains a duplicated client name during creation", () => {
        const error = clientMutationError({ code: "23505", message: "duplicate key" }, "create")
        expect(error.message).toBe("A client with this name already exists.")
    })

    it("preserves useful database errors", () => {
        const error = clientMutationError({ code: "42501", message: "Not authorized" }, "update")
        expect(error.message).toBe("Not authorized")
    })
})
