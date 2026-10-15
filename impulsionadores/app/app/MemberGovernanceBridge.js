'use client';

import { useEffect, useRef, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function MemberGovernanceBridge() {
  const [state, setState] = useState(null);
  const userRef = useRef(null);

  async function refresh(userId) {
    const { data } = await supabase.from('impulsionadores_perfis').select('governance_status').eq('user_id', userId).maybeSingle();
    setState(data?.governance_status || 'active');
  }

  useEffect(() => {
    let alive = true;
    let channel;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user || !alive) return;
      userRef.current = auth.user.id;
      await refresh(auth.user.id);
      channel = supabase.channel(`member-governance-${auth.user.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'impulsionadores_perfis', filter: `user_id=eq.${auth.user.id}` }, () => refresh(auth.user.id))
        .subscribe();
    })();
    const timer = setInterval(() => {
      if (userRef.current && document.visibilityState === 'visible') refresh(userRef.current);
    }, 30000);
    return () => { alive = false; clearInterval(timer); if (channel) supabase.removeChannel(channel); };
  }, []);

  if (state === 'suspended') return <GovernanceBlock title="Conta temporariamente suspensa" text="Sua conta está preservada, mas novas ações estão bloqueadas até a revisão da HOCCO."/>;
  if (state === 'anonymized') return <GovernanceBlock title="Conta anonimizada" text="Esta conta foi encerrada e os dados pessoais foram anonimizados. O histórico operacional que precisa ser preservado permanece sem identificação pública."/>;
  return null;
}

function GovernanceBlock({ title, text }) {
  return <div style={S.overlay}><section style={S.card}><ShieldAlert size={32}/><small>HOCCO · GOVERNANÇA DA CONTA</small><h1>{title}</h1><p>{text}</p><button onClick={async () => { await supabase.auth.signOut(); location.replace('/'); }}>SAIR DA CONTA</button></section></div>;
}

const S = {
  overlay: { position: 'fixed', inset: 0, zIndex: 60000, background: '#f7f5f2', display: 'grid', placeItems: 'center', padding: 18 },
  card: { width: 'min(520px,100%)', background: '#fff', border: '1px solid #e5e1dc', borderRadius: 4, padding: 24, color: '#111', boxShadow: '0 24px 80px rgba(10,10,10,.16)', display: 'grid', gap: 12, textAlign: 'center' },
};
