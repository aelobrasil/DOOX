const DOOX_APPS_SCRIPT_ENDPOINT = 'https://script.google.com/macros/s/AKfycbwsoDs3kQ-2AC4WLW7_yHl-EQ5_BJvWow-3VG-f5eUz0a46kFR98ZCHSz6wcXgWzRWZmQ/exec';
const PUBLIC_KEYS=['name','whatsapp','email','type','modality','moment','quantity','profile','observation','termsAccepted','rulesAccepted'];

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow','POST'); return res.status(405).json({ok:false,error:'Método não permitido.'}); }
  try {
    const raw = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const payload={}; PUBLIC_KEYS.forEach(k=>{payload[k]=raw[k];});
    const upstream=await fetch(DOOX_APPS_SCRIPT_ENDPOINT,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload),redirect:'follow'});
    const text=await upstream.text(); let data; try{data=JSON.parse(text);}catch(_){return res.status(502).json({ok:false,error:'A API DOOX retornou uma resposta inesperada.',upstreamStatus:upstream.status});}
    return res.status(upstream.ok?200:502).json(data);
  }catch(error){return res.status(502).json({ok:false,error:error?.message||'Não foi possível comunicar com a API DOOX.'});}
}
