'use client';

import { useEffect, useMemo, useState } from 'react';
import { Database, RefreshCw, ShieldAlert, Trash2, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const MODULES = [
  { scope:'patrocinios_all', label:'Limpar Patrocínios', desc:'Apaga contratos, fila, métricas e eventos de Marcas Permanentes.', phrase:'LIMPAR MODULO' },
  { scope:'hype_comercial_all', label:'Limpar Hype comercial', desc:'Apaga empresas, solicitações, agenda, resultados, relatórios, experiências e patrocínios ligados ao Hype.', phrase:'LIMPAR MODULO' },
  { scope:'membros_atividade_all', label:'Limpar atividade dos membros', desc:'Zera HC, XP, ofensiva, missões, sessões, interações e impulsões. Mantém logins e contatos.', phrase:'LIMPAR MODULO' },
  { scope:'financeiro_all', label:'Limpar financeiro', desc:'Apaga o ledger financeiro e pagamentos legados. Use somente quando realmente quiser zerar os relatórios financeiros.', phrase:'LIMPAR MODULO' },
  { scope:'doox_operacional_all', label:'Limpar DOOX', desc:'Apaga clientes, pedidos, pagamentos, materiais, histórico e programação do DOOX. Mantém modalidades e faixas.', phrase:'LIMPAR MODULO' },
  { scope:'auditoria_all', label:'Limpar auditoria', desc:'Apaga o histórico administrativo anterior; a própria exclusão ficará registrada novamente.', phrase:'LIMPAR MODULO' },
  { scope:'storage_all', label:'Limpar arquivos', desc:'Apaga fisicamente os uploads do bucket do Hype pela Storage API.', phrase:'APAGAR ARQUIVOS' },
];

const RECORD_TYPES = [
  ['patrocinio','Patrocínio'],
  ['hype_solicitacao','Solicitação Hype'],
  ['empresa','Empresa'],
  ['impulsao','Impulsão'],
  ['experiencia','Experiência'],
  ['membro_dados','Dados de um membro'],
  ['doox_solicitacao','Solicitação DOOX'],
  ['doox_cliente','Cliente DOOX'],
];

const COUNT_LABELS = {
  membros:'Membros', atividade_membros:'Atividade', empresas:'Empresas', solicitacoes_hype:'Solicitações Hype',
  agenda_hype:'Agenda Hype', financeiro:'Financeiro', impulsoes:'Impulsões', patrocinios:'Patrocínios',
  experiencias:'Experiências', doox_clientes:'Clientes DOOX', doox_solicitacoes:'Pedidos DOOX', auditoria:'Auditoria', arquivos_storage:'Arquivos',
};

export default function ControlDataManager() {
  const [visible, setVisible] = useState(false);
  const [owner, setOwner] = useState(false);
  const [counts, setCounts] = useState({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [recordType, setRecordType] = useState('patrocinio');
  const [recordId, setRecordId] = useState('');
  const [pending, setPending] = useState(null);
  const [reason, setReason] = useState('');
  const [confirmation, setConfirmation] = useState('');

  useEffect(() => { loadCounts(); }, []);

  async function invoke(body) {
    const { data, error } = await supabase.functions.invoke('admin-control', { body });
    if (error) throw new Error(error.message || 'Falha no controle administrativo.');
    if (data?.error) throw new Error(data.error);
    return data;
  }

  async function loadCounts() {
    try {
      const data = await invoke({ action:'counts' });
      setOwner(data?.role === 'owner');
      setCounts(data?.counts || {});
    } catch {
      setOwner(false);
    }
  }

  function prepare(action) {
    setPending(action);
    setReason('');
    setConfirmation('');
    setNotice('');
  }

  function prepareRecord() {
    const id = recordId.trim();
    if (!id) return setNotice('Informe o ID do registro que será apagado.');
    const label = RECORD_TYPES.find(([key]) => key === recordType)?.[1] || 'Registro';
    prepare({ scope:recordType, target:id, label:`Apagar ${label}`, desc:`Exclusão definitiva do registro ${id}.`, phrase:'APAGAR' });
  }

  async function execute() {
    if (!pending) return;
    if (reason.trim().length < 4) return setNotice('Informe um motivo com pelo menos 4 caracteres.');
    if (confirmation.trim() !== pending.phrase) return setNotice(`Digite exatamente: ${pending.phrase}`);
    setBusy(true);
    setNotice('Executando exclusão...');
    try {
      const data = await invoke({ action:'delete', scope:pending.scope, target:pending.target || null, reason:reason.trim(), confirmation:confirmation.trim() });
      setCounts(data?.counts || {});
      setPending(null);
      setRecordId('');
      setNotice('Operação concluída e registrada na auditoria.');
      window.setTimeout(() => location.reload(), 900);
    } catch (error) {
      setNotice(`Falha: ${error.message}`);
    } finally {
      setBusy(false);
    }
  }

  const totalOperational = useMemo(() => Object.entries(counts).filter(([key]) => !['membros','auditoria','arquivos_storage'].includes(key)).reduce((acc,[,value]) => acc + Number(value || 0), 0), [counts]);

  if (!owner) return null;

  return <>
    <button onClick={() => setVisible(true)} style={S.launch}><Database size={17}/> CONTROLE TOTAL</button>
    {visible && <div style={S.backdrop}>
      <section style={S.modal}>
        <header style={S.header}>
          <div><small style={S.kicker}>OWNER ONLY</small><h2 style={S.title}>Controle Total</h2><p style={S.subtitle}>Exclusão seletiva, limpeza de módulos e reset operacional. Catálogos, funções, cron e acesso owner ficam protegidos.</p></div>
          <button style={S.close} onClick={() => setVisible(false)} aria-label="Fechar"><X/></button>
        </header>

        <div style={S.countGrid}>
          {Object.entries(COUNT_LABELS).map(([key,label]) => <div key={key} style={S.countCard}><span>{label}</span><b>{Number(counts[key] || 0).toLocaleString('pt-BR')}</b></div>)}
        </div>

        <div style={S.toolbar}><b>{totalOperational.toLocaleString('pt-BR')} registros operacionais contabilizados</b><button style={S.secondary} disabled={busy} onClick={loadCounts}><RefreshCw size={15}/> Atualizar</button></div>

        <section style={S.section}>
          <h3 style={S.sectionTitle}>Apagar um registro específico</h3>
          <p style={S.text}>Use o ID mostrado nas telas do Control. Dependências ligadas ao registro são removidas na ordem correta.</p>
          <div style={S.row}>
            <select value={recordType} onChange={(e) => setRecordType(e.target.value)} style={S.input}>{RECORD_TYPES.map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select>
            <input value={recordId} onChange={(e) => setRecordId(e.target.value)} placeholder="UUID do registro" style={{...S.input,flex:1}} />
            <button style={S.dangerOutline} onClick={prepareRecord}><Trash2 size={15}/> Apagar</button>
          </div>
        </section>

        <section style={S.section}>
          <h3 style={S.sectionTitle}>Limpeza por módulo</h3>
          <div style={S.moduleGrid}>{MODULES.map((item) => <button key={item.scope} style={S.moduleCard} onClick={() => prepare(item)}><span><Trash2 size={16}/><b>{item.label}</b></span><small>{item.desc}</small></button>)}</div>
        </section>

        <section style={S.resetZone}>
          <div><span style={S.resetIcon}><ShieldAlert/></span><b>Reset operacional completo</b><p>Zera DOOX + Hype + Patrocínios + atividade + financeiro + auditoria + uploads. Preserva somente a estrutura do produto, catálogos e acessos administrativos.</p></div>
          <button style={S.danger} onClick={() => prepare({scope:'all_operational',label:'ZERAR TUDO',desc:'Esta ação apaga toda a operação dos dois apps e os uploads do Storage.',phrase:'ZERAR TUDO'})}>ZERAR TUDO</button>
        </section>

        {notice && <div style={S.notice}>{notice}</div>}
      </section>
    </div>}

    {pending && <div style={S.confirmBackdrop}>
      <section style={S.confirmBox}>
        <div style={{display:'flex',justifyContent:'space-between',gap:16}}><div><small style={S.kicker}>CONFIRMAÇÃO DESTRUTIVA</small><h3 style={{margin:'5px 0'}}>{pending.label}</h3></div><button style={S.close} onClick={() => setPending(null)}><X/></button></div>
        <p style={S.text}>{pending.desc}</p>
        <label style={S.label}>Motivo<input style={S.input} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: limpeza de testes / registro duplicado" /></label>
        <label style={S.label}>Digite <b>{pending.phrase}</b><input style={S.input} value={confirmation} onChange={(e) => setConfirmation(e.target.value)} autoComplete="off" /></label>
        {notice && <div style={S.notice}>{notice}</div>}
        <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:16}}><button style={S.secondary} disabled={busy} onClick={() => setPending(null)}>Cancelar</button><button style={S.danger} disabled={busy} onClick={execute}>{busy ? 'PROCESSANDO...' : 'CONFIRMAR EXCLUSÃO'}</button></div>
      </section>
    </div>}
  </>;
}

const S = {
  launch:{position:'fixed',left:16,bottom:18,zIndex:9100,border:'1px solid #dfe6ee',borderRadius:999,background:'#fff',color:'#10213b',padding:'11px 15px',fontWeight:900,fontSize:11,display:'flex',alignItems:'center',gap:8,boxShadow:'0 12px 34px rgba(16,33,59,.16)',cursor:'pointer'},
  backdrop:{position:'fixed',inset:0,zIndex:12000,background:'rgba(7,18,35,.58)',backdropFilter:'blur(6px)',display:'grid',placeItems:'center',padding:18},
  modal:{width:'min(1120px,96vw)',maxHeight:'92vh',overflow:'auto',background:'#f6f8fb',borderRadius:26,padding:22,boxShadow:'0 30px 100px rgba(0,0,0,.35)',color:'#10213b'},
  header:{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:18,marginBottom:18},
  kicker:{fontSize:10,fontWeight:1000,letterSpacing:'.14em',color:'#c62828'},
  title:{fontSize:34,margin:'5px 0 3px',letterSpacing:'-.04em'},subtitle:{margin:0,color:'#6b7789',maxWidth:760,lineHeight:1.5},
  close:{border:0,background:'transparent',cursor:'pointer',color:'#526176'},
  countGrid:{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:9},
  countCard:{background:'#fff',border:'1px solid #e1e7ef',borderRadius:16,padding:'13px 14px',display:'grid',gap:5},
  toolbar:{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,margin:'14px 0 8px',fontSize:12},
  section:{background:'#fff',border:'1px solid #e1e7ef',borderRadius:20,padding:18,marginTop:12},
  sectionTitle:{margin:'0 0 5px'},text:{color:'#66758a',fontSize:13,lineHeight:1.55},
  row:{display:'flex',gap:9,flexWrap:'wrap',alignItems:'center'},
  input:{border:'1px solid #d7e0ea',borderRadius:12,padding:'11px 12px',font:'inherit',background:'#fff',minWidth:180},
  label:{display:'grid',gap:6,fontSize:12,fontWeight:800,marginTop:12},
  secondary:{border:'1px solid #d8e1eb',borderRadius:12,background:'#fff',padding:'10px 12px',fontWeight:850,display:'inline-flex',alignItems:'center',gap:7,cursor:'pointer'},
  dangerOutline:{border:'1px solid #e8b8b8',borderRadius:12,background:'#fff6f6',color:'#a91f1f',padding:'10px 13px',fontWeight:900,display:'inline-flex',alignItems:'center',gap:7,cursor:'pointer'},
  moduleGrid:{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:9,marginTop:12},
  moduleCard:{textAlign:'left',border:'1px solid #e2e7ee',borderRadius:15,background:'#fbfcfe',padding:14,color:'#172943',cursor:'pointer',display:'grid',gap:8},
  resetZone:{marginTop:12,border:'1px solid #e0aaaa',borderRadius:20,background:'#fff4f4',padding:18,display:'flex',justifyContent:'space-between',alignItems:'center',gap:18,flexWrap:'wrap'},
  resetIcon:{display:'inline-flex',color:'#ad1f1f',marginBottom:6},
  danger:{border:0,borderRadius:12,background:'#a91f1f',color:'#fff',padding:'12px 16px',fontWeight:1000,cursor:'pointer'},
  notice:{marginTop:12,padding:'11px 13px',borderRadius:12,background:'#edf4ff',color:'#174b8b',fontSize:12,fontWeight:800},
  confirmBackdrop:{position:'fixed',inset:0,zIndex:13000,background:'rgba(3,9,18,.68)',display:'grid',placeItems:'center',padding:18},
  confirmBox:{width:'min(540px,96vw)',background:'#fff',borderRadius:22,padding:20,color:'#10213b',boxShadow:'0 30px 100px rgba(0,0,0,.4)'},
};
