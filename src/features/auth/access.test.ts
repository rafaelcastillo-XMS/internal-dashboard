import { describe, expect, it } from "vitest"
import { isAllowedDashboardEmail, normalizeDashboardEmail } from "./access"

describe("dashboard email access", () => {
    it("accepts Xperience USA email addresses case-insensitively", () => {
        expect(isAllowedDashboardEmail(" Rafael.Castillo@XPERIENCEUSA.COM ")).toBe(true)
    })

    it.each([
        "xperienceusa.com@example.com",
        "user@sub.xperienceusa.com",
        "xperienceusa@gmail.com",
        "",
    ])("rejects non-team address %s", email => {
        expect(isAllowedDashboardEmail(email)).toBe(false)
    })

    it("normalizes the address used for role lookup", () => {
        expect(normalizeDashboardEmail(" User@XperienceUSA.com ")).toBe("user@xperienceusa.com")
    })
})
