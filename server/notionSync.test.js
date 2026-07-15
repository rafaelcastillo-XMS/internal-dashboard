import { describe, expect, it, vi } from "vitest"
import {
  NotionApiClient,
  extractNotionClientData,
  findNotionClientPage,
} from "./notionSync.js"

function page(id, properties, icon = null) {
  return { object: "page", id, in_trash: false, properties, icon }
}

const title = value => ({ type: "title", title: [{ plain_text: value }] })
const richText = value => ({ type: "rich_text", rich_text: [{ plain_text: value }] })

describe("Notion client mapping", () => {
  it("extracts an external logo and numeric monthly SEM budget", () => {
    const result = extractNotionClientData(page("notion-1", {
      "Client Name": title("AquaSeekers"),
      "Dashboard Client ID": richText("aquaseekers"),
      Logo: {
        type: "files",
        files: [{ name: "logo.png", type: "external", external: { url: "https://cdn.example.com/logo.png" } }],
      },
      "Monthly SEM Budget": { type: "number", number: 4500 },
    }))

    expect(result).toMatchObject({
      pageId: "notion-1",
      dashboardClientId: "aquaseekers",
      name: "AquaSeekers",
      logo: { url: "https://cdn.example.com/logo.png", name: "logo.png" },
      monthlySemBudget: 4500,
    })
  })

  it("extracts a logo from a Notion URL property", () => {
    const result = extractNotionClientData(page("notion-url", {
      Name: title("URL Logo Client"),
      Logo: { type: "url", url: "https://cdn.example.com/client-logo.webp" },
    }))

    expect(result.logo).toEqual({
      url: "https://cdn.example.com/client-logo.webp",
      name: "external-logo",
    })
  })

  it("matches by stable dashboard ID before falling back to normalized name", () => {
    const pages = [
      page("wrong", { Name: title("AquaSeekers"), "Dashboard Client ID": richText("another-client") }),
      page("right", { Name: title("Different display name"), "Dashboard Client ID": richText("aquaseekers") }),
    ]
    expect(findNotionClientPage(pages, { id: "aquaseekers", name: "AquaSeekers" })?.id).toBe("right")
  })

  it("does not match by name when the Notion row belongs to another dashboard client ID", () => {
    const pages = [
      page("other-client", { Name: title("AquaSeekers"), "Dashboard Client ID": richText("different-client") }),
    ]

    expect(findNotionClientPage(pages, { id: "aquaseekers", name: "AquaSeekers" })).toBeNull()
  })

  it("rejects ambiguous name-only matches", () => {
    const pages = [
      page("one", { Name: title("Holt's Garage") }),
      page("two", { Name: title("Holts Garage") }),
    ]
    expect(() => findNotionClientPage(pages, { id: "holts-garage", name: "Holt's Garage" }))
      .toThrow("Multiple Notion records match")
  })
})

describe("Notion API client", () => {
  it("does not expose the API key in authentication errors", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 401 })
    const notion = new NotionApiClient({ apiKey: "ntn_super_secret", dataSourceId: "source-id", fetchImpl })
    await expect(notion.queryAllPages()).rejects.toThrow("Notion rejected NOTION_API_KEY")
    await expect(notion.queryAllPages()).rejects.not.toThrow("ntn_super_secret")
  })

  it("rejects an incomplete paginated response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        results: [],
        has_more: false,
        next_cursor: null,
        request_status: { type: "incomplete" },
      }),
    })
    const notion = new NotionApiClient({ apiKey: "ntn_test", dataSourceId: "source-id", fetchImpl })

    await expect(notion.queryAllPages()).rejects.toThrow("incomplete data-source response")
  })
})
