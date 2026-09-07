const DOOX_APPS_SCRIPT_ENDPOINT = 'https://script.google.com/macros/s/AKfycbwsoDs3kQ-2AC4WLW7_yHl-EQ5_BJvWow-3VG-f5eUz0a46kFR98ZCHSz6wcXgWzRWZmQ/exec';

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false, error: 'Método não permitido.' });
  }

  try {
    if (req.method === 'GET') {
      const qs = new URLSearchParams(req.query || {}).toString();
      const target = qs ? `${DOOX_APPS_SCRIPT_ENDPOINT}?${qs}` : `${DOOX_APPS_SCRIPT_ENDPOINT}?action=health`;
      const upstream = await fetch(target, {
        method: 'GET',
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
    }

    const payload = typeof req.body === 'string'
      ? JSON.parse(req.body)
      : (req.body || {});

    const upstream = await fetch(DOOX_APPS_SCRIPT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      redirect: 'follow'
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
    return res.status(502).json({
      ok: false,
      error: error && error.message ? error.message : 'Não foi possível comunicar com a API DOOX.'
    });
  }
}
