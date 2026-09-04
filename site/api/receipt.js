const DOOX_APPS_SCRIPT_ENDPOINT = 'https://script.google.com/macros/s/AKfycbwsoDs3kQ-2AC4WLW7_yHl-EQ5_BJvWow-3VG-f5eUz0a46kFR98ZCHSz6wcXgWzRWZmQ/exec';

export default async function handler(req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow','GET'); return res.status(405).json({ok:false,error:'Método não permitido.'}); }
  const token=String(req.query?.token||'').trim();
  if(!token) return res.status(400).json({ok:false,error:'Token de comprovante ausente.'});
  try{
    const url=DOOX_APPS_SCRIPT_ENDPOINT+'?action=downloadReceipt&token='+encodeURIComponent(token);
    const upstream=await fetch(url,{redirect:'follow'});
    const data=await upstream.json().catch(()=>null);
    if(!upstream.ok || !data?.ok || !data?.base64) return res.status(404).json({ok:false,error:data?.error||'Comprovante não encontrado.'});
    const pdf=Buffer.from(data.base64,'base64');
    res.setHeader('Content-Type','application/pdf');
    res.setHeader('Content-Disposition',`inline; filename="${String(data.fileName||'comprovante.pdf').replace(/[^a-zA-Z0-9._-]/g,'_')}"`);
    res.setHeader('Cache-Control','private, no-store');
    return res.status(200).send(pdf);
  }catch(error){ return res.status(502).json({ok:false,error:error?.message||'Não foi possível abrir o comprovante.'}); }
}
