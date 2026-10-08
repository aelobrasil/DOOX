import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://vebqvedmhfaebvdantiu.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_4qUcXYXNFDUc6UAw_nvpDw_M-9w3vuz';

const rawSupabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const MEMBER_COMPANY_FIELDS = 'id,nome_fantasia,logo_url,segmento,desconto_padrao';
const MEMBER_AGENDA_FIELDS = 'id,empresa_id,hype_date,quadro,tamanho,desconto,status,beneficio_desbloqueado_at,beneficio_desconto_snapshot,beneficio_cupom_snapshot,beneficio_condicoes_snapshot,beneficio_validade_snapshot';

function isMemberApp() {
  return typeof window !== 'undefined' && (window.location.pathname === '/app' || window.location.pathname.startsWith('/app/'));
}

function sanitizeMemberSelect(table, columns) {
  if (!isMemberApp()) return columns;
  let value = String(columns || '*');

  // O app do membro nunca solicita o cadastro empresarial completo.
  // Contato, CNPJ, e-mail, site, Instagram e demais campos internos ficam fora do payload.
  if (table === 'hype_empresas' && value.trim() === '*') {
    return MEMBER_COMPANY_FIELDS;
  }

  if (table === 'hype_agenda') {
    value = value.replaceAll('hype_empresas(*)', `hype_empresas(${MEMBER_COMPANY_FIELDS})`);
  }

  if (table === 'hype_resultados') {
    value = value
      .replaceAll('hype_empresas(*)', `hype_empresas(${MEMBER_COMPANY_FIELDS})`)
      .replaceAll('hype_agenda(*)', `hype_agenda(${MEMBER_AGENDA_FIELDS})`);
  }

  return value;
}

function wrapTable(table) {
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
