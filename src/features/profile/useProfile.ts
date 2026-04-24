import { useEffect, useState, useCallback } from "react"
import { supabase } from "@/lib/supabase"

export interface ProfileData {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string
  role: string
  company: string
  location: string
  bio: string
  website: string
  twitter: string
  linkedin: string
  instagram: string
  avatar_url: string
}

const DEFAULTS: Omit<ProfileData, "id" | "email"> = {
  first_name: "",
  last_name: "",
  phone: "",
  role: "",
  company: "",
  location: "",
  bio: "",
  website: "",
  twitter: "",
  linkedin: "",
  instagram: "",
  avatar_url: "",
}

export function useProfile() {
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session || cancelled) { setLoading(false); return }

      const userId = session.user.id
      const email = session.user.email ?? ""
      const meta = session.user.user_metadata ?? {}

      const { data, error: fetchError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single()

      if (cancelled) return

      if (fetchError && fetchError.code !== "PGRST116") {
        setError(fetchError.message)
        setLoading(false)
        return
      }

      if (data) {
        setProfile({ ...data, email })
      } else {
        // First login: seed from auth metadata
        const fullName: string = meta.full_name ?? meta.name ?? ""
        const [first = "", ...rest] = fullName.split(" ")
        const seeded: Omit<ProfileData, "email"> = {
          id: userId,
          first_name: first,
          last_name: rest.join(" "),
          phone: DEFAULTS.phone,
          role: meta.role ?? DEFAULTS.role,
          company: DEFAULTS.company,
          location: DEFAULTS.location,
          bio: DEFAULTS.bio,
          website: DEFAULTS.website,
          twitter: DEFAULTS.twitter,
          linkedin: DEFAULTS.linkedin,
          instagram: DEFAULTS.instagram,
          avatar_url: meta.picture ?? meta.avatar_url ?? "",
        }
        await supabase.from("profiles").upsert(seeded)
        if (!cancelled) setProfile({ ...seeded, email })
      }

      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [])

  const save = useCallback(async (updates: Partial<Omit<ProfileData, "id" | "email">>) => {
    if (!profile) return { ok: false, message: "Not loaded" }
    setSaving(true)
    setError(null)

    const { error: upsertError } = await supabase
      .from("profiles")
      .upsert({ id: profile.id, ...updates, updated_at: new Date().toISOString() })

    setSaving(false)
    if (upsertError) {
      setError(upsertError.message)
      return { ok: false, message: upsertError.message }
    }

    setProfile(prev => prev ? { ...prev, ...updates } : prev)
    return { ok: true, message: "Profile saved successfully." }
  }, [profile])

  return { profile, loading, saving, error, save, setProfile }
}
