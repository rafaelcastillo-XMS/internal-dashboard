import { afterEach, describe, expect, it, vi } from "vitest"
import fs from "fs"

import { usesSharedSeoAccount } from "./gbpReport.js"

function sharedTokenOnDisk(present) {
  vi.spyOn(fs, "readFileSync").mockImplementation(() => {
    if (!present) throw new Error("ENOENT")
    return JSON.stringify({ refresh_token: "shared-refresh-token" })
  })
}

afterEach(() => {
  vi.restoreAllMocks()
  delete process.env.SEO_GOOGLE_ACCOUNT
})

describe("Search Console / GA4 account selection", () => {
  it("stays on the main account until the switch is set", () => {
    sharedTokenOnDisk(true)
    expect(usesSharedSeoAccount()).toBe(false)
  })

  it("stays on the main account when the switch is set but nobody connected the shared account", () => {
    sharedTokenOnDisk(false)
    process.env.SEO_GOOGLE_ACCOUNT = "shared"
    expect(usesSharedSeoAccount()).toBe(false)
  })

  it("moves to the shared account only with both the switch and a connected token", () => {
    sharedTokenOnDisk(true)
    process.env.SEO_GOOGLE_ACCOUNT = "shared"
    expect(usesSharedSeoAccount()).toBe(true)
  })
})
