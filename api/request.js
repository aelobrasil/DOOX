const DOOX_APPS_SCRIPT_ENDPOINT = 'https://script.google.com/macros/s/AKfycbwsoDs3kQ-2AC4WLW7_yHl-EQ5_BJvWow-3VG-f5eUz0a46kFR98ZCHSz6wcXgWzRWZmQ/exec';

async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false, error: 'Método não permitido.' });
  }

  try {
    if (req.method === 'GET') {
      const qs = new URLSearchParams(req.query || {}).toString();
      const target = qs ? `${DOOX_APPS_SCRIPT_ENDPOINT}?${qs}` : `${DOOX_APPS_SCRIPT_ENDPOINT}?action=health`;
      const upstream = await fetchWithTimeout(target, {
        method: 'GET',
        redirect: 'follow',
        cache: 'no-store',
        headers: { 'Accept': 'application/json' }
      });

      const raw = await upstream.text();
      let data;
      try {
        data = JSON.parse(raw);
      } catch (_) {
        return res.status(502).json({
          ok: false,
          error: 'A API DOOX retornou uma resposta inesperada.',
          upstreamStatus: upstream.status
        });
      }
      return res.status(upstream.ok ? 200 : 502).json(data);
    }

    const payload = typeof req.body === 'string'
      ? JSON.parse(req.body)
      : (req.body || {});

    const upstream = await fetchWithTimeout(DOOX_APPS_SCRIPT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8', 'Accept': 'application/json' },
      body: JSON.stringify(payload),
      redirect: 'follow',
      cache: 'no-store'
    });

    const raw = await upstream.text();
    let data;
    try {
      data = JSON.parse(raw);
    } catch (_) {
      return res.status(502).json({
        ok: false,
        error: 'A API DOOX retornou uma resposta inesperada.',
        upstreamStatus: upstream.status
      });
    }

    return res.status(upstream.ok ? 200 : 502).json(data);
  } catch (error) {
    const message = error?.name === 'AbortError'
      ? 'A comunicação com o sistema DOOX demorou mais que o permitido. Verifique se a implantação do Apps Script está ativa e acessível.'
      : (error && error.message ? error.message : 'Não foi possível comunicar com a API DOOX.');
    return res.status(502).json({ ok: false, error: message });
  }
}
