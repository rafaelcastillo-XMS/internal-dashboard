import { createClient } from "@supabase/supabase-js"

// Anon keys are public by design — safe to hardcode directly.
// Do NOT use import.meta.env here: the deployment platform may have stale or
// incorrect VITE_SUPABASE_* build args that would override any fallback.
export const supabase = createClient(
    "https://sjpvyxdyleebhqlmqscy.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqcHZ5eGR5bGVlYmhxbG1xc2N5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNzgxODksImV4cCI6MjA4ODc1NDE4OX0.ZvzbBm-L8Jt3FzhmmX3qd7_inwrupjQrfh9JWIlX1ng"
)