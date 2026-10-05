'use client';

import { useEffect, useState } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function ResetPassword(){
  const [password,setPassword]=useState('');
  const [confirm,setConfirm]=useState('');
  const [show,setShow]=useState(false);
  const [busy,setBusy]=useState(false);
  const [msg,setMsg]=useState('Validando link seguro...');
  const [ready,setReady]=useState(false);

  useEffect(()=>{
    supabase.auth.getSession().then(({data})=>{setReady(Boolean(data.session));setMsg(data.session?'Defina sua nova senha.':'Abra esta página pelo link de recuperação enviado ao seu e-mail.');});
    const {data}=supabase.auth.onAuthStateChange((event,session)=>{if(event==='PASSWORD_RECOVERY'||session){setReady(true);setMsg('Defina sua nova senha.')}});
    return()=>data.subscription.unsubscribe();
  },[]);

  async function submit(e){
    e.preventDefault();
    if(password.length<6)return setMsg('Use pelo menos 6 caracteres.');
    if(password!==confirm)return setMsg('As senhas não coincidem.');
    setBusy(true);
    const {error}=await supabase.auth.updateUser({password});
    setBusy(false);
    if(error)return setMsg('Não foi possível alterar a senha. Solicite um novo link de recuperação.');
    setMsg('Senha alterada com sucesso. Entrando no aplicativo...');
    setTimeout(()=>location.replace('/app'),700);
  }

  return <main className="auth authSimple"><div className="authBrand"><b>HOCCO</b><span>SEGURANÇA</span></div><div className="authCard"><small>RECUPERAÇÃO DE CONTA</small><h1>Nova senha</h1><p>{msg}</p>{ready&&<form onSubmit={submit}><label>Nova senha<div className="inputIcon"><Lock/><input className="passwordField" type={show?'text':'password'} value={password} onChange={(e)=>setPassword(e.target.value)} minLength="6" required/><button className="passwordToggle" type="button" onClick={()=>setShow(v=>!v)}>{show?<EyeOff/>:<Eye/>}<span>{show?'OCULTAR':'VER'}</span></button></div></label><label>Confirmar nova senha<div className="inputIcon"><Lock/><input type={show?'text':'password'} value={confirm} onChange={(e)=>setConfirm(e.target.value)} minLength="6" required/></div></label><button className="primary" disabled={busy}>{busy?'SALVANDO...':'SALVAR NOVA SENHA'}</button></form>}<button className="switch" onClick={()=>location.href='/'}>Voltar ao acesso</button></div></main>
}
