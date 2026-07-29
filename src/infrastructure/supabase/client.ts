import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    'Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. Copia .env.example como .env y complétalo.'
  )
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // La app vive bajo un HashRouter en GitHub Pages: los enlaces de
    // confirmación y recuperación llegan con el token en el fragmento.
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
})

/** URL pública de la app, para armar los enlaces de los correos. */
export const URL_APP = `${window.location.origin}${import.meta.env.BASE_URL}`
