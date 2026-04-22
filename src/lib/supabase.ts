import { createClient } from "@supabase/supabase-js"

// Anon keys are public by design — safe to hardcode as fallback.
// This ensures the client always works regardless of Docker ARG/ENV passing.
const SUPABASE_URL = "https://sjpvyxdyleebhqlmqscy.supabase.co"
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqcHZ5eGR5bGVlYmhxbG1xc2N5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNzgxODksImV4cCI6MjA4ODc1NDE4OX0.ZvzbBm-L8Jt3FzhmmX3qd7_inwrupjQrfh9JWIlX1ng"

export const supabase = createClient(
    (import.meta.env.VITE_SUPABASE_URL as string) || SUPABASE_URL,
    (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || SUPABASE_ANON_KEY
)