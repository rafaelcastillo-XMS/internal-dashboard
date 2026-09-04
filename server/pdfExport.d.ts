export function sanitizePdfFilename(name?: string): string

export function exportPdfBuffer(payload: Record<string, unknown>): Promise<Buffer>
