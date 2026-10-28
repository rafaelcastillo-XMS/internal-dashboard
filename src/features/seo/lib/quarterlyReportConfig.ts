export interface QuarterlyReportPeriod {
  startDate: string
  endDate: string
}

export function getQuarterlyMonthLabels(endDate: string, locale = 'en-US') {
  const [year, month] = endDate.split('-').map(Number)
  const endMonth = new Date(Date.UTC(year, month - 1, 1))
  const formatter = new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })

  return [2, 1, 0].map((monthsAgo) => {
    const date = new Date(Date.UTC(endMonth.getUTCFullYear(), endMonth.getUTCMonth() - monthsAgo, 1))
    return formatter.format(date)
  })
}

export const GBP_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const
export const MAX_GBP_IMAGE_BYTES = 10 * 1024 * 1024
export const MAX_GBP_IMAGES = 3
const MAX_GBP_IMAGE_SIDE = 2000

export interface GbpReportImage {
  id: string
  name: string
  dataUrl: string
}

/** Prepare a selection atomically so a failed file never discards existing previews. */
export async function prepareGbpImageSelection(
  files: File[],
  existing: GbpReportImage[],
  replaceId?: string,
  prepare: (file: File) => Promise<string> = prepareGbpImageDataUrl,
): Promise<GbpReportImage[]> {
  if (!files.length) return existing
  if (replaceId && !existing.some(image => image.id === replaceId)) throw new Error('The image to replace is no longer available.')
  if (replaceId ? files.length !== 1 : existing.length + files.length > MAX_GBP_IMAGES) {
    throw new Error(replaceId ? 'Choose one replacement image.' : `You can add up to ${MAX_GBP_IMAGES} Google Business Profile images.`)
  }
  const prepared: GbpReportImage[] = []
  // Decode sequentially to bound memory usage for multiple large local files.
  for (const file of files) {
    prepared.push({ id: replaceId ?? crypto.randomUUID(), name: file.name, dataUrl: await prepare(file) })
  }
  return replaceId ? existing.map(image => image.id === replaceId ? prepared[0] : image) : [...existing, ...prepared]
}

export function isSupportedGbpImage(file: Pick<Blob, 'type'>) {
  return GBP_IMAGE_TYPES.includes(file.type as (typeof GBP_IMAGE_TYPES)[number])
}

function matchesImageSignature(bytes: Uint8Array, type: string) {
  if (type === 'image/png') {
    return bytes.length >= 8
      && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value)
  }
  if (type === 'image/jpeg') {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  }
  if (type === 'image/webp') {
    return bytes.length >= 12
      && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF'
      && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  }
  return false
}

export async function validateGbpImageFile(file: Blob) {
  if (!isSupportedGbpImage(file)) return 'Please select a PNG, JPG, or WEBP image.'
  if (file.size === 0) return 'The selected image is empty.'
  if (file.size > MAX_GBP_IMAGE_BYTES) return 'The image must be 10 MB or smaller.'

  const signature = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  return matchesImageSignature(signature, file.type) ? null : 'The selected file does not contain a valid image.'
}

function blobToDataUrl(file: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
    reader.onerror = () => reject(new Error('The image could not be read.'))
    reader.readAsDataURL(file)
  })
}

export async function prepareGbpImageDataUrl(file: File) {
  const validationError = await validateGbpImageFile(file)
  if (validationError) throw new Error(validationError)

  const source = await blobToDataUrl(file)
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image()
    element.onload = () => resolve(element)
    element.onerror = () => reject(new Error('The selected file could not be decoded as an image.'))
    element.src = source
  })

  const scale = Math.min(1, MAX_GBP_IMAGE_SIDE / image.naturalWidth, MAX_GBP_IMAGE_SIDE / image.naturalHeight)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('The image could not be prepared for the PDF.')

  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  return file.type === 'image/png'
    ? canvas.toDataURL('image/png')
    : canvas.toDataURL('image/jpeg', 0.9)
}
