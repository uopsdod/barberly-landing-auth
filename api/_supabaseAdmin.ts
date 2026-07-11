// api/_supabaseAdmin.ts — service-role Supabase client for Vercel serverless functions.
// Stripe carries no user session, so the checkout + webhook functions must talk to the DB
// as a TRUSTED SERVER and write PAST RLS. NEVER import this into browser/src code — it holds
// the service-role key. Reads SUPABASE_SECRET_KEY (sb_secret_…, server-only, NOT VITE_-prefixed).
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../src/integrations/supabase/types'

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  throw new Error('Missing SUPABASE_URL / SUPABASE_SECRET_KEY for serverless function')
}

// New-format sb_secret_ keys are opaque strings, not bearer JWTs — PostgREST wants them in the
// `apikey` header (the same shim the generated browser client uses), or requests are unauthorized.
function createServiceFetch(key: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined,
    )
    if (init?.headers) new Headers(init.headers).forEach((v, k) => headers.set(k, v))
    if (headers.get('Authorization') === `Bearer ${key}`) headers.delete('Authorization')
    headers.set('apikey', key)
    return fetch(input, { ...init, headers })
  }
}

export const supabaseAdmin = createClient<Database>(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: createServiceFetch(SUPABASE_SECRET_KEY) },
})
