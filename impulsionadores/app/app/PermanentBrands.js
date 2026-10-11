'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';

export default function PermanentBrands() {
  const [rows, setRows] = useState([]);
  const [board, setBoard] = useState(1);

  useEffect(() => {
    let mounted = true;
    async function bootstrap() {
      const { data } = await supabase.auth.getSession();
      if (mounted && data.session?.user) await load();
    }
    bootstrap();
    const { data: auth } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user && ['SIGNED_IN', 'TOKEN_REFRESHED', 'INITIAL_SESSION'].includes(event)) load();
      if (!session?.user && event === 'SIGNED_OUT') setRows([]);
    });
    const timer = setInterval(() => setBoard((current) => (current === 4 ? 1 : current + 1)), 12000);
    return () => {
      mounted = false;
      auth.subscription.unsubscribe();
      clearInterval(timer);
    };
  }, []);

  async function load() {
    const { data, error } = await supabase.rpc('marcas_permanentes_ativas', { p_quadro: null });
    if (!error) setRows(data || []);
  }

  const visible = useMemo(
    () => rows.filter((row) => Number(row.quadro) === board).sort((a, b) => Number(a.posicao) - Number(b.posicao)),
    [rows, board],
  );

  useEffect(() => {
    if (!visible.length) return;
    visible.forEach((row) => {
      supabase.rpc('registrar_patrocinio_evento', {
        p_id: row.id,
        p_event: 'impression',
        p_placement: `app_quadro_${row.quadro}`,
      });
    });
  }, [visible]);

  async function go(row) {
    const { data, error } = await supabase.rpc('registrar_patrocinio_evento', {
      p_id: row.id,
      p_event: 'click',
      p_placement: `app_quadro_${row.quadro}`,
    });
    if (!error && data) window.open(data, '_blank', 'noopener,noreferrer');
  }

  if (!rows.length) return null;

  return (
    <aside style={S.wrap}>
      <div style={S.head}>
        <span>Marcas Permanentes</span>
        <div style={S.dots}>{[1, 2, 3, 4].map((number) => <button aria-label={`Quadro ${number}`} onClick={() => setBoard(number)} key={number} style={{ ...S.dot, opacity: number === board ? 1 : 0.3 }}>{number}</button>)}</div>
      </div>
      <div style={S.logos}>
        {visible.map((row) => <button title={row.nome_fantasia} aria-label={`Abrir ${row.nome_fantasia}`} key={row.id} onClick={() => go(row)} style={S.brand}><img src={row.logo_url} alt={row.nome_fantasia} style={{ maxWidth: '100%', maxHeight: 34, objectFit: 'contain' }} /></button>)}
      </div>
    </aside>
  );
}

const S = {
  wrap: { position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 74, zIndex: 7000, width: 'min(520px,calc(100% - 24px))', background: 'rgba(255,255,255,.96)', border: '1px solid #e2e8f0', borderRadius: 18, padding: '8px 10px', boxShadow: '0 12px 35px rgba(15,35,65,.12)', backdropFilter: 'blur(12px)' },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 9, fontWeight: 900, color: '#738197', textTransform: 'uppercase', letterSpacing: '.08em' },
  dots: { display: 'flex', gap: 3 },
  dot: { width: 18, height: 18, border: 0, borderRadius: 99, background: '#075eea', color: '#fff', fontSize: 8, fontWeight: 900, cursor: 'pointer' },
  logos: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginTop: 5 },
  brand: { height: 44, border: 0, borderRadius: 11, background: '#f7f9fc', display: 'grid', placeItems: 'center', padding: 5, cursor: 'pointer' },
};
