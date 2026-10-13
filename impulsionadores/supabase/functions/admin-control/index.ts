import { createClient } from 'npm:@supabase/supabase-js@2.57.4'

const PROD_ORIGIN = 'https://hocco-impulsionadores.vercel.app'
function originAllowed(origin: string | null) {
  if (!origin) return true
  try {
    const u = new URL(origin)
    return origin === PROD_ORIGIN || origin === 'http://localhost:3000' || (u.protocol === 'https:' && u.hostname.endsWith('.vercel.app') && u.hostname.startsWith('hocco-impulsionadores'))
  } catch { return false }
}
function headersFor(origin: string | null) {
  const allowed = origin && originAllowed(origin) ? origin : PROD_ORIGIN
  return { 'Access-Control-Allow-Origin': allowed, 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json; charset=utf-8', 'Vary': 'Origin' }
}
function json(body: unknown, status = 200, origin: string | null = null) { return new Response(JSON.stringify(body), { status, headers: headersFor(origin) }) }
function msg(error: unknown) { return error instanceof Error ? error.message : String(error ?? 'unknown_error') }

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin')
  if (req.method === 'OPTIONS') return new Response('ok', { headers: headersFor(origin) })
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405, origin)
  if (!originAllowed(origin)) return json({ error: 'Origem não autorizada.' }, 403, origin)

  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const secretSet = Deno.env.get('SUPABASE_SECRET_KEYS')
  let serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (secretSet) { try { const parsed = JSON.parse(secretSet); if (parsed?.default) serviceKey = parsed.default } catch {} }
  if (!url || !serviceKey) return json({ error: 'Controle administrativo indisponível.' }, 503, origin)

  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  if (!token) return json({ error: 'Sessão administrativa ausente.' }, 401, origin)
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: authData, error: authError } = await admin.auth.getUser(token)
  const user = authData.user
  if (authError || !user) return json({ error: 'Sessão inválida.' }, 401, origin)
  const { data: adminRow, error: adminError } = await admin.from('hocco_admins').select('role').eq('user_id', user.id).maybeSingle()
  if (adminError || !adminRow) return json({ error: 'Acesso administrativo negado.' }, 403, origin)

  let input: Record<string, unknown> = {}
  try { input = await req.json() } catch { return json({ error: 'Dados inválidos.' }, 400, origin) }
  const action = String(input.action ?? 'counts')
  const isOwner = adminRow.role === 'owner'
  const ensureOwner = () => { if (!isOwner) throw new Error('owner_required') }

  async function count(table: string, build?: (q: any) => any) {
    let q: any = admin.from(table).select('*', { count: 'exact', head: true })
    if (build) q = build(q)
    const { count: n, error } = await q
    if (error) throw new Error(`${table}:${error.message}`)
    return n ?? 0
  }
  async function ids(table: string, column: string, value: string) {
    const { data, error } = await admin.from(table).select('id').eq(column, value).limit(10000)
    if (error) throw new Error(`${table}:${error.message}`)
    return (data ?? []).map((x: any) => String(x.id))
  }
  async function deleteIn(table: string, column: string, values: (string|number)[]) {
    if (!values.length) return
    const { error } = await admin.from(table).delete().in(column, values)
    if (error) throw new Error(`${table}:${error.message}`)
  }
  async function deleteAll(table: string) {
    let removed = 0
    for (let batch = 0; batch < 10000; batch++) {
      const { data, error: readError } = await admin.from(table).select('id').limit(1000)
      if (readError) throw new Error(`${table}:${readError.message}`)
      const keys = (data ?? []).map((r: any) => r.id).filter((v: unknown) => v !== null && v !== undefined)
      if (!keys.length) return removed
      const { error } = await admin.from(table).delete().in('id', keys)
      if (error) throw new Error(`${table}:${error.message}`)
      removed += keys.length
      if (keys.length < 1000) return removed
    }
    throw new Error(`${table}:delete_batch_guard_exceeded`)
  }
  async function audit(scope: string, target: string | null, reason: string, extra: Record<string, unknown> = {}) {
    const { error } = await admin.from('hocco_admin_audit').insert({ admin_user_id: user.id, action: 'governance_control_action', entity_type: scope, entity_id: target, metadata: { reason, ...extra, executed_at: new Date().toISOString() } })
    if (error) throw new Error(`audit:${error.message}`)
  }
  async function listFiles(prefix = ''): Promise<string[]> {
    const { data, error } = await admin.storage.from('impulsionadores-avatars').list(prefix, { limit: 1000, sortBy: { column: 'name', order: 'asc' } })
    if (error) throw new Error(`storage:${error.message}`)
    const out: string[] = []
    for (const item of data ?? []) {
      const path = prefix ? `${prefix}/${item.name}` : item.name
      if (item.id) out.push(path)
      else out.push(...await listFiles(path))
    }
    return out
  }
  async function removeFiles(prefix = '') {
    const files = await listFiles(prefix)
    for (let i = 0; i < files.length; i += 1000) {
      const { error } = await admin.storage.from('impulsionadores-avatars').remove(files.slice(i, i + 1000))
      if (error) throw new Error(`storage:${error.message}`)
    }
    return files.length
  }

  async function counts() {
    const [profiles, admins, suspended, anonymized, companies, requests, agenda, finance, impulsions, permanent, partners, drops, dropRegs, dropRounds, dropCandidates, experiences, expApps, dooxClients, dooxRequests, audits, sessions, events, hc, missions, files] = await Promise.all([
      count('impulsionadores_perfis'), count('hocco_admins'), count('impulsionadores_perfis', q => q.eq('governance_status','suspended')), count('impulsionadores_perfis', q => q.eq('governance_status','anonymized')),
      count('hype_empresas'), count('hype_solicitacoes'), count('hype_agenda'), count('hype_financeiro_ledger'), count('impulsionadores_impulsoes'), count('hocco_patrocinios'), count('hocco_patrocinadores'), count('hocco_drops'), count('hocco_drop_inscricoes'), count('hocco_drop_rodadas'), count('hocco_drop_rodada_candidatos'), count('hocco_experiencias'), count('hocco_experiencia_inscricoes'), count('clientes'), count('solicitacoes'), count('hocco_admin_audit'), count('impulsionadores_sessoes'), count('impulsionadores_eventos'), count('hc_diario'), count('impulsionadores_missoes_diarias'), listFiles('')
    ])
    const realMembers = Math.max(0, profiles - admins)
    return { perfis_total:profiles, membros:realMembers, admins, suspensos:suspended, anonimizados:anonymized, atividade_membros:sessions+events+hc+missions, empresas:companies, solicitacoes_hype:requests, agenda_hype:agenda, financeiro:finance, impulsoes:impulsions, patrocinios:permanent, parceiros_drop:partners, drops, drop_inscricoes:dropRegs, drop_rodadas:dropRounds, drop_candidatos:dropCandidates, experiencias:experiences, experiencia_inscricoes:expApps, doox_clientes:dooxClients, doox_solicitacoes:dooxRequests, auditoria:audits, arquivos_storage:files.length }
  }

  async function clearPermanentSponsor(id: string) {
    await admin.from('hocco_patrocinios').update({ renovacao_de_id: null }).eq('renovacao_de_id', id)
    const eventIds = await ids('hocco_patrocinio_eventos','patrocinio_id',id); await deleteIn('hocco_patrocinio_eventos','id',eventIds)
    const { error } = await admin.from('hocco_patrocinios').delete().eq('id',id); if (error) throw new Error(`hocco_patrocinios:${error.message}`)
  }
  async function clearHypeRequest(id: string) {
    const agendaIds = await ids('hype_agenda','solicitacao_id',id)
    await deleteIn('hype_relatorios','agenda_id',agendaIds); await deleteIn('hype_resultados','agenda_id',agendaIds); await deleteIn('hype_votos','agenda_id',agendaIds); await deleteIn('hype_interacoes','agenda_id',agendaIds); await deleteIn('hype_agenda','id',agendaIds)
    const { error: fin } = await admin.from('hype_financeiro_ledger').delete().eq('source_type','business_request').eq('source_id',id); if (fin) throw new Error(`financeiro:${fin.message}`)
    const { error } = await admin.from('hype_solicitacoes').delete().eq('id',id); if (error) throw new Error(`hype_solicitacoes:${error.message}`)
  }
  async function clearCompany(id: string) {
    const sponsorIds = await ids('hocco_patrocinios','empresa_id',id); for (const x of sponsorIds) await clearPermanentSponsor(x)
    const expIds = await ids('hocco_experiencias','empresa_id',id); await deleteIn('hocco_experiencia_inscricoes','experiencia_id',expIds); await deleteIn('hocco_experiencias','id',expIds)
    const agendaIds = await ids('hype_agenda','empresa_id',id); await deleteIn('hype_relatorios','agenda_id',agendaIds); await deleteIn('hype_resultados','agenda_id',agendaIds); await deleteIn('hype_votos','agenda_id',agendaIds); await deleteIn('hype_interacoes','agenda_id',agendaIds); await deleteIn('hype_agenda','id',agendaIds)
    const { error: fin } = await admin.from('hype_financeiro_ledger').delete().eq('company_id',id); if (fin) throw new Error(`financeiro:${fin.message}`)
    const { error: req } = await admin.from('hype_solicitacoes').update({ empresa_id:null }).eq('empresa_id',id); if (req) throw new Error(`hype_solicitacoes:${req.message}`)
    const { error } = await admin.from('hype_empresas').delete().eq('id',id); if (error) throw new Error(`hype_empresas:${error.message}`)
  }
  async function clearExperience(id: string) { const { error } = await admin.from('hocco_experiencias').delete().eq('id',id); if (error) throw new Error(`hocco_experiencias:${error.message}`) }
  async function clearDrop(id: string) { const { error } = await admin.from('hocco_drops').delete().eq('id',id); if (error) throw new Error(`hocco_drops:${error.message}`) }
  async function reconcileDropRounds(dropId: string) {
    const { data: rounds, error } = await admin.from('hocco_drop_rodadas').select('id').eq('drop_id',dropId); if (error) throw new Error(`rounds:${error.message}`)
    for (const round of rounds ?? []) {
      const { data: candidates, error: ce } = await admin.from('hocco_drop_rodada_candidatos').select('result').eq('rodada_id',round.id); if (ce) throw new Error(`candidates:${ce.message}`)
      const rows = candidates ?? []
      const selected = rows.filter((r:any)=>['selecionado','promovido'].includes(r.result)).length
      const wait = rows.filter((r:any)=>r.result==='suplente').length
      const { error: ue } = await admin.from('hocco_drop_rodadas').update({ candidate_count:rows.length, selected_count:selected, waitlist_count:wait }).eq('id',round.id); if (ue) throw new Error(`round_update:${ue.message}`)
    }
  }
  async function clearDropRegistration(id: string) {
    const { data: row, error: re } = await admin.from('hocco_drop_inscricoes').select('drop_id').eq('id',id).maybeSingle(); if (re) throw new Error(`drop_registration:${re.message}`)
    const { error } = await admin.from('hocco_drop_inscricoes').delete().eq('id',id); if (error) throw new Error(`drop_registration:${error.message}`)
    if (row?.drop_id) await reconcileDropRounds(row.drop_id)
  }
  async function clearDropPartner(id: string) { const { error } = await admin.from('hocco_patrocinadores').delete().eq('id',id); if (error) throw new Error(`hocco_patrocinadores:${error.message}`) }
  async function resetMemberProgress(id: string) {
    for (const table of ['hc_ledger','hc_diario','impulsionadores_missoes_diarias','impulsionadores_missoes_usuario','impulsionadores_impulsos']) { const { error } = await admin.from(table).delete().eq('user_id',id); if (error) throw new Error(`${table}:${error.message}`) }
    const { error } = await admin.from('impulsionadores_perfis').update({ xp:0,nivel:1,impulsos:0,missoes_concluidas:0,ciclos:0,selos:0,hc:0,ofensiva_dias:0,ultimo_dia_ativo:null,total_dias_ativos:0,maior_ofensiva:0,updated_at:new Date().toISOString() }).eq('user_id',id)
    if (error) throw new Error(`impulsionadores_perfis:${error.message}`)
  }
  async function memberGovernance(target: string, operation: string, reason: string, confirmation: string) {
    ensureOwner()
    const { data: targetAdmin } = await admin.from('hocco_admins').select('role').eq('user_id',target).maybeSingle()
    if (targetAdmin) throw new Error('admin_account_protected')
    const { data: profile, error: pe } = await admin.from('impulsionadores_perfis').select('user_id,nome_publico,governance_status').eq('user_id',target).maybeSingle()
    if (pe || !profile) throw new Error('member_not_found')
    const expected: Record<string,string> = { suspend:'SUSPENDER', reactivate:'REATIVAR', reset_activity:'RESETAR', anonymize:'ANONIMIZAR', hard_delete:'EXCLUIR CONTA' }
    if (!expected[operation] || confirmation !== expected[operation]) throw new Error(`confirmation_required:${expected[operation] ?? 'INVALIDA'}`)
    if (operation==='suspend') {
      const { error } = await admin.from('impulsionadores_perfis').update({ governance_status:'suspended', governance_reason:reason, governance_updated_at:new Date().toISOString(), suspended_at:new Date().toISOString() }).eq('user_id',target); if (error) throw error
    } else if (operation==='reactivate') {
      if (profile.governance_status==='anonymized') throw new Error('anonymized_account_cannot_reactivate')
      const { error } = await admin.from('impulsionadores_perfis').update({ governance_status:'active', governance_reason:reason, governance_updated_at:new Date().toISOString(), suspended_at:null }).eq('user_id',target); if (error) throw error
    } else if (operation==='reset_activity') {
      await resetMemberProgress(target)
    } else if (operation==='anonymize') {
      await removeFiles(target)
      for (const table of ['impulsionadores_push_subscriptions','impulsionadores_pwa_status','impulsionadores_eventos','impulsionadores_sessoes']) { const { error } = await admin.from(table).delete().eq('user_id',target); if (error) throw new Error(`${table}:${error.message}`) }
      const anonMail = `anon-${target}@hocco.invalid`
      const { error: ae } = await admin.auth.admin.updateUserById(target,{ email:anonMail, password:crypto.randomUUID()+crypto.randomUUID(), user_metadata:{ full_name:'Membro anonimizado', anonymized:true }, ban_duration:'876000h' })
      if (ae) throw new Error(`auth_anonymize:${ae.message}`)
      const { error: ce } = await admin.from('impulsionadores_contatos').update({ email:null, telefone:'ANONIMIZADO', updated_at:new Date().toISOString() }).eq('user_id',target); if (ce) throw ce
      const { error: pue } = await admin.from('impulsionadores_perfis').update({ nome_publico:'Membro anonimizado',username:null,bio:null,avatar_url:null,governance_status:'anonymized',governance_reason:reason,governance_updated_at:new Date().toISOString(),anonymized_at:new Date().toISOString(),suspended_at:new Date().toISOString(),updated_at:new Date().toISOString() }).eq('user_id',target); if (pue) throw pue
    } else if (operation==='hard_delete') {
      const [business, impulses, permanent, dropsHist, expHist] = await Promise.all([
        count('hype_solicitacoes',q=>q.eq('user_id',target)), count('impulsionadores_impulsoes',q=>q.eq('user_id',target).eq('status','confirmada')), count('hocco_patrocinios',q=>q.eq('user_id',target).eq('payment_status','confirmado')), count('hocco_drop_inscricoes',q=>q.eq('user_id',target).in('status',['selecionado','suplente','confirmado','entregue'])), count('hocco_experiencia_inscricoes',q=>q.eq('user_id',target).in('status',['confirmado']))
      ])
      const blockers = business + impulses + permanent + dropsHist + expHist
      if (blockers>0) throw new Error(`retention_required_use_anonymize:${blockers}`)
      await removeFiles(target)
      const { error } = await admin.auth.admin.deleteUser(target)
      if (error) throw new Error(`auth_delete:${error.message}`)
    }
    await audit(`member_${operation}`,target,reason,{ previous_status:profile.governance_status })
    return { ok:true, operation, target }
  }

  async function clearSponsorsAll() { await deleteAll('hocco_patrocinio_eventos'); await deleteAll('hocco_patrocinios') }
  async function clearOpportunitiesAll() { await deleteAll('hocco_drops'); await deleteAll('hocco_patrocinadores'); await deleteAll('hocco_experiencias') }
  async function clearHypeCommercialAll() {
    await deleteAll('hype_relatorios'); await deleteAll('hype_resultados'); await deleteAll('hype_votos'); await deleteAll('hype_interacoes'); await deleteAll('hype_agenda')
    const { error: fin } = await admin.from('hype_financeiro_ledger').delete().eq('source_type','business_request'); if (fin) throw new Error(`financeiro:${fin.message}`)
    await deleteAll('hype_solicitacoes'); await clearSponsorsAll(); await deleteAll('hocco_experiencias'); await deleteAll('hype_empresas')
  }
  async function resetAllMemberProgress() {
    for (const table of ['hc_ledger','hc_diario','impulsionadores_missoes_diarias','impulsionadores_missoes_usuario','impulsionadores_impulsos']) await deleteAll(table)
    const { error } = await admin.from('impulsionadores_perfis').update({ xp:0,nivel:1,impulsos:0,missoes_concluidas:0,ciclos:0,selos:0,hc:0,ofensiva_dias:0,ultimo_dia_ativo:null,total_dias_ativos:0,maior_ofensiva:0,updated_at:new Date().toISOString() }).neq('user_id','00000000-0000-0000-0000-000000000000')
    if (error) throw new Error(`profiles:${error.message}`)
  }
  async function clearDooxRequest(id: string) {
    for (const table of ['programacoes','materiais','pagamentos','aceites','historico_status']) { const { error } = await admin.from(table).delete().eq('solicitacao_id',id); if (error) throw new Error(`${table}:${error.message}`) }
    const { error } = await admin.from('solicitacoes').delete().eq('id',id); if (error) throw new Error(`solicitacoes:${error.message}`)
  }
  async function clearDooxClient(id: string) { const requestIds = await ids('solicitacoes','cliente_id',id); for (const r of requestIds) await clearDooxRequest(r); const { error }=await admin.from('clientes').delete().eq('id',id); if(error) throw new Error(`clientes:${error.message}`) }
  async function clearDooxAll() { for (const table of ['programacoes','materiais','pagamentos','aceites','historico_status','solicitacoes','episodios','clientes']) await deleteAll(table) }

  try {
    if (action==='counts') return json({ ok:true, counts:await counts(), role:adminRow.role, version:3 },200,origin)
    const reason = String(input.reason ?? '').trim()
    if (reason.length<4) return json({ error:'Informe o motivo da operação.' },400,origin)
    if (action==='member_governance') {
      const result = await memberGovernance(String(input.target ?? ''),String(input.operation ?? ''),reason,String(input.confirmation ?? ''))
      return json({ ...result, counts:await counts() },200,origin)
    }

    ensureOwner()
    const scope = String(input.scope ?? '')
    const target = input.target ? String(input.target) : null
    const confirmation = String(input.confirmation ?? '').trim()
    const modules = new Set(['patrocinios_all','hype_comercial_all','oportunidades_all','membros_progressao_all','membros_atividade_all','financeiro_all','doox_operacional_all','auditoria_all'])
    const expected = scope==='all_operational' ? 'ZERAR TUDO' : modules.has(scope) ? 'LIMPAR MODULO' : scope==='storage_all' ? 'APAGAR ARQUIVOS' : 'APAGAR'
    if (confirmation!==expected) return json({ error:`Digite exatamente: ${expected}` },400,origin)

    if (scope==='patrocinio' && target) await clearPermanentSponsor(target)
    else if (scope==='hype_solicitacao' && target) await clearHypeRequest(target)
    else if (scope==='empresa' && target) await clearCompany(target)
    else if (scope==='impulsao' && target) { const { error }=await admin.rpc('admin_edge_delete_impulsao_private',{p_id:target}); if(error) throw new Error(`impulsao:${error.message}`); const { error:fin }=await admin.from('hype_financeiro_ledger').delete().eq('source_type','impulsion').eq('source_id',target); if(fin) throw new Error(`financeiro:${fin.message}`) }
    else if (scope==='experiencia' && target) await clearExperience(target)
    else if (scope==='drop' && target) await clearDrop(target)
    else if (scope==='drop_inscricao' && target) await clearDropRegistration(target)
    else if (scope==='parceiro_drop' && target) await clearDropPartner(target)
    else if ((scope==='membro_dados' || scope==='membro_progressao') && target) await resetMemberProgress(target)
    else if (scope==='doox_solicitacao' && target) await clearDooxRequest(target)
    else if (scope==='doox_cliente' && target) await clearDooxClient(target)
    else if (scope==='patrocinios_all') await clearSponsorsAll()
    else if (scope==='oportunidades_all') await clearOpportunitiesAll()
    else if (scope==='hype_comercial_all') await clearHypeCommercialAll()
    else if (scope==='membros_progressao_all' || scope==='membros_atividade_all') await resetAllMemberProgress()
    else if (scope==='financeiro_all') { await deleteAll('hype_financeiro_ledger'); await deleteAll('impulsionadores_pagamentos') }
    else if (scope==='doox_operacional_all') await clearDooxAll()
    else if (scope==='auditoria_all') await deleteAll('hocco_admin_audit')
    else if (scope==='storage_all') { const removed=await removeFiles(''); await audit(scope,null,reason,{removed_files:removed}); return json({ok:true,removed_files:removed,counts:await counts()},200,origin) }
    else if (scope==='all_operational') {
      await clearOpportunitiesAll(); await clearHypeCommercialAll(); await resetAllMemberProgress(); await clearDooxAll(); await deleteAll('impulsionadores_signup_tentativas'); await deleteAll('impulsionadores_pagamentos'); await deleteAll('impulsionadores_visitas'); await deleteAll('impulsionadores_contas_excluidas'); await deleteAll('impulsionadores_aceites'); await deleteAll('hocco_admin_audit')
      const removed=await removeFiles(''); await audit(scope,null,reason,{removed_files:removed,preserved:['auth.users','hocco_admins','hype_planos','modalidades','faixas','impulsionadores_perfis','impulsionadores_contatos']}); return json({ok:true,removed_files:removed,counts:await counts()},200,origin)
    } else return json({ error:'Escopo de exclusão inválido.' },400,origin)

    await audit(scope,target,reason)
    return json({ ok:true, counts:await counts() },200,origin)
  } catch (error) {
    console.error('admin-control-v3',msg(error))
    return json({ error:msg(error) },500,origin)
  }
})
