'use client';

import { useEffect, useState } from 'react';
import { Download, Eye, EyeOff, Lock, Mail, Phone, UserRound } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { onlyDigits, TERMS_VERSION } from '../lib/config';

const FAST_SIGNUP_URL = 'https://vebqvedmhfaebvdantiu.supabase.co/functions/v1/fast-signup';

export default function Login() {
  const [mode, setMode] = useState('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [appInstalled, setAppInstalled] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { if (data.session) location.replace('/app'); });
    const installedNow = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true || localStorage.getItem('hocco_app_installed') === '1';
    if (installedNow) { setAppInstalled(true); localStorage.setItem('hocco_app_installed', '1'); }
    const handler = (event) => { event.preventDefault(); if (!installedNow) setInstallPrompt(event); };
    const installedHandler = () => { localStorage.setItem('hocco_app_installed', '1'); setAppInstalled(true); setInstallPrompt(null); };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', installedHandler);
    return () => { window.removeEventListener('beforeinstallprompt', handler); window.removeEventListener('appinstalled', installedHandler); };
  }, []);

  async function saveContact(user) {
    if (!user) return;
    const metadataPhone = onlyDigits(phone || user.user_metadata?.phone || '');
    if (!metadataPhone) return;
    await supabase.from('impulsionadores_contatos').upsert({
      user_id: user.id, email: user.email, telefone: metadataPhone, updated_at: new Date().toISOString(),
    });
  }

  async function saveLegalAcceptances(user) {
    if (!user) return;
    await supabase.from('impulsionadores_aceites').upsert([
      { user_id: user.id, documento: 'termos_uso', versao: TERMS_VERSION },
      { user_id: user.id, documento: 'privacidade', versao: TERMS_VERSION },
    ], { onConflict: 'user_id,documento,versao' });
  }

  async function submit(event) {
    event.preventDefault(); setMsg('');
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = onlyDigits(phone);
    if (password.length < 6) return setMsg('Use uma senha com pelo menos 6 caracteres.');
    if (mode === 'signup' && password !== confirmPassword) return setMsg('As senhas não coincidem.');
    if (mode === 'signup' && normalizedPhone.length < 10) return setMsg('Informe um telefone/WhatsApp válido.');
    if (mode === 'signup' && !accepted) return setMsg('Leia e aceite os Termos de Uso e a Política de Privacidade para continuar.');
    setBusy(true);

    if (mode === 'signup') {
      try {
        const response = await fetch(FAST_SIGNUP_URL, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim(), email: normalizedEmail, phone: normalizedPhone, password }),
        });
        let result = {}; try { result = await response.json(); } catch { result = {}; }
        if (!response.ok) { setBusy(false); return setMsg(result.error || 'Não foi possível criar sua conta agora.'); }
        const { data, error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
        if (error || !data.session) { setBusy(false); return setMsg('Conta criada. Toque em Entrar e use seu e-mail e senha.'); }
        await Promise.all([saveContact(data.user), saveLegalAcceptances(data.user)]);
        location.replace('/app'); return;
      } catch {
        setBusy(false); return setMsg('Não foi possível concluir o cadastro. Verifique sua conexão e tente novamente.');
      }
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
    if (error) { setBusy(false); return setMsg('E-mail ou senha inválidos.'); }
    await saveContact(data.user); location.replace('/app');
  }

  async function forgotPassword() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return setMsg('Informe seu e-mail e toque novamente em Esqueci minha senha.');
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, { redirectTo: `${location.origin}/redefinir-senha` });
    setBusy(false);
    if (error) return setMsg('Não foi possível iniciar a recuperação agora.');
    setMsg('Enviamos um link de recuperação para o e-mail informado.');
  }

  async function install() {
    if (appInstalled) return;
    if (installPrompt) {
      installPrompt.prompt(); const choice = await installPrompt.userChoice; setInstallPrompt(null);
      if (choice?.outcome === 'accepted') { localStorage.setItem('hocco_app_installed', '1'); setAppInstalled(true); }
    } else alert('No celular, abra o menu do navegador e escolha “Adicionar à tela inicial” ou “Instalar app”.');
  }

  return <div className="auth authSimple">
    <div className="authBrand"><b>HOCCO</b><span>IMPULSIONADORES</span></div>
    <div className="authCard">
      <small>COMUNIDADE HOCCO</small>
      <h1>{mode === 'signup' ? 'Entre em poucos segundos.' : 'Entre na sua conta.'}</h1>
      <p>{mode === 'signup' ? 'Nome, telefone, e-mail e senha. Criou a conta, já entra no app.' : 'Continue sua ofensiva, seu HC, seus Hypes e suas experiências.'}</p>
      <form onSubmit={submit}>
        {mode === 'signup' && <><label>Nome<div className="inputIcon"><UserRound/><input value={name} onChange={(e)=>setName(e.target.value)} placeholder="Seu nome" required minLength="2" maxLength="40"/></div></label><label>Telefone / WhatsApp<div className="inputIcon"><Phone/><input inputMode="tel" value={phone} onChange={(e)=>setPhone(e.target.value)} placeholder="(14) 99999-9999" required/></div></label></>}
        <label>E-mail<div className="inputIcon"><Mail/><input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="voce@email.com" required/></div></label>
        <label>Senha<div className="inputIcon"><Lock/><input className="passwordField" type={showPassword?'text':'password'} value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" required minLength="6"/><button type="button" className="passwordToggle" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword?'Ocultar senha':'Ver senha'}>{showPassword?<EyeOff/>:<Eye/>}<span>{showPassword?'OCULTAR':'VER'}</span></button></div></label>
        {mode === 'signup' && <label>Confirmar senha<div className="inputIcon"><Lock/><input className="passwordField" type={showConfirmPassword?'text':'password'} value={confirmPassword} onChange={(e)=>setConfirmPassword(e.target.value)} placeholder="Digite a senha novamente" required minLength="6"/><button type="button" className="passwordToggle" onClick={()=>setShowConfirmPassword(v=>!v)} aria-label={showConfirmPassword?'Ocultar confirmação':'Ver confirmação'}>{showConfirmPassword?<EyeOff/>:<Eye/>}<span>{showConfirmPassword?'OCULTAR':'VER'}</span></button></div></label>}
        {mode === 'signup' && <label className="legalCheck"><input type="checkbox" checked={accepted} onChange={(e)=>setAccepted(e.target.checked)}/><span>Li e aceito os <a href="/termos" target="_blank">Termos de Uso</a> e a <a href="/privacidade" target="_blank">Política de Privacidade</a>.</span></label>}
        {msg && <div className="authMsg">{msg}</div>}
        <button className="primary" disabled={busy}>{busy?'PROCESSANDO...':mode==='signup'?'CRIAR CONTA E ENTRAR':'ENTRAR'}</button>
      </form>
      {mode === 'login' && <button className="forgotLink" onClick={forgotPassword} disabled={busy}>Esqueci minha senha</button>}
      <button className="switch" onClick={()=>{setMode(mode==='signup'?'login':'signup');setMsg('');setConfirmPassword('');setAccepted(false);setShowPassword(false);setShowConfirmPassword(false)}}>{mode==='signup'?'Já tenho conta · Entrar':'Criar minha conta'}</button>
    </div>
    {!appInstalled&&<button className="downloadAuth" onClick={install}><Download/> Baixar app no celular</button>}
    <p className="authFoot">HOCCO · participação, Hype, HC, Impulsão e experiências em uma única conta.</p>
  </div>;
}
