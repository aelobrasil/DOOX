import {api,esc,money} from '/config.mjs';
import {pushDeviceToken,mountReturnActivity} from '/reactivation.mjs';
const root=document.querySelector('#reality-sponsor-app');
const STORE='hocco-reality-sponsor-v1';
const TERMS='2026-11-11.reality-sponsor.v1';
let saved={};
try{saved=JSON.parse(localStorage.getItem(STORE)||'{}')||{}}catch{}
const token=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,'0')).join('');
const initials=value=>String(value||'?').trim().slice(0,1).toUpperCase();
const moneyBRL=cents=>money(Number(cents)||3990);
const save=()=>{try{localStorage.setItem(STORE,JSON.stringify(saved))}catch{}};
const support=(message='')=>{const input=document.querySelector('#support-message');if(input&&message)input.value=message;const button=document.querySelector('.support-launcher');if(button)button.click();else alert('Abra o suporte do HOCCO para falar com a equipe.')};
const activatePush=()=>{const button=document.querySelector('[data-app-notifications]');if(button)button.click();else alert('Use o ícone de notificações no cabeçalho do app para ativar os avisos.')};
let catalog=null,pollTimer=null;
function header(title,description){return '<section class="reality-sponsor-heading"><span class="reality-sponsor-new">NOVO</span><p class="section-eyebrow">HOCCO · REALITY EM TEMPO REAL</p><h1>'+esc(title)+'</h1><p>'+esc(description)+'</p></section>'}
async function loadCatalog(){catalog=await api('reality_sponsor.catalog');return catalog}
function card(s){
 const logo=s.logo_url?'<img src="'+esc(s.logo_url)+'" alt="" loading="lazy">':'<span>'+esc(initials(s.name))+'</span>';
 return '<article class="reality-sponsor-card"><div class="reality-sponsor-avatar '+(s.type==='company'?'is-company':'')+'">'+logo+'</div><div class="reality-sponsor-card-copy"><strong>'+esc(s.name)+'</strong><span class="reality-sponsor-username">@'+esc(s.username)+'</span><small>'+esc(s.segment)+'</small></div></article>';
}
function renderDirectory(){
 clearInterval(pollTimer);
 const people=(catalog?.active||[]).filter(s=>s.type==='person'),companies=(catalog?.active||[]).filter(s=>s.type==='company');
 root.innerHTML=header('Patrocinadores Oficiais do Reality HOCCO','Pessoas e empresas que apoiam a continuidade do Reality. Cada presença permanece ativa por 7 dias após a confirmação do pagamento.')
 +'<section class="reality-sponsor-capacity"><div><span>VAGAS DISPONÍVEIS</span><strong>+ '+Number(catalog?.available||0)+' vagas</strong></div><p>Limite de 50 patrocinadores simultâneos.</p></section>'
 +'<section class="reality-sponsor-explainer"><h2>Uma presença oficial, por tempo determinado.</h2><p>O patrocínio custa <strong>'+moneyBRL(catalog?.settings?.price_cents||3990)+'</strong> por 7 dias. Não é investimento, não oferece participação societária e não promete retorno financeiro, ganhos, tráfego ou vendas.</p></section>'
 +'<div class="reality-sponsor-tabs" role="tablist"><button type="button" data-kind="person" class="is-active" aria-selected="true">Pessoas <span>'+people.length+'</span></button><button type="button" data-kind="company" aria-selected="false">Empresas <span>'+companies.length+'</span></button></div>'
 +'<section class="reality-sponsor-list" data-list="person">'+(people.length?people.map(card).join(''):'<p class="reality-sponsor-empty">Ainda não há pessoas nesta vitrine.</p>')+'</section>'
 +'<section class="reality-sponsor-list" data-list="company" hidden>'+(companies.length?companies.map(card).join(''):'<p class="reality-sponsor-empty">Ainda não há empresas nesta vitrine.</p>')+'</section>'
 +'<section class="reality-sponsor-join"><div><span class="section-eyebrow">FAÇA PARTE</span><h2>Seja um Patrocinador Oficial</h2><p>Inscrição para pessoa física ou empresa. Pagamento avulso por Pix.</p></div><div><strong>'+moneyBRL(catalog?.settings?.price_cents||3990)+'</strong><small>7 dias de presença oficial</small><button class="btn full" id="start-sponsor" '+(catalog?.settings?.enabled&&catalog?.available>0?'':'disabled')+'>Quero participar</button></div></section>'
 +'<p class="reality-sponsor-legal">O valor corresponde exclusivamente à presença temporária como Patrocinador Oficial do Reality HOCCO. Não há promessa de retorno financeiro, ganhos, audiência, contatos ou vendas. A renovação é manual e exige novo pagamento.</p>';
 root.querySelectorAll('[data-kind]').forEach(button=>button.addEventListener('click',()=>{
  root.querySelectorAll('[data-kind]').forEach(x=>{const active=x===button;x.classList.toggle('is-active',active);x.setAttribute('aria-selected',String(active))});
  root.querySelectorAll('[data-list]').forEach(x=>x.hidden=x.dataset.list!==button.dataset.kind);
 }));
 root.querySelector('#start-sponsor')?.addEventListener('click',()=>{location.hash='novo'});
}
function readImage(file){
 return new Promise((resolve,reject)=>{if(!file)return resolve(null);if(file.size>1048576)return reject(Error('O logo deve ter até 1 MB.'));const reader=new FileReader();reader.onerror=()=>reject(Error('Não foi possível ler o logo.'));reader.onload=()=>resolve({mime:file.type,base64:String(reader.result).split(',')[1]||''});reader.readAsDataURL(file)});
}
function renderForm(){
 clearInterval(pollTimer);
 root.innerHTML=header('Seja Patrocinador Oficial','Escolha como deseja aparecer na vitrine do Reality HOCCO por 7 dias.')
 +'<section class="reality-sponsor-form-wrap"><form id="reality-sponsor-form">'
 +'<div class="reality-sponsor-price"><span>VALOR DO PERÍODO</span><strong>'+moneyBRL(catalog?.settings?.price_cents||3990)+'</strong><small>7 dias · pagamento único · sem renovação automática</small></div>'
 +'<fieldset><legend>Tipo de inscrição</legend><label class="reality-sponsor-choice"><input type="radio" name="type" value="person" checked> Pessoa</label><label class="reality-sponsor-choice"><input type="radio" name="type" value="company"> Empresa</label></fieldset>'
 +'<label>Nome que será exibido<input name="name" maxlength="80" required placeholder="Seu nome ou nome da empresa"></label>'
 +'<label>Identificação @<input name="username" maxlength="24" required placeholder="seuusuario" autocomplete="off"><small>O @ será exibido apenas como texto. Não será um link.</small></label>'
 +'<label>Segmento<input name="segment" maxlength="60" required placeholder="Ex.: Educação, tecnologia, alimentação"></label>'
 +'<label>E-mail para o pagamento<input name="email" type="email" maxlength="254" required placeholder="voce@exemplo.com"></label>'
 +'<label class="reality-company-logo" hidden>Logo da empresa<input name="logo" type="file" accept="image/png,image/jpeg,image/webp"><small>PNG, JPG ou WebP. Até 1 MB. O logo aparece somente na vitrine.</small></label>'
 +'<div class="reality-sponsor-notice"><strong>Antes de continuar</strong><p>Você precisa ativar as notificações do HOCCO neste aparelho. O app enviará um aviso 24 horas antes do fim do período para você decidir se deseja renovar.</p><button type="button" class="btn secondary small" id="enable-sponsor-push">Ativar notificações</button></div>'
 +'<details class="reality-sponsor-terms"><summary>Leia as condições do patrocínio</summary><p>O patrocínio custa R$ 39,90 por 7 dias e não é investimento, participação societária ou promessa de retorno financeiro. São 50 vagas simultâneas. A vaga pode ser reservada por 10 minutos durante a inscrição ou renovação. Serão exibidos nome, @ e segmento; para empresas, também o logo. O @ é texto simples, sem link, telefone, WhatsApp ou endereço externo. Não há cobrança recorrente. A renovação é uma nova contratação e exige novo Pix. O app envia um aviso aproximadamente 24 horas antes do término para você decidir se deseja renovar.</p><p><a href="/patrocinadores/termos.html" target="_blank" rel="noopener">Ler os Termos de Participação completos</a></p></details>'
 +'<label class="reality-sponsor-check"><input type="checkbox" name="terms" required> Li e aceito as condições do Patrocínio Oficial do Reality HOCCO.</label>'
 +'<p class="reality-sponsor-legal">Após a confirmação do pagamento, a vaga é ativada automaticamente por 7 dias. A vaga fica reservada por 10 minutos durante a finalização do pedido.</p>'
 +'<button class="btn full" type="submit">Continuar para o Pix</button><p class="reality-sponsor-error" id="form-error" role="alert"></p><button type="button" class="btn ghost full" id="back-directory">Voltar à vitrine</button>'
 +'</form></section>';
 const form=root.querySelector('#reality-sponsor-form'),logoLabel=form.querySelector('.reality-company-logo');
 form.querySelectorAll('[name=type]').forEach(r=>r.addEventListener('change',()=>{const company=form.querySelector('[name=type]:checked').value==='company';logoLabel.hidden=!company;form.querySelector('[name=logo]').required=company}));
 root.querySelector('#enable-sponsor-push').onclick=activatePush;
 root.querySelector('#back-directory').onclick=()=>{location.hash=''};
 form.onsubmit=async event=>{
  event.preventDefault();const error=root.querySelector('#form-error'),button=form.querySelector('[type=submit]');error.textContent='';
  const deviceToken=pushDeviceToken();if(!deviceToken){error.textContent='Ative as notificações pelo botão acima e tente novamente.';return}
  button.disabled=true;button.textContent='Reservando sua vaga…';
  try{
   const data=new FormData(form),type=data.get('type'),file=data.get('logo'),logo=type==='company'?await readImage(file):null;
   const trackingToken=token();
   const result=await api('reality_sponsor.create',{type,name:data.get('name'),username:data.get('username'),segment:data.get('segment'),email:data.get('email'),logoMime:logo?.mime,logoBase64:logo?.base64,deviceToken,trackingToken,terms:data.get('terms')==='on',termsVersion:TERMS});
   saved={...(saved||{}),code:result.code,trackingToken:result.trackingToken||trackingToken,sponsorId:null,initialCode:result.code,initialToken:result.trackingToken||trackingToken};save();
   await showOrder(result.code,result.trackingToken||trackingToken);
  }catch(e){error.textContent=e.message||'Não foi possível concluir a inscrição.';button.disabled=false;button.textContent='Tentar novamente'}
 };
}
function showPix(pix){
 const host=root.querySelector('#sponsor-pix');if(!host)return;
 host.hidden=false;host.innerHTML='<h3>Pague com Pix</h3><img class="reality-sponsor-qr" src="data:image/png;base64,'+pix.qrImage+'" alt="QR Code Pix">'
 +'<p>Escaneie o QR Code ou copie o código Pix no aplicativo do seu banco.</p><textarea readonly rows="4" id="sponsor-pix-code">'+esc(pix.qrCode)+'</textarea><button class="btn secondary full" id="copy-sponsor-pix">Copiar código Pix</button>'
 +'<p class="reality-sponsor-warning">A reserva da vaga dura 10 minutos. O QR Code pode permanecer válido por mais tempo, mas pagamentos recebidos após a reserva poderão exigir análise da equipe. Não pague depois do fim da reserva.</p><p class="reality-sponsor-legal">Confira o nome do recebedor e o valor antes de confirmar no banco.</p><p role="status" id="sponsor-payment-status">Aguardando confirmação automática do Mercado Pago…</p>';
 host.querySelector('#copy-sponsor-pix').onclick=async()=>{try{await navigator.clipboard.writeText(pix.qrCode);host.querySelector('#copy-sponsor-pix').textContent='Código Pix copiado'}catch{host.querySelector('#sponsor-pix-code').select()}};
}
async function showOrder(code,trackingToken){
 clearInterval(pollTimer);
 root.innerHTML=header('Finalize sua participação','Sua solicitação foi recebida. A vaga ficará reservada por 10 minutos.')
 +'<section class="reality-sponsor-form-wrap"><div class="reality-sponsor-price"><span>VALOR DO PERÍODO</span><strong>'+moneyBRL(catalog?.settings?.price_cents||3990)+'</strong><small>7 dias · pagamento único</small></div><div id="sponsor-pix" hidden></div><p class="reality-sponsor-legal">A vaga só será ativada após a confirmação do pagamento pelo Mercado Pago.</p><a class="btn ghost full" href="/patrocinadores/">Voltar à vitrine</a></section>';
 try{
  const current=await api('reality_sponsor.lookup',{code,trackingToken});
  if(current.order.status==='attention'||current.order.needs_attention){
   const host=root.querySelector('#sponsor-pix');host.hidden=false;host.innerHTML='<div class="reality-sponsor-warning">O pagamento foi registrado para análise. Não pague novamente. A equipe verificará a situação da vaga.</div><button class="btn secondary full" id="sponsor-payment-support">Falar com o suporte HOCCO</button>';host.querySelector('#sponsor-payment-support').onclick=()=>support('Meu pedido de Patrocinador Oficial '+code+' foi registrado para análise. Preciso de suporte.');return;
  }
  if(current.order.status==='expired'){
   const host=root.querySelector('#sponsor-pix');host.hidden=false;host.innerHTML='<div class="reality-sponsor-warning">A reserva de 10 minutos terminou. Não pague este QR Code. Consulte a situação da sua vaga antes de iniciar outro pagamento.</div><a class="btn full" href="/patrocinadores/#renovar">Ver opções de renovação</a>';return;
  }
  if(current.order.status==='confirmed'&&current.sponsor.status==='active'){
   saved.sponsorId=current.sponsor.id;saved.status='active';saved.expiresAt=current.sponsor.expires_at;saved.initialCode=saved.initialCode||code;saved.initialToken=saved.initialToken||trackingToken;save();
   root.querySelector('#sponsor-pix').innerHTML='<div class="reality-sponsor-success"><strong>Pagamento confirmado</strong><p>Vaga '+current.sponsor.slot_no+' · ativo até '+new Date(current.sponsor.expires_at).toLocaleString('pt-BR')+'</p></div><a class="btn full" href="/patrocinadores/">Ver patrocinadores</a>';
   root.querySelector('#sponsor-pix').hidden=false;return;
  }
  const result=await api('reality_sponsor.pix',{code,trackingToken});showPix(result.pix);startPolling(code,trackingToken)
 }catch(e){root.querySelector('.reality-sponsor-legal').textContent=e.message;root.querySelector('.reality-sponsor-legal').classList.add('reality-sponsor-error')}
}
function startPolling(code,trackingToken){
 clearInterval(pollTimer);let count=0;
 pollTimer=setInterval(async()=>{if(document.hidden)return;try{
  count++;if(count%2===0)await api('reality_sponsor.refresh',{code,trackingToken});
  const result=await api('reality_sponsor.lookup',{code,trackingToken});
  if(['expired','refunded','cancelled'].includes(result.order.status)){clearInterval(pollTimer);root.innerHTML=header('Reserva encerrada','Não pague este QR Code. Consulte a situação da sua vaga antes de iniciar outro pagamento.')+'<section class="reality-sponsor-form-wrap"><a class="btn full" href="/patrocinadores/#renovar">Ver opções de renovação</a></section>';return;}
  if(result.order.status==='attention'||result.order.needs_attention){clearInterval(pollTimer);root.innerHTML=header('Pagamento em análise','O Mercado Pago informou um pagamento fora da reserva da vaga. A equipe precisa conferir o caso antes de ativar o patrocínio.')+'<section class="reality-sponsor-form-wrap"><div class="reality-sponsor-warning">Não pague novamente. O pagamento foi registrado para conferência e a vaga de outro patrocinador não será alterada.</div><button class="btn secondary full" id="sponsor-payment-support">Falar com o suporte HOCCO</button></section>';root.querySelector('#sponsor-payment-support').onclick=()=>support('Meu pagamento de Patrocinador Oficial foi registrado para análise. Código: '+code+'. Preciso de suporte.');return;}
  if(result.order.status==='confirmed'&&result.sponsor.status==='active'){
   clearInterval(pollTimer);saved.sponsorId=result.sponsor.id;saved.status='active';saved.expiresAt=result.sponsor.expires_at;saved.initialCode=saved.initialCode||code;saved.initialToken=saved.initialToken||trackingToken;save();
   root.innerHTML=header('Patrocínio confirmado','Sua presença está ativa na vitrine oficial da HOCCO por 7 dias.')
    +'<section class="reality-sponsor-form-wrap"><div class="reality-sponsor-success"><strong>Pagamento confirmado</strong><p>Vaga '+result.sponsor.slot_no+' · ativo até '+new Date(result.sponsor.expires_at).toLocaleString('pt-BR')+'</p></div><p>Seu nome, @ e segmento já podem aparecer na vitrine pública.</p><a class="btn full" href="/patrocinadores/">Ver patrocinadores</a><p class="reality-sponsor-legal">Guarde o link privado de acompanhamento. O app enviará um aviso 24 horas antes do fim do período, neste aparelho.</p></section>';
   }
 }catch{}},8000);
}
async function renderRenewal(){
 clearInterval(pollTimer);
 if(!catalog)try{await loadCatalog()}catch{}
 if(!saved?.initialCode||!saved?.initialToken){root.innerHTML=header('Renovação do patrocínio','Para renovar, abra o link privado recebido ao concluir o cadastro.');return}
 root.innerHTML=header('Seu período está perto do fim','Você pode renovar por mais 7 dias ou escolher não renovar.')
 +'<section class="reality-sponsor-form-wrap"><div id="renewal-content">Consultando seu patrocínio…</div></section>';
 try{
  const lookup=await api('reality_sponsor.lookup',{code:saved.initialCode,trackingToken:saved.initialToken}),s=lookup.sponsor;saved.sponsorId=s.id;save();
  const host=root.querySelector('#renewal-content');
  if(s.slot_occupied){host.innerHTML='<div class="reality-sponsor-warning">Esta vaga foi ocupada. Não foi possível concluir a renovação. Entre em contato com a equipe HOCCO para receber suporte.</div><button class="btn secondary full" id="renewal-support">Falar com o suporte HOCCO</button><a class="btn ghost full" href="/patrocinadores/">Voltar à vitrine</a>';host.querySelector('#renewal-support').onclick=()=>support('Minha vaga de Patrocinador Oficial foi ocupada e preciso de suporte para verificar a renovação.');return}
  if(s.renewal_opt_out){host.innerHTML='<p>Você escolheu não renovar. Seu período termina no prazo contratado e a vaga será liberada automaticamente.</p><a class="btn full" href="/patrocinadores/">Voltar à vitrine</a>';return}
  if(s.status!=='active'&&s.status!=='expired'){host.innerHTML='<p>Este patrocínio não está disponível para renovação.</p><a class="btn full" href="/patrocinadores/">Ver vagas disponíveis</a>';return}
  if(s.status==='active'&&Date.parse(s.expires_at)-Date.now()>24*60*60*1000){host.innerHTML='<p>A renovação será liberada 24 horas antes do fim do período. O app enviará uma notificação neste aparelho.</p><a class="btn full" href="/patrocinadores/">Voltar à vitrine</a>';return}
  if(s.status==='expired')host.innerHTML='<div class="reality-sponsor-notice"><strong>Seu período terminou, mas a vaga ainda está disponível.</strong><p>Você pode reservar a mesma vaga por 10 minutos para renovar por mais 7 dias.</p></div>';
  host.innerHTML+='<div class="reality-sponsor-success"><strong>'+esc(s.name)+'</strong><p>@'+esc(s.username)+' · '+esc(s.segment)+'</p><p>Vaga '+s.slot_no+' · termina em '+new Date(s.expires_at).toLocaleString('pt-BR')+'</p></div>'
   +'<p>Renovar custa <strong>'+moneyBRL(catalog?.settings?.price_cents||3990)+'</strong> por mais 7 dias. Não existe cobrança automática.</p>'
   +'<button class="btn full" id="renew-sponsor">Renovar por mais 7 dias</button><button class="btn secondary full" id="no-renew-sponsor">Não renovar</button><div id="renewal-pix" hidden></div><p class="reality-sponsor-error" id="renewal-error" role="alert"></p>';
  host.querySelector('#renew-sponsor').onclick=async()=>{
   const button=host.querySelector('#renew-sponsor'),error=host.querySelector('#renewal-error');button.disabled=true;error.textContent='';
   try{const result=await api('reality_sponsor.renew',{sponsorId:s.id,trackingToken:saved.initialToken});saved.code=result.code;saved.trackingToken=result.trackingToken;save();const pix=await api('reality_sponsor.pix',{code:result.code,trackingToken:result.trackingToken});const holder=host.querySelector('#renewal-pix');holder.hidden=false;holder.id='sponsor-pix';showPix(pix.pix);startPolling(result.code,result.trackingToken)}
   catch(e){error.textContent=e.message;if(e.message.includes('Esta vaga foi ocupada')){const button=document.createElement('button');button.className='btn secondary full';button.textContent='Falar com o suporte HOCCO';button.onclick=()=>support(e.message);error.after(button)}button.disabled=false}
  };
  host.querySelector('#no-renew-sponsor').onclick=async()=>{const button=host.querySelector('#no-renew-sponsor');button.disabled=true;try{await api('reality_sponsor.optout',{sponsorId:s.id,trackingToken:saved.initialToken});host.innerHTML='<p>Registramos sua decisão. Seu patrocínio termina no prazo contratado e a vaga será liberada automaticamente.</p><a class="btn full" href="/patrocinadores/">Voltar à vitrine</a>'}catch(e){host.querySelector('#renewal-error').textContent=e.message;button.disabled=false}};
 }catch(e){root.querySelector('#renewal-content').textContent=e.message}
}
async function route(){
 clearInterval(pollTimer);
 const hash=location.hash.slice(1);
 if(hash==='novo'){renderForm();return}
 if(hash==='renovar'){await renderRenewal();return}
 if(hash.startsWith('pedido/')){const parts=hash.split('/');if(parts[1]&&parts[2]){saved.code=parts[1];saved.trackingToken=parts[2];save();await showOrder(parts[1],parts[2]);return}}
 try{await loadCatalog();renderDirectory()}catch(e){root.innerHTML='<div class="empty"><h2>Não foi possível carregar a vitrine.</h2><p>'+esc(e.message)+'</p><button class="btn" id="retry-sponsor-catalog">Tentar novamente</button></div>';root.querySelector('#retry-sponsor-catalog').onclick=route}
}
mountReturnActivity();
route();
window.addEventListener('hashchange',route);
