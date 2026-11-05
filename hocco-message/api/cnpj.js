// Consulta cadastral pública. Não comprova identidade nem representação da empresa.
export const normalizeCnpj = value => String(value ?? '').toUpperCase().replace(/[^0-9A-Z]/g, '');
export function validCnpj(value) {
 const s=normalizeCnpj(value);
 if (!/^[0-9A-Z]{12}[0-9]{2}$/.test(s) || /^(.)\1{13}$/.test(s)) return false;
 const nums=[...s].map(ch=>ch.charCodeAt(0)-48);
 const checksum=(end,weights)=>{const rem=nums.slice(0,end).reduce((sum,n,i)=>sum+n*weights[i],0)%11;return rem<2?0:11-rem};
 return nums[12]===checksum(12,[5,4,3,2,9,8,7,6,5,4,3,2])&&nums[13]===checksum(13,[6,5,4,3,2,9,8,7,6,5,4,3,2]);
}
export function simplifyRegistry(data) {
 const status=String(data?.descricao_situacao_cadastral||'').trim().toUpperCase();
 return {
  cnpj:normalizeCnpj(data?.cnpj||''),
  legalName:String(data?.razao_social||'').slice(0,160),
  tradeName:String(data?.nome_fantasia||'').slice(0,80),
  city:String(data?.municipio||'').slice(0,80),
  stateCode:String(data?.uf||'').slice(0,2),
  status:status||'DESCONHECIDA',
  active:status==='ATIVA',
  provider:'BrasilAPI',
  checkedAt:new Date().toISOString()
 };
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='GET')return res.status(405).json({error:'Método não permitido.'});
 const origin=req.headers.origin;
 if(origin){try{if(new URL(origin).host!==req.headers.host)return res.status(403).json({error:'Origem inválida.'})}catch{return res.status(403).json({error:'Origem inválida.'})}}
 const cnpj=normalizeCnpj(req.query?.cnpj);
 if(!validCnpj(cnpj))return res.status(400).json({error:'CNPJ inválido.'});
 try{
  const response=await fetch('https://brasilapi.com.br/api/cnpj/v1/'+encodeURIComponent(cnpj),{headers:{Accept:'application/json'},signal:AbortSignal.timeout(6500),redirect:'error'});
  if(response.status===404)return res.status(404).json({error:'CNPJ não encontrado na base consultada. Verifique os dados ou solicite análise manual.'});
  if(!response.ok)return res.status(503).json({error:'Consulta cadastral indisponível. A equipe poderá revisar manualmente.'});
  const data=await response.json();
  const registry=simplifyRegistry(data);
  if(registry.cnpj!==cnpj)return res.status(502).json({error:'Resposta cadastral inconsistente.'});
  return res.status(200).json({registry,notice:'Esta consulta não comprova representação legal, autenticidade do perfil social ou segurança comercial.'});
 }catch{return res.status(503).json({error:'Consulta cadastral indisponível. A equipe poderá revisar manualmente.'})}
}
