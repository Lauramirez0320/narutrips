import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const supabaseConfigError = !supabaseUrl || !supabaseKey
  ? 'Falta la configuración de Supabase. Define VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY en .env.local.'
  : null

export const supabase = supabaseConfigError
  ? null
  : createClient(supabaseUrl, supabaseKey)
