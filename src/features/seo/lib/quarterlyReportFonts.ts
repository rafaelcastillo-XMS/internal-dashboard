import regularUrl from '../assets/fonts/Lato-Regular.ttf?url'
import boldUrl from '../assets/fonts/Lato-Bold.ttf?url'
import displayUrl from '../assets/fonts/DMSerifDisplay-Regular.ttf?url'
import type { ReportFonts } from './quarterlyReportDesign'

let fontsPromise: Promise<ReportFonts | undefined> | undefined

async function loadFont(url: string) {
  const response = await fetch(url)
  if (!response.ok) throw new Error('Report font could not be loaded')
  const bytes = new Uint8Array(await response.arrayBuffer())
  let binary = ''
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192))
  return btoa(binary)
}

/** Fonts ship with the app. A temporary asset failure still permits PDF export. */
export function loadQuarterlyReportFonts() {
  if (!fontsPromise) {
    fontsPromise = Promise.all([loadFont(regularUrl), loadFont(boldUrl), loadFont(displayUrl)])
      .then(([regular, bold, display]) => ({ regular, bold, display }))
      .catch(() => {
        fontsPromise = undefined
        return undefined
      })
  }
  return fontsPromise
}
