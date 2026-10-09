import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://vebqvedmhfaebvdantiu.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_4qUcXYXNFDUc6UAw_nvpDw_M-9w3vuz';

const rawSupabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const MEMBER_COMPANY_FIELDS = 'id,nome_fantasia,logo_url,capa_url,segmento';
const SAFE_MEMBER_TABLES = new Set(['hype_agenda','hype_resultados','hocco_experiencias']);

function isMemberApp() {
  return typeof window !== 'undefined' && (window.location.pathname === '/app' || window.location.pathname.startsWith('/app/'));
}

function todayBR() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

function addDays(value, days) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function compareValues(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  const av = typeof a === 'number' ? a : String(a);
  const bv = typeof b === 'number' ? b : String(b);
  return av < bv ? -1 : av > bv ? 1 : 0;
}

class SafeMemberQuery {
  constructor(table) {
    this.table = table;
    this.filters = [];
    this.orders = [];
    this.maxRows = null;
    this.options = null;
    this.mode = 'many';
  }

  select(_columns = '*', options) { this.options = options || null; return this; }
  eq(column, value) { this.filters.push(['eq', column, value]); return this; }
  neq(column, value) { this.filters.push(['neq', column, value]); return this; }
  gt(column, value) { this.filters.push(['gt', column, value]); return this; }
  gte(column, value) { this.filters.push(['gte', column, value]); return this; }
  lt(column, value) { this.filters.push(['lt', column, value]); return this; }
  lte(column, value) { this.filters.push(['lte', column, value]); return this; }
  in(column, values) { this.filters.push(['in', column, values]); return this; }
  order(column, options = {}) { this.orders.push([column, options?.ascending !== false]); return this; }
  limit(value) { this.maxRows = Math.max(0, Number(value) || 0); return this; }
  single() { this.mode = 'single'; return this; }
  maybeSingle() { this.mode = 'maybeSingle'; return this; }

  then(resolve, reject) { return this.execute().then(resolve, reject); }
  catch(reject) { return this.execute().catch(reject); }
  finally(handler) { return this.execute().finally(handler); }

  findFilter(op, column) {
    return this.filters.find((item) => item[0] === op && item[1] === column)?.[2];
  }

  applyClientQuery(rows) {
    let data = [...rows];
    for (const [op, column, value] of this.filters) {
      if (column === 'hype_date' || column === 'quadro') continue;
      data = data.filter((row) => {
        const current = row?.[column];
        if (op === 'eq') return current === value;
        if (op === 'neq') return current !== value;
        if (op === 'gt') return current > value;
        if (op === 'gte') return current >= value;
        if (op === 'lt') return current < value;
        if (op === 'lte') return current <= value;
        if (op === 'in') return Array.isArray(value) && value.includes(current);
        return true;
      });
    }
    for (let i = this.orders.length - 1; i >= 0; i -= 1) {
      const [column, ascending] = this.orders[i];
      data.sort((a, b) => compareValues(a?.[column], b?.[column]) * (ascending ? 1 : -1));
    }
    if (this.maxRows != null) data = data.slice(0, this.maxRows);
    return data;
  }

  finish(data, error = null) {
    if (error) return { data: null, error, count: null, status: 400, statusText: 'ERROR' };
    const filtered = this.applyClientQuery(data || []);
    if (this.mode === 'single') {
      if (filtered.length !== 1) return { data: null, error: { message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' }, count: null, status: 406, statusText: 'Not Acceptable' };
      return { data: filtered[0], error: null, count: 1, status: 200, statusText: 'OK' };
    }
    if (this.mode === 'maybeSingle') {
      if (filtered.length > 1) return { data: null, error: { message: 'JSON object requested, multiple rows returned', code: 'PGRST116' }, count: null, status: 406, statusText: 'Not Acceptable' };
      return { data: filtered[0] || null, error: null, count: filtered.length, status: 200, statusText: 'OK' };
    }
    return { data: filtered, error: null, count: this.options?.count === 'exact' ? filtered.length : null, status: 200, statusText: 'OK' };
  }

  async execute() {
    if (this.table === 'hype_agenda') {
      const exactDate = this.findFilter('eq', 'hype_date');
      const afterDate = this.findFilter('gt', 'hype_date');
      const fromDate = exactDate || this.findFilter('gte', 'hype_date') || (afterDate ? addDays(afterDate, 1) : todayBR());
      const toDate = exactDate || this.findFilter('lte', 'hype_date') || addDays(fromDate, 31);
      const quadro = this.findFilter('eq', 'quadro') || null;
      const { data, error } = await rawSupabase.rpc('hype_slots_publicos', {
        p_from_date: fromDate,
        p_to_date: toDate,
        p_quadro: quadro,
      });
      if (error) return this.finish([], error);
      const rows = (data || []).map((row) => ({
        id: row.agenda_id,
        empresa_id: row.empresa_id,
        hype_date: row.hype_date,
        quadro: row.quadro,
        tamanho: row.tamanho,
        desconto: row.desconto,
        status: row.status,
        updated_at: row.updated_at,
        hype_empresas: {
          id: row.empresa_id,
          nome_fantasia: row.nome_fantasia,
          logo_url: row.logo_url,
          capa_url: row.capa_url,
          segmento: row.segmento,
        },
      }));
      return this.finish(rows);
    }

    if (this.table === 'hype_resultados') {
      const { data, error } = await rawSupabase.rpc('hype_resultados_publicos', {
        p_limit: Math.min(50, Math.max(1, this.maxRows || 20)),
      });
      if (error) return this.finish([], error);
      const rows = (data || []).map((row) => ({
        id: row.id,
        hype_date: row.hype_date,
        quadro: row.quadro,
        empresa_id: row.empresa_id,
        agenda_id: row.agenda_id,
        hypes_validos: row.hypes_validos,
        participantes_unicos: row.participantes_unicos,
        finalized_at: row.finalized_at,
        score_percent: row.score_percent,
        empate: row.empate,
        detalhes: row.detalhes,
        hype_empresas: {
          id: row.empresa_id,
          nome_fantasia: row.nome_fantasia,
          logo_url: row.logo_url,
          segmento: row.segmento,
        },
        hype_agenda: null,
      }));
      return this.finish(rows);
    }

    if (this.table === 'hocco_experiencias') {
      const { data, error } = await rawSupabase.rpc('hocco_experiencias_publicas');
      if (error) return this.finish([], error);
      const rows = (data || []).map((row) => ({
        id: row.id,
        titulo: row.titulo,
        descricao: row.descricao,
        empresa_id: row.empresa_id,
        hc_min: row.hc_min,
        hc_cost: row.hc_cost,
        vagas: row.vagas,
        regras: row.regras,
        inscricoes_abrem_at: row.inscricoes_abrem_at,
        inscricoes_fecham_at: row.inscricoes_fecham_at,
        evento_at: row.evento_at,
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at,
        confirmar_ate: row.confirmar_ate,
        local_evento: row.local_evento,
        imagem_url: row.imagem_url,
        hype_empresas: row.empresa_nome ? { nome_fantasia: row.empresa_nome } : null,
      }));
      return this.finish(rows);
    }

    return this.finish([], { message: 'safe_member_query_not_supported' });
  }
}

function sanitizeMemberSelect(table, columns) {
  if (!isMemberApp()) return columns;
  let value = String(columns || '*');
  if (table === 'hype_empresas' && value.trim() === '*') return MEMBER_COMPANY_FIELDS;
  value = value.replaceAll('hype_empresas(*)', `hype_empresas(${MEMBER_COMPANY_FIELDS})`);
  return value;
}

function wrapTable(table) {
  if (isMemberApp() && SAFE_MEMBER_TABLES.has(table)) return new SafeMemberQuery(table);
  const builder = rawSupabase.from(table);
  return new Proxy(builder, {
    get(target, prop, receiver) {
      if (prop === 'select') {
        return (columns = '*', options) => target.select(sanitizeMemberSelect(table, columns), options);
      }
      const value = Reflect.get(target, prop, receiver);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

export const supabase = new Proxy(rawSupabase, {
  get(target, prop, receiver) {
    if (prop === 'from') return (table) => wrapTable(table);
    const value = Reflect.get(target, prop, receiver);
    return typeof value === 'function' ? value.bind(target) : value;
  },
});
