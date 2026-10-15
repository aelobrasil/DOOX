'use client';

import { useEffect, useState } from 'react';
import { Eye, EyeOff, Lock, Mail, Phone, UserRound } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { onlyDigits, TERMS_VERSION } from '../lib/config';

const FAST_SIGNUP_URL = 'https://vebqvedmhfaebvdantiu.supabase.co/functions/v1/fast-signup';

export default function Login() {
  const [mode, setMode] = useState('welcome');
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

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { if (data.session) location.replace('/app'); });
  }, []);

  async function submit(event) {
    event.preventDefault();
    setMsg('');
    const normalizedEmail = email.trim().toLowerCase();
    let normalizedPhone = onlyDigits(phone);
    if ((normalizedPhone.length === 12 || normalizedPhone.length === 13) && normalizedPhone.startsWith('55')) normalizedPhone = normalizedPhone.slice(2);

    if (password.length < 8) return setMsg('Use uma senha com pelo menos 8 caracteres.');
    if (mode === 'signup' && password !== confirmPassword) return setMsg('As senhas não coincidem.');
    if (mode === 'signup' && (normalizedPhone.length < 10 || normalizedPhone.length > 11)) return setMsg('Informe um telefone/WhatsApp válido com DDD.');
    if (mode === 'signup' && !accepted) return setMsg('Para criar a conta, declare que tem 18 anos ou mais e aceite os Termos de Uso atuais.');

    setBusy(true);
    if (mode === 'signup') {
      try {
        const response = await fetch(FAST_SIGNUP_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            email: normalizedEmail,
            phone: normalizedPhone,
            password,
            accepted: true,
            adult: true,
            terms_version: TERMS_VERSION,
          }),
        });
        let result = {};
        try { result = await response.json(); } catch {}
        if (!response.ok) {
          setBusy(false);
          return setMsg(result.error || 'Não foi possível criar sua conta agora.');
        }
        const { data, error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
        if (error || !data.session) {
          setBusy(false);
          return setMsg('Conta criada. Toque em Entrar e use seu e-mail e senha.');
        }
        location.replace('/app');
        return;
      } catch {
        setBusy(false);
        return setMsg('Não foi possível concluir o cadastro. Verifique sua conexão e tente novamente.');
      }
    }

    const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
    setBusy(false);
    if (error) return setMsg('E-mail ou senha inválidos.');
    location.replace('/app');
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

  function switchMode() {
    setMode(mode === 'signup' ? 'login' : 'signup');
    setMsg('');
    setConfirmPassword('');
    setAccepted(false);
    setShowPassword(false);
    setShowConfirmPassword(false);
  }

  return <div className={`auth authSimple ${mode === 'welcome' ? 'authWelcome' : ''}`}>
    <div className="authBrand"><b>HOCCO<span className="authPeriod">.</span></b></div>
    {mode === 'welcome' ? <section className="authIntro"><span className="authRec"><i/> GRAVANDO</span><h1>Você chegou no meio da história.</h1><p>Uma série documental independente que acompanha uma trajetória real enquanto ela ainda está acontecendo.</p><button className="authIntroPrimary" onClick={() => setMode('signup')}>Entrar na história</button><button className="authIntroSecondary" onClick={() => setMode('login')}>Já sou membro <span>→</span></button><small>Uma produção original DOOX Studios</small></section> : <div className="authCard">
      <button className="authBack" onClick={() => { setMode('welcome'); setMsg(''); }}>← HOCCO.</button>
      <small>{mode === 'signup' ? 'FAÇA PARTE DA HISTÓRIA' : 'BEM-VINDO DE VOLTA'}</small>
      <h1>{mode === 'signup' ? 'Entre para acompanhar de perto.' : 'Continue de onde parou.'}</h1>
      <p>{mode === 'signup' ? 'Crie sua conta para acompanhar os bastidores e os próximos acontecimentos.' : 'Acesse sua área de membro HOCCO.'}</p>
      <form onSubmit={submit}>
        {mode === 'signup' && <>
          <label>Nome<div className="inputIcon"><UserRound/><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" required minLength="2" maxLength="40"/></div></label>
          <label>Telefone / WhatsApp<div className="inputIcon"><Phone/><input inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(14) 99999-9999" required/></div></label>
        </>}
        <label>E-mail<div className="inputIcon"><Mail/><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" required/></div></label>
        <label>Senha<div className="inputIcon"><Lock/><input className="passwordField" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 8 caracteres" required minLength="8"/><button type="button" className="passwordToggle" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Ocultar senha' : 'Ver senha'}>{showPassword ? <EyeOff/> : <Eye/>}<span>{showPassword ? 'OCULTAR' : 'VER'}</span></button></div></label>
        {mode === 'signup' && <label>Confirmar senha<div className="inputIcon"><Lock/><input className="passwordField" type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Digite a senha novamente" required minLength="8"/><button type="button" className="passwordToggle" onClick={() => setShowConfirmPassword((v) => !v)} aria-label={showConfirmPassword ? 'Ocultar confirmação' : 'Ver confirmação'}>{showConfirmPassword ? <EyeOff/> : <Eye/>}<span>{showConfirmPassword ? 'OCULTAR' : 'VER'}</span></button></div></label>}
        {mode === 'signup' && <label className="legalCheck"><input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)}/><span>Declaro ter <b>18 anos ou mais</b>, li e aceito os <a href="/termos" target="_blank">Termos de Uso</a> e estou ciente da <a href="/privacidade" target="_blank">Política de Privacidade e Ciclo de Vida de Dados</a>.</span></label>}
        {msg && <div className="authMsg">{msg}</div>}
        <button className="primary" disabled={busy}>{busy ? 'PROCESSANDO...' : mode === 'signup' ? 'CRIAR CONTA E ENTRAR' : 'ENTRAR'}</button>
      </form>
      {mode === 'login' && <button className="forgotLink" onClick={forgotPassword} disabled={busy}>Esqueci minha senha</button>}
      <button className="switch" onClick={switchMode}>{mode === 'signup' ? 'Já sou membro · Entrar' : 'Criar minha conta'}</button>
    </div>}
    {mode !== 'welcome' && <p className="authFoot">Uma produção original DOOX Studios · HOCCO.</p>}
  </div>;
}
