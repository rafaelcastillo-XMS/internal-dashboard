import { createClient } from "@supabase/supabase-js"

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

// Fallback para evitar crash si las vars no están en build time
export const supabase = createClient(
    supabaseUrl || "",
    supabaseAnonKey || ""
)