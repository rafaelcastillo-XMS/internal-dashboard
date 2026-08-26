import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { SMTPClient } from "https://deno.land/x/denomailer/mod.ts"
import { CORS_HEADERS as CORS } from "../_shared/cors.ts"

const SENDER_ADDRESS = Deno.env.get("EVA_GMAIL_ADDRESS") || "eva@xperienceusa.com"
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface TableImage {
  label: string
  dataUrl: string
  width: number
  height: number
}

const MAX_IMAGE_WIDTH = 640
const BODY_FONT_PX = 18
const TITLE_FONT_PX = BODY_FONT_PX * 2.5

interface SendReportEmailBody {
  to: string
  subject: string
  title?: string
  bodyText: string
  images?: TableImage[]
  pdfBase64?: string
  pdfFilename?: string
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

// Quoted-printable encodes a trailing space before a line break as "=20".
// That's correct and normally invisible — decent mail clients unescape it —
// but our multi-line template-literal HTML had lots of incidental indentation
// whitespace sitting right at those line breaks, and it was showing up as
// literal "=20" in the received message. Collapsing to one line removes the
// trailing-space-before-newline pattern entirely, so there's nothing to leak.
function collapseHtmlWhitespace(html: string): string {
  return html.replace(/\n\s*/g, " ").trim()
}

function titleToHtml(title: string): string {
  return `<h1 style="margin:0 0 20px;color:#0f172a;font-size:${TITLE_FONT_PX}px;font-weight:600;line-height:1.25;">${escapeHtml(title)}</h1>`
}

function bodyTextToHtml(bodyText: string): string {
  return bodyText
    .split(/\n{2,}/)
    .map((paragraph) => `<p style="margin:0 0 16px;color:#0f172a;font-size:${BODY_FONT_PX}px;line-height:1.6;">${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("")
}

// Inline `<img src="data:...">` is unreliable — Gmail (and others) commonly
// strip or refuse to render base64 data URIs in HTML mail, which is why the
// tables showed up missing entirely. CID-embedded attachments (referenced as
// `cid:xxx` and delivered as real MIME parts) are the standard, reliable way
// to inline an image without hosting it anywhere.
function imagesToHtml(images: TableImage[]): string {
  return images
    .map(({ label, width, height }, index) => {
      // Some email clients (Outlook, some Gmail views) strip the inline
      // `style` attribute and fall back to the <img> tag's raw width/height
      // — without real HTML attributes the image renders at its full
      // physical pixel size (2x, since the source canvas is scale:2).
      const displayWidth = Math.min(width, MAX_IMAGE_WIDTH)
      const displayHeight = Math.round(height * (displayWidth / width))
      return `
        <h4 style="margin:24px 0 10px;color:#1A72D9;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">${escapeHtml(label)}</h4>
        <img src="cid:${tableImageCid(index)}" alt="${escapeHtml(label)}" width="${displayWidth}" height="${displayHeight}" style="width:100%;max-width:${MAX_IMAGE_WIDTH}px;height:auto;display:block;border:1px solid #e5e7eb;border-radius:8px;" />
      `
    })
    .join("")
}

function tableImageCid(index: number): string {
  return `table-image-${index}`
}

function extractBase64(dataUrlOrBase64: string): string {
  const commaIndex = dataUrlOrBase64.indexOf(",")
  return dataUrlOrBase64.startsWith("data:") && commaIndex !== -1
    ? dataUrlOrBase64.slice(commaIndex + 1)
    : dataUrlOrBase64
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })

  try {
    const body = await req.json() as SendReportEmailBody
    const { to, subject, title, bodyText, images = [], pdfBase64, pdfFilename } = body

    if (!to || !EMAIL_RE.test(to)) throw new Error("A valid recipient email is required")
    if (!subject) throw new Error("A subject is required")

    const appPassword = Deno.env.get("EVA_GMAIL_APP_PASSWORD")
    if (!appPassword) throw new Error("EVA_GMAIL_APP_PASSWORD is not configured")

    const html = collapseHtmlWhitespace(`
      <div style="font-family:Inter,system-ui,-apple-system,sans-serif;max-width:760px;margin:0 auto;">
        ${title ? titleToHtml(title) : ""}
        ${bodyTextToHtml(bodyText)}
        ${imagesToHtml(images)}
      </div>
    `)

    const imageAttachments = images.map((image, index) => ({
      filename: `${tableImageCid(index)}.png`,
      content: extractBase64(image.dataUrl),
      encoding: "base64" as const,
      contentType: "image/png",
      contentID: tableImageCid(index),
    }))

    const pdfAttachment = pdfBase64 && pdfFilename
      ? [{
          filename: pdfFilename,
          content: extractBase64(pdfBase64),
          encoding: "base64" as const,
          contentType: "application/pdf",
        }]
      : []

    const attachments = [...imageAttachments, ...pdfAttachment]

    const client = new SMTPClient({
      connection: {
        hostname: "smtp.gmail.com",
        port: 465,
        tls: true,
        auth: { username: SENDER_ADDRESS, password: appPassword },
      },
    })

    await client.send({
      from: `XMS Reports <${SENDER_ADDRESS}>`,
      to,
      subject,
      html,
      content: bodyText.split("\n").map((line) => line.trimEnd()).join("\n"),
      attachments,
    })
    await client.close()

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    })
  }
})
