'use client';

import { useEffect, useState } from 'react';
import { Download, Lock, Mail, Phone, UserRound } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { onlyDigits } from '../lib/config';

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

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = onlyDigits(phone);

    if (password.length < 6) return setMsg('Use uma senha com pelo menos 6 caracteres.');
    if (mode === 'signup' && password !== confirmPassword) return setMsg('As senhas não coincidem.');
    if (mode === 'signup' && normalizedPhone.length < 10) return setMsg('Informe um telefone/WhatsApp válido.');

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
          }),
        });

        let result = {};
        try {
          result = await response.json();
        } catch {
          result = {};
        }

        if (!response.ok) {
          setBusy(false);
          return setMsg(result.error || 'Não foi possível criar sua conta agora.');
        }

        const { data, error } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });

        if (error || !data.session) {
          setBusy(false);
          return setMsg('Conta criada. Toque em Entrar e use seu e-mail e senha.');
        }

        await saveContact(data.user);
        location.replace('/app');
        return;
      } catch {
        setBusy(false);
        return setMsg('Não foi possível concluir o cadastro. Verifique sua conexão e tente novamente.');
      }
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
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

  const toggleStyle = {
    position: 'absolute',
    right: 8,
    top: 15,
    border: 0,
    background: 'transparent',
    color: '#075eea',
    fontSize: 10,
    fontWeight: 900,
    padding: '10px 7px',
    zIndex: 2,
  };

  return (
    <div className="auth authSimple">
      <div className="authBrand"><b>HOCCO</b><span>IMPULSIONADORES</span></div>
      <div className="authCard">
        <small>COMUNIDADE HOCCO</small>
        <h1>{mode === 'signup' ? 'Entre em poucos segundos.' : 'Entre na sua conta.'}</h1>
        <p>{mode === 'signup' ? 'Nome, telefone, e-mail e senha. Criou a conta, já entra no app.' : 'Continue sua ofensiva, seu HC e seus Hypes.'}</p>
        <form onSubmit={submit}>
          {mode === 'signup' && (
            <>
              <label>Nome<div className="inputIcon"><UserRound/><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" required minLength="2" maxLength="40" /></div></label>
              <label>Telefone / WhatsApp<div className="inputIcon"><Phone/><input inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(14) 99999-9999" required /></div></label>
            </>
          )}
          <label>E-mail<div className="inputIcon"><Mail/><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" required /></div></label>
          <label>Senha
            <div className="inputIcon">
              <Lock/>
              <input style={{ paddingRight: 76 }} type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" required minLength="6" />
              <button type="button" style={toggleStyle} onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Ocultar senha' : 'Ver senha'}>{showPassword ? 'OCULTAR' : 'VER'}</button>
            </div>
          </label>
          {mode === 'signup' && (
            <label>Confirmar senha
              <div className="inputIcon">
                <Lock/>
                <input style={{ paddingRight: 76 }} type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Digite a senha novamente" required minLength="6" />
                <button type="button" style={toggleStyle} onClick={() => setShowConfirmPassword((value) => !value)} aria-label={showConfirmPassword ? 'Ocultar confirmação de senha' : 'Ver confirmação de senha'}>{showConfirmPassword ? 'OCULTAR' : 'VER'}</button>
              </div>
            </label>
          )}
          {msg && <div className="authMsg">{msg}</div>}
          <button className="primary" disabled={busy}>{busy ? 'CRIANDO SUA CONTA...' : mode === 'signup' ? 'CRIAR CONTA E ENTRAR' : 'ENTRAR'}</button>
        </form>
        <button className="switch" onClick={() => {
          const nextMode = mode === 'signup' ? 'login' : 'signup';
          setMode(nextMode);
          setMsg('');
          setConfirmPassword('');
          setShowPassword(false);
          setShowConfirmPassword(false);
        }}>
          {mode === 'signup' ? 'Já tenho conta · Entrar' : 'Criar minha conta'}
        </button>
      </div>
      <button className="downloadAuth" onClick={install}><Download/> Baixar app no celular</button>
      <p className="authFoot">HOCCO · participação, Hype e experiências em uma única conta.</p>
    </div>
  );
}
