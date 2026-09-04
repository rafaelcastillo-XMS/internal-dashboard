export const GOOGLE_API_SCOPES: string[]

export interface GoogleAuthStatus {
  connected: boolean
  email: string | null
  requiredEmail: string
  allowed: boolean
}

export function decodeAuthReturnPath(stateParam: unknown): string
export function appendAuthResult(returnPath: string, authResult: string): string

export function getGoogleAuthStatus(requiredEmail: string, force?: boolean): Promise<GoogleAuthStatus>
export function buildGoogleAuthStartUrl(input: { redirectUri: string; returnPath: string }): string
export function completeGoogleAuthExchange(input: {
  code: string
  redirectUri: string
  requiredEmail: string
}): Promise<{ ok: true; email: string } | { ok: false; reason: "error" | "wrong-account"; email?: string | null }>

export function getGbpAuthStatus(requiredEmail: string): GoogleAuthStatus
export function buildGbpAuthStartUrl(input: { redirectUri: string; returnPath: string }): string
export function completeGbpAuthExchange(input: {
  code: string
  redirectUri: string
  requiredEmail: string
}): Promise<{ ok: true; email: string } | { ok: false; reason: "error" | "wrong-account"; email?: string | null }>

export function registerGbpAuthRoutes(app: unknown): void
export function registerGoogleAuthRoutes(app: unknown): void
