/**
 * server/pdfExport.js
 * Shared ReportLab PDF export (tools/pdf_export.py), used by both the
 * production server (server.js) and the Vite dev middleware (vite.config.ts).
 */

import fs from "fs"
import os from "os"
import path from "path"
import { fileURLToPath } from "url"
import { execFile } from "child_process"
import { promisify } from "util"

const execFileAsync = promisify(execFile)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PDF_EXPORT_SCRIPT = path.resolve(__dirname, "..", "tools", "pdf_export.py")
const REPO_ROOT = path.resolve(__dirname, "..")

export function sanitizePdfFilename(name = "xms-report.pdf") {
  return String(name).replace(/["\r\n\\]/g, "").replace(/[^a-zA-Z0-9._\- ]/g, "_") || "xms-report.pdf"
}

export async function exportPdfBuffer(payload) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), ".pdf-export-"))
  const inputPath = path.join(tmpDir, "payload.json")
  const outputPath = path.join(tmpDir, "report.pdf")
  try {
    fs.writeFileSync(inputPath, JSON.stringify(payload))
    await execFileAsync("python3", [PDF_EXPORT_SCRIPT, "--input", inputPath, "--output", outputPath], {
      cwd: REPO_ROOT,
      timeout: 60_000,
    })
    return fs.readFileSync(outputPath)
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}
