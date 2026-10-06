'use client';

import { useEffect, useState } from 'react';
import { BellRing, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

const VAPID_PUBLIC_KEY = 'BK8hSY4lUrobblN9ngBB95yyRkvpIBDdb003Y3swZmqlFOLsSA7qoPXly2d7fUptPxjZo3da6-g4xx4E94XCEIo';

function base64UrlToUint8Array(value) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

function isStandalone() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

async function registerPeriodicReminder(registration) {
  if (!('periodicSync' in registration)) return false;
  try {
    await registration.periodicSync.register('hocco-daily-reminder', { minInterval: 24 * 60 * 60 * 1000 });
    return true;
  } catch {
    return false;
  }
}

export default function PwaExperience() {
  const [installed, setInstalled] = useState(false);
  const [permission, setPermission] = useState('unsupported');
  const [showPrompt, setShowPrompt] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const syncInstalled = () => {
      const active = isStandalone();
      setInstalled(active);
      document.documentElement.classList.toggle('pwa-installed', active);
      return active;
    };

    syncInstalled();
    const appInstalled = () => {
      document.documentElement.classList.add('pwa-installed');
      setInstalled(true);
      setTimeout(() => {
        if ('Notification' in window && Notification.permission === 'default' && location.pathname === '/app') setShowPrompt(true);
      }, 1200);
    };
    const media = window.matchMedia?.('(display-mode: standalone)');
    const mediaChanged = () => syncInstalled();
    window.addEventListener('appinstalled', appInstalled);
    media?.addEventListener?.('change', mediaChanged);

    if ('Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window) {
      setPermission(Notification.permission);
    }

    return () => {
      window.removeEventListener('appinstalled', appInstalled);
      media?.removeEventListener?.('change', mediaChanged);
    };
  }, []);

  useEffect(() => {
    if (location.pathname !== '/app') return;
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return;

    let timer;
    if (permission === 'granted') {
      ensureSubscription(false);
    } else if (installed && permission === 'default') {
      timer = setTimeout(() => setShowPrompt(true), 2600);
    }
    return () => clearTimeout(timer);
  }, [installed, permission]);

  async function ensureSubscription(requestPermission) {
    try {
      setBusy(true);
      setMessage('');
      let currentPermission = Notification.permission;
      if (requestPermission && currentPermission === 'default') currentPermission = await Notification.requestPermission();
      setPermission(currentPermission);
      if (currentPermission !== 'granted') {
        setShowPrompt(false);
        if (currentPermission === 'denied') setMessage('As notificações foram bloqueadas no navegador.');
        return;
      }

      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      const registration = await navigator.serviceWorker.ready;
      await registerPeriodicReminder(registration);

      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64UrlToUint8Array(VAPID_PUBLIC_KEY),
        });
      }
      const json = subscription.toJSON();
      const { error } = await supabase.rpc('register_push_subscription', {
        p_endpoint: json.endpoint,
        p_p256dh: json.keys?.p256dh,
        p_auth: json.keys?.auth,
        p_device: navigator.userAgent,
      });
      if (error) throw error;
      setShowPrompt(false);
      setMessage('Lembretes HOCCO ativados.');
      setTimeout(() => setMessage(''), 3500);
    } catch (error) {
      console.error('HOCCO notification registration failed', error);
      setMessage('Não foi possível ativar os lembretes neste aparelho.');
    } finally {
      setBusy(false);
    }
  }

  if (typeof window === 'undefined' || location.pathname !== '/app') return null;

  return <>
    {showPrompt && permission === 'default' && <aside className="pushPrompt" role="dialog" aria-label="Ativar lembretes HOCCO">
      <button className="pushPromptClose" aria-label="Agora não" onClick={() => setShowPrompt(false)}><X/></button>
      <span className="pushPromptIcon"><BellRing/></span>
      <div><small>LEMBRETES HOCCO</small><b>Mantenha sua ofensiva ativa.</b><p>Receba avisos para entrar no dia certo, completar seu HC e acompanhar benefícios HOCCO.</p></div>
      <button className="pushPromptAction" disabled={busy} onClick={() => ensureSubscription(true)}>{busy ? 'ATIVANDO...' : 'ATIVAR LEMBRETES'}</button>
    </aside>}
    {message && <div className="pwaMessage">{message}</div>}
  </>;
}
