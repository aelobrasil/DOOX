'use client';

import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { TERMS_VERSION } from '../../lib/config';

export default function LegalReacceptGuard(){
  const [open,setOpen]=useState(false);
  const [accepted,setAccepted]=useState(false);
  const [busy,setBusy]=useState(false);
  const [msg,setMsg]=useState('');

  useEffect(()=>{
    let alive=true;
    (async()=>{
      const {data}=await supabase.auth.getUser();
      if(!alive||!data.user)return;
      const {data:rows,error}=await supabase.from('impulsionadores_aceites')
        .select('documento')
        .eq('user_id',data.user.id)
        .eq('versao',TERMS_VERSION)
        .in('documento',['termos_uso','privacidade']);
      if(error){ setMsg('Não foi possível validar seu aceite atual.'); setOpen(true); return; }
      const docs=new Set((rows||[]).map((r)=>r.documento));
      if(!docs.has('termos_uso')||!docs.has('privacidade'))setOpen(true);
    })();
    return()=>{alive=false};
  },[]);

  async function confirm(){
    if(!accepted)return setMsg('Marque a caixa para confirmar o aceite e continuar.');
    setBusy(true); setMsg('');
    const {data,error}=await supabase.rpc('accept_current_hocco_legal');
    setBusy(false);
    if(error||data?.ok!==true)return setMsg('Não foi possível registrar o aceite. Tente novamente.');
    setOpen(false);
  }

  async function exit(){ await supabase.auth.signOut(); location.replace('/'); }
  if(!open)return null;

  return <div style={S.backdrop}>
    <section style={S.card}>
      <div style={S.icon}><ShieldCheck/></div>
      <small style={S.kicker}>ATUALIZAÇÃO · HOCCO</small>
      <h2 style={S.title}>Confirme os Termos e a Privacidade.</h2>
      <p style={S.text}>Os documentos explicam as regras de uso, participação, pagamentos, benefícios e tratamento dos seus dados.</p>
      <div style={S.links}><a href="/termos" target="_blank" rel="noreferrer">Termos de Uso</a><a href="/privacidade" target="_blank" rel="noreferrer">Política de Privacidade</a><a href="/regras-hype" target="_blank" rel="noreferrer">Regras da comunidade</a></div>
      <label style={S.check}><input type="checkbox" checked={accepted} onChange={(e)=>setAccepted(e.target.checked)}/><span>Declaro ter <b>18 anos ou mais</b>, li e aceito os Termos de Uso e estou ciente da Política de Privacidade.</span></label>
      {msg&&<div style={S.msg}>{msg}</div>}
      <button style={S.primary} disabled={busy} onClick={confirm}>{busy?'REGISTRANDO...':'ACEITAR E CONTINUAR'}</button>
      <button style={S.exit} disabled={busy} onClick={exit}>Sair da conta</button>
    </section>
  </div>;
}

const S={
  backdrop:{position:'fixed',inset:0,zIndex:60000,background:'rgba(17,17,17,.78)',backdropFilter:'blur(8px)',display:'grid',placeItems:'center',padding:18},
  card:{width:'min(580px,96vw)',background:'#fff',borderRadius:4,padding:24,color:'#111',boxShadow:'0 30px 100px rgba(0,0,0,.38)',fontFamily:'system-ui'},
  icon:{width:48,height:48,borderRadius:3,background:'#fff1eb',color:'#ff5a1f',display:'grid',placeItems:'center',marginBottom:14},
  kicker:{fontSize:10,fontWeight:900,letterSpacing:'.12em',color:'#ff5a1f'},
  title:{fontSize:28,letterSpacing:'-.03em',margin:'7px 0 8px'},
  text:{fontSize:13,lineHeight:1.6,color:'#63758c'},
  links:{display:'flex',gap:8,flexWrap:'wrap',margin:'16px 0'},
  check:{display:'flex',gap:10,alignItems:'flex-start',fontSize:12,lineHeight:1.5,background:'#f7f5f2',border:'1px solid #e5e1dc',borderRadius:3,padding:13},
  msg:{marginTop:10,padding:10,borderRadius:10,background:'#fff3f3',color:'#9f2535',fontSize:12,fontWeight:700},
  primary:{width:'100%',border:0,borderRadius:3,background:'#ff5a1f',color:'#fff',padding:'12px 14px',fontWeight:900,marginTop:14,cursor:'pointer'},
  exit:{width:'100%',border:0,background:'transparent',color:'#65758a',padding:10,fontWeight:700,cursor:'pointer'},
};
