// Consulta informativa do CNPJ no primeiro passo de cadastro. Nunca aprova a empresa.
const clean=value=>String(value||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
export async function lookupCnpj(cnpj,requester=fetch){
 const response=await requester('/api/cnpj?cnpj='+encodeURIComponent(clean(cnpj)),{headers:{Accept:'application/json'},signal:AbortSignal.timeout(9000)});
 let data={};try{data=await response.json()}catch{}
 if(response.ok && data.registry)return {kind:data.registry.active?'active':'inactive',data:data.registry};
 return {kind:response.status===404?'not_found':'unavailable',error:String(data.error||'Não foi possível consultar o cadastro.')};
}
export function mountCnpjVerification(form) {
 const input=form.elements.namedItem('cnpj'),legal=form.elements.namedItem('legalName'),trade=form.elements.namedItem('companyName');
 if(!input)return async()=>true;
 const area=document.createElement('div');area.className='cnpj-registry-status';area.setAttribute('role','status');area.setAttribute('aria-live','polite');
 area.textContent='O cadastro será consultado em uma base pública. Isso não verifica quem representa a empresa.';
 input.closest('.field')?.append(area);
 let last='',lastResult=null,inFlight=null;
 input.addEventListener('input',()=>{last='';lastResult=null;area.textContent='CNPJ alterado: uma nova consulta será necessária.'});
 async function verify(){
  const value=clean(input.value);if(last===value&&lastResult)return lastResult.kind!=='inactive';
  if(inFlight)return inFlight;
  area.textContent='Consultando os dados públicos da empresa…';
  inFlight=(async()=>{
   try{
    const result=await lookupCnpj(value);
    if(value!==clean(input.value))return false;
    last=value;lastResult=result;
    if(result.kind==='active'){
      const r=result.data;
      if(legal&&!legal.value.trim()&&r.legalName)legal.value=r.legalName;
      if(trade&&!trade.value.trim()&&r.tradeName)trade.value=r.tradeName;
      area.textContent='CNPJ encontrado e ativo: '+(r.legalName||'empresa cadastrada')+'. A identidade do responsável ainda será verificada pela DOOX.';
      return true;
    }
    if(result.kind==='inactive'){
      area.textContent='CNPJ encontrado, situação '+result.data.status+'. Corrija os dados ou procure a equipe para análise antes de avançar.';
      return false;
    }
    area.textContent=(result.error||'Consulta indisponível.')+' O cadastro seguirá para revisão manual; não está verificado.';
    return true;
   }catch{
    if(value!==clean(input.value))return false;
    last=value;lastResult={kind:'unavailable'};
    area.textContent='Serviço temporariamente indisponível. O cadastro seguirá para revisão manual; não está verificado.';
    return true;
   }finally{inFlight=null}
  })();
  return inFlight;
 }
 return verify;
}
