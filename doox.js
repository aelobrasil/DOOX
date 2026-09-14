export default async function handler(req, res) {
  const base = process.env.APPS_SCRIPT_WEBAPP_URL;
  if (!base) {
    return res.status(503).json({
      ok: false,
      message: 'Integração DOOX ainda não configurada no Vercel. Defina APPS_SCRIPT_WEBAPP_URL nas variáveis de ambiente.'
    });
  }

  const incomingUrl = new URL(req.url, `https://${req.headers.host || 'doox-omega.vercel.app'}`);
  const action = incomingUrl.searchParams.get('action') || (req.body && req.body.action) || 'health';
  const target = new URL(base);
  target.searchParams.set('action', action);

  if (req.method === 'GET') {
    for (const [key, value] of incomingUrl.searchParams.entries()) {
      if (key !== 'action') target.searchParams.set(key, value);
    }
  }

  try {
    const options = {
      method: req.method,
      headers: {
        'Accept': 'application/json'
      }
    };

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      options.headers['Content-Type'] = 'application/json';
      let body = req.body || {}; if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } } options.body = JSON.stringify(body);
    }

    const upstream = await fetch(target.toString(), options);
    const text = await upstream.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (_) {
      data = { ok: false, message: 'Resposta inválida do serviço DOOX.' };
    }

    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return res.status(upstream.ok ? 200 : upstream.status).json(data);
  } catch (error) {
    return res.status(502).json({
      ok: false,
      message: 'Não foi possível conectar ao serviço DOOX.'
    });
  }
}
