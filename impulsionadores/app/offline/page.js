export const metadata = { title: 'HOCCO. · offline', robots: { index: false, follow: false } };

export default function OfflinePage() {
  return <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f7f5f2', padding: 18, fontFamily: 'Inter,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif', color: '#111' }}>
    <section style={{ width: 'min(440px,100%)', background: '#fff', border: '1px solid #e5e1dc', borderRadius: 4, padding: 28 }}>
      <div style={{ fontWeight: 950, fontSize: 28, letterSpacing: '-1.7px' }}>HOCCO<span style={{ color: '#ff5a1f' }}>.</span></div>
      <small style={{ display: 'block', margin: '26px 0 16px', color: '#77736f', fontSize: 9, fontWeight: 900, letterSpacing: '.13em' }}>● CONEXÃO INTERROMPIDA</small>
      <h1 style={{ fontSize: 25, letterSpacing: '-.04em', margin: '0 0 8px' }}>Você está offline.</h1>
      <p style={{ fontSize: 12, lineHeight: 1.6, color: '#716d69' }}>Sua conta continua segura. Reconecte-se para acompanhar a história, abrir bastidores e ver as experiências disponíveis.</p>
      <a href="/" style={{ display: 'inline-block', textDecoration: 'none', background: '#111', color: '#fff', borderRadius: 3, padding: '12px 16px', fontWeight: 850, fontSize: 10 }}>TENTAR NOVAMENTE</a>
    </section>
  </main>;
}
