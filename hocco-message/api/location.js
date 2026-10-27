import {createHash} from 'node:crypto';
const API='https://vebqvedmhfaebvdantiu.supabase.co/functions/v1/hocco-message';
const KEY='sb_publishable_4qUcXYXNFDUc6UAw_nvpDw_M-9w3vuz';
const UFS=new Set('AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' '));
export function geoSuggestion(headers){
 let city='';try{city=decodeURIComponent(String(headers['x-vercel-ip-city']||''))}catch{}
 const uf=String(headers['x-vercel-ip-country-region']||'').replace(/^BR-/,'');
 return headers['x-vercel-ip-country']==='BR'&&UFS.has(uf)&&city.length>=2&&city.length<=80?{city,uf,approximate:true}:null;
}
export default async function location(req,res){
 res.setHeader('Cache-Control','private, no-store');res.setHeader('Vary','Origin');
 if(!['GET','POST'].includes(req.method))return res.status(405).json({error:'Método inválido.'});
 const origin=req.headers.origin;
 if(origin){try{if(new URL(origin).host!==req.headers.host)return res.status(403).json({error:'Origem inválida.'})}catch{return res.status(403).json({error:'Origem inválida.'})}}
 const suggestion=geoSuggestion(req.headers);
 if(req.method==='GET')return res.status(200).json({suggestion});
 let body;try{body=typeof req.body==='string'?JSON.parse(req.body||'{}'):req.body||{}}catch{return res.status(400).json({error:'Solicitação inválida.'})}
 const browser=String(body.browserToken||''),agent=String(req.headers['user-agent']||'');
 // No raw IP, URL, payment token, profile, or message is forwarded to analytics.
 if(!suggestion||!/^[a-f0-9]{64}$/.test(browser)||!agent||/bot|spider|crawler|headless|preview|monitor|curl|wget/i.test(agent))return res.status(200).json({suggestion,recorded:false});
 const secret=process.env.HOCCO_GEO_REPORT_TOKEN;
 if(!secret||process.env.VERCEL_ENV!=='production')return res.status(200).json({suggestion,recorded:false});
 const day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const digest=createHash('sha256').update(secret+':'+day+':'+browser).digest('hex');
 try{
  const r=await fetch(API,{method:'POST',headers:{'content-type':'application/json',apikey:KEY,authorization:'Bearer '+secret},body:JSON.stringify({action:'geo.record',city:suggestion.city,uf:suggestion.uf,day,visitorHash:digest}),signal:AbortSignal.timeout(4500)});
  return res.status(200).json({suggestion,recorded:r.ok});
 }catch{return res.status(200).json({suggestion,recorded:false})}
}
