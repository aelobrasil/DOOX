import { createClient } from 'npm:@supabase/supabase-js@2.57.4'

const CURRENT_TERMS_VERSION = '2.1-2026-10-13'
const PREVIOUS_TERMS_VERSION = '2.0-2026-10-12'
const acceptedTermsVersions = new Set([CURRENT_TERMS_VERSION, PREVIOUS_TERMS_VERSION])
const exactOrigins = new Set([
  'https://hocco-impulsionadores.vercel.app',
  'https://hocco-impulsionadores-aelobrasils-projects.vercel.app',
  'https://sb-6rv6yqmpy6sa.vercel.run',
  'http://localhost:3000',
])
function isAllowedOrigin(origin: string | null) {
  if (!origin) return true
  if (exactOrigins.has(origin)) return true
  try {
    const u = new URL(origin)
    return u.protocol === 'https:' && /^hocco-impulsionadores-[a-z0-9-]+-aelobrasils-projects\.vercel\.app$/i.test(u.hostname)
  } catch { return false }
}
function headersFor(origin: string | null) {
  const allowedOrigin = origin && isAllowedOrigin(origin) ? origin : 'https://hocco-impulsionadores.vercel.app'
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json; charset=utf-8',
    'Vary': 'Origin',
  }
}
function json(body: unknown, status: number, origin: string | null) { return new Response(JSON.stringify(body), { status, headers: headersFor(origin) }) }
async function sha256(value: string) { const data = new TextEncoder().encode(value); const digest = await crypto.subtle.digest('SHA-256', data); return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('') }
function onlyDigits(value: unknown) { return String(value ?? '').replace(/\D/g, '') }
function normalizePhone(value: unknown) { let phone = onlyDigits(value); if ((phone.length === 12 || phone.length === 13) && phone.startsWith('55')) phone = phone.slice(2); return phone }

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin')
  if (req.method === 'OPTIONS') { if (!isAllowedOrigin(origin)) return json({ error: 'Origem não autorizada.' }, 403, origin); return new Response('ok', { status: 200, headers: headersFor(origin) }) }
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405, origin)
  if (!isAllowedOrigin(origin)) return json({ error: 'Origem não autorizada.' }, 403, origin)

  let input: Record<string, unknown>
  try { input = await req.json() } catch { return json({ error: 'Dados inválidos.' }, 400, origin) }
  const name = String(input.name ?? '').trim().replace(/\s+/g, ' ')
  const email = String(input.email ?? '').trim().toLowerCase()
  const phone = normalizePhone(input.phone)
  const password = String(input.password ?? '')
  const accepted = input.accepted === true
  const adult = input.adult === true
  const termsVersion = String(input.terms_version ?? '')
  if (name.length < 2 || name.length > 40) return json({ error: 'Informe um nome válido.' }, 400, origin)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return json({ error: 'Informe um e-mail válido.' }, 400, origin)
  if (phone.length < 10 || phone.length > 11) return json({ error: 'Informe um telefone válido com DDD.' }, 400, origin)
  if (password.length < 8 || password.length > 72) return json({ error: 'A senha deve ter de 8 a 72 caracteres.' }, 400, origin)
  if (!adult) return json({ error: 'A versão atual do HOCCO Hype é destinada a maiores de 18 anos.' }, 400, origin)
  if (!accepted || !acceptedTermsVersions.has(termsVersion)) return json({ error: 'Aceite os Termos de Uso e a Política de Privacidade atuais.' }, 400, origin)

  const url = Deno.env.get('SUPABASE_URL')
  const secretSet = Deno.env.get('SUPABASE_SECRET_KEYS')
  let adminKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (secretSet) { try { const parsed = JSON.parse(secretSet); if (parsed?.default) adminKey = parsed.default } catch {} }
  if (!url || !adminKey) return json({ error: 'Cadastro temporariamente indisponível.' }, 503, origin)
  const admin = createClient(url, adminKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const ip = forwarded || req.headers.get('cf-connecting-ip') || 'unknown'
  const [ipHash, emailHash] = await Promise.all([sha256(ip), sha256(email)])
  const since15 = new Date(Date.now() - 15 * 60 * 1000).toISOString()
  const since60 = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const [ipCheck, emailCheck, phoneCheck] = await Promise.all([
    admin.from('impulsionadores_signup_tentativas').select('*', { count: 'exact', head: true }).eq('ip_hash', ipHash).gte('created_at', since15),
    admin.from('impulsionadores_signup_tentativas').select('*', { count: 'exact', head: true }).eq('email_hash', emailHash).gte('created_at', since60),
    admin.from('impulsionadores_contatos').select('user_id').eq('telefone', phone).limit(1),
  ])
  if (ipCheck.error || emailCheck.error || phoneCheck.error) return json({ error: 'Cadastro temporariamente indisponível.' }, 503, origin)
  if ((phoneCheck.data ?? []).length > 0) return json({ error: 'Este telefone já está vinculado a uma conta.' }, 409, origin)
  if ((ipCheck.count ?? 0) >= 5 || (emailCheck.count ?? 0) >= 3) return json({ error: 'Muitas tentativas de cadastro. Tente novamente mais tarde.' }, 429, origin)
  const attempt = await admin.from('impulsionadores_signup_tentativas').insert({ ip_hash: ipHash, email_hash: emailHash })
  if (attempt.error) return json({ error: 'Cadastro temporariamente indisponível.' }, 503, origin)

  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name, phone } })
  if (error) {
    const message = String(error.message ?? '').toLowerCase()
    if (message.includes('already') || message.includes('registered') || message.includes('exists')) return json({ error: 'Este e-mail já possui uma conta. Use Entrar.' }, 409, origin)
    if (message.includes('impulsionadores_contatos_phone_unique') || message.includes('duplicate key')) return json({ error: 'Este telefone já está vinculado a uma conta.' }, 409, origin)
    if (error.status === 422) return json({ error: 'Não foi possível criar a conta com esses dados.' }, 422, origin)
    return json({ error: 'Não foi possível criar sua conta agora.' }, error.status && error.status >= 400 && error.status < 500 ? error.status : 500, origin)
  }
  const userId = data.user?.id
  if (!userId) return json({ error: 'Não foi possível concluir o cadastro.' }, 500, origin)

  const acceptance = await admin.from('impulsionadores_aceites').upsert([
    { user_id: userId, documento: 'termos_uso', versao: PREVIOUS_TERMS_VERSION },
    { user_id: userId, documento: 'privacidade', versao: PREVIOUS_TERMS_VERSION },
    { user_id: userId, documento: 'termos_uso', versao: CURRENT_TERMS_VERSION },
    { user_id: userId, documento: 'privacidade', versao: CURRENT_TERMS_VERSION },
  ], { onConflict: 'user_id,documento,versao' })
  if (acceptance.error) { await admin.auth.admin.deleteUser(userId); return json({ error: 'Não foi possível registrar os aceites legais. Tente novamente.' }, 500, origin) }
  return json({ ok: true, user_id: userId, terms_version: CURRENT_TERMS_VERSION }, 201, origin)
})
