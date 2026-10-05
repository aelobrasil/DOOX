'use client';

import { useEffect, useState } from 'react';
import { Download, Lock, Mail, Phone, UserRound } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { onlyDigits } from '../lib/config';

export default function Login() {
  const [mode, setMode] = useState('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) location.replace('/app');
    });
    const handler = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  async function saveContact(user) {
    if (!user) return;
    const metadataPhone = onlyDigits(phone || user.user_metadata?.phone || '');
    if (!metadataPhone) return;
    await supabase.from('impulsionadores_contatos').upsert({
      user_id: user.id,
      email: user.email,
      telefone: metadataPhone,
      updated_at: new Date().toISOString(),
    });
  }

  async function submit(event) {
    event.preventDefault();
    setMsg('');
    if (password.length < 6) return setMsg('Use uma senha com pelo menos 6 caracteres.');
    if (mode === 'signup' && onlyDigits(phone).length < 10) return setMsg('Informe um telefone/WhatsApp válido.');
    setBusy(true);

    if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: { full_name: name.trim(), phone: onlyDigits(phone) },
          emailRedirectTo: `${location.origin}/app`,
        },
      });
      if (error) {
        setBusy(false);
        return setMsg(error.message);
      }
      if (data.session) {
        await saveContact(data.user);
        location.replace('/app');
        return;
      }
      setBusy(false);
      setMsg('Conta criada. Se a confirmação de e-mail estiver ativa, confirme o e-mail e depois entre.');
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error) {
      setBusy(false);
      return setMsg('E-mail ou senha inválidos.');
    }
    await saveContact(data.user);
    location.replace('/app');
  }

  async function install() {
    if (installPrompt) {
      installPrompt.prompt();
      await installPrompt.userChoice;
      setInstallPrompt(null);
    } else {
      alert('No celular, abra o menu do navegador e escolha “Adicionar à tela inicial” ou “Instalar app”.');
    }
  }

  return (
    <div className="auth authSimple">
      <div className="authBrand"><b>HOCCO</b><span>IMPULSIONADORES</span></div>
      <div className="authCard">
        <small>COMUNIDADE HOCCO</small>
        <h1>{mode === 'signup' ? 'Entre em poucos segundos.' : 'Entre na sua conta.'}</h1>
        <p>{mode === 'signup' ? 'Quatro dados. Sua conta fica pronta para Hype, HC, missões e experiências.' : 'Continue sua ofensiva, seu HC e seus Hypes.'}</p>
        <form onSubmit={submit}>
          {mode === 'signup' && (
            <>
              <label>Nome<div className="inputIcon"><UserRound/><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" required minLength="2" maxLength="40" /></div></label>
              <label>Telefone / WhatsApp<div className="inputIcon"><Phone/><input inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(14) 99999-9999" required /></div></label>
            </>
          )}
          <label>E-mail<div className="inputIcon"><Mail/><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" required /></div></label>
          <label>Senha<div className="inputIcon"><Lock/><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" required minLength="6" /></div></label>
          {msg && <div className="authMsg">{msg}</div>}
          <button className="primary" disabled={busy}>{busy ? 'AGUARDE...' : mode === 'signup' ? 'CRIAR CONTA E ENTRAR' : 'ENTRAR'}</button>
        </form>
        <button className="switch" onClick={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setMsg(''); }}>
          {mode === 'signup' ? 'Já tenho conta · Entrar' : 'Criar minha conta'}
        </button>
      </div>
      <button className="downloadAuth" onClick={install}><Download/> Baixar app no celular</button>
      <p className="authFoot">HOCCO · participação, Hype e experiências em uma única conta.</p>
    </div>
  );
}
