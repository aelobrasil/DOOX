'use client';

import { useEffect, useState } from 'react';
import { BellRing, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

function base64UrlToUint8Array(value) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

function keysMatch(applicationServerKey, expected) {
  if (!applicationServerKey) return false;
  try {
    const current = new Uint8Array(applicationServerKey);
    if (current.length !== expected.length) return false;
    return current.every((value, index) => value === expected[index]);
  } catch {
    return false;
  }
}

async function loadPushConfig() {
  const { data, error } = await supabase.rpc('push_public_config');
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.enabled || !row?.vapid_public_key || !row?.vapid_version) throw new Error('push_unavailable');
  return row;
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
    };
    const media = window.matchMedia?.('(display-mode: standalone)');
    const mediaChanged = () => syncInstalled();
    const requestPush = () => {
      if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
        setMessage('Este navegador não oferece lembretes push. A HOCCO continua funcionando normalmente.');
        return;
      }
      if (Notification.permission === 'granted') ensureSubscription(false);
      else if (Notification.permission === 'default') setShowPrompt(true);
      else setMessage('As notificações estão bloqueadas nas permissões deste navegador.');
    };
    window.addEventListener('appinstalled', appInstalled);
    window.addEventListener('hocco:request-push', requestPush);
    media?.addEventListener?.('change', mediaChanged);

    if ('Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window) {
      setPermission(Notification.permission);
    }

    return () => {
      window.removeEventListener('appinstalled', appInstalled);
      window.removeEventListener('hocco:request-push', requestPush);
      media?.removeEventListener?.('change', mediaChanged);
    };
  }, []);

  useEffect(() => {
    if (location.pathname !== '/app') return;
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return;

    if (permission === 'granted') {
      ensureSubscription(false);
    }
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
        if (currentPermission === 'denied') setMessage('As notificações foram bloqueadas no navegador. O app continua funcionando normalmente.');
        return;
      }

      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      const registration = await navigator.serviceWorker.ready;
      await registerPeriodicReminder(registration);

      const config = await loadPushConfig();
      const applicationServerKey = base64UrlToUint8Array(config.vapid_public_key);
      let subscription = await registration.pushManager.getSubscription();

      if (subscription && !keysMatch(subscription.options?.applicationServerKey, applicationServerKey)) {
        try { await supabase.rpc('disable_my_push_subscription', { p_endpoint: subscription.endpoint }); } catch {}
        try { await subscription.unsubscribe(); } catch {}
        subscription = null;
      }

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });
      }

      const json = subscription.toJSON();
      const { error } = await supabase.rpc('register_push_subscription', {
        p_endpoint: json.endpoint,
        p_p256dh: json.keys?.p256dh,
        p_auth: json.keys?.auth,
        p_device: navigator.userAgent,
        p_vapid_version: Number(config.vapid_version),
      });
      if (error) throw error;
      setShowPrompt(false);
      setMessage('Lembretes HOCCO ativados. Você pode desativá-los a qualquer momento nas permissões do aparelho.');
      setTimeout(() => setMessage(''), 4500);
    } catch (error) {
      console.error('HOCCO notification registration failed', error);
      setMessage('Não foi possível ativar os lembretes neste aparelho. O app continua funcionando normalmente.');
    } finally {
      setBusy(false);
    }
  }

  if (typeof window === 'undefined' || location.pathname !== '/app') return null;

  return <>
    {showPrompt && permission === 'default' && <aside className="pushPrompt" role="dialog" aria-label="Ativar lembretes HOCCO">
      <button className="pushPromptClose" aria-label="Agora não" onClick={() => setShowPrompt(false)}><X/></button>
      <span className="pushPromptIcon"><BellRing/></span>
      <div><small>LEMBRETES HOCCO</small><b>Mantenha sua ofensiva ativa.</b><p>Se quiser, permita avisos para entrar no dia certo, completar seu HC e acompanhar benefícios. É opcional e não altera sua participação.</p></div>
      <button className="pushPromptAction" disabled={busy} onClick={() => ensureSubscription(true)}>{busy ? 'ATIVANDO...' : 'ATIVAR LEMBRETES'}</button>
    </aside>}
    {message && <div className="pwaMessage">{message}</div>}
  </>;
}
