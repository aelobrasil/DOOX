'use strict';
const API='/api/doox-v3', MATERIALS='/api/materials-v2';
const VIDEO='/assets/hocco-simulacao-10s.mp4', POSTER='/assets/hocco-serie-poster.png', AUDIO='/assets/overlay-audio-notificacao.mp3';
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const brl=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);
const uid=()=>crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(16).slice(2)}`;
const meta={
 RODAPE:{num:'01',short:'Rodapé',name:'Presença no Rodapé',desc:'Presença coletiva e discreta na base do vídeo, sem interromper a história.',where:'Rodapé · ~10s',capacity:'Até 50 por episódio'},
 SPONSOR_OVERLAY:{num:'02',short:'Sponsor',name:'Sponsor Overlay',desc:'Sua marca aparece individualmente sobre o POV, em bloco leve e legível.',where:'F1–F5 · ~10s',capacity:'10 vagas · 2 por faixa'},
 OVERLAY_AUDIO:{num:'03',short:'Áudio',name:'Overlay + Áudio',desc:'Overlay individual com identidade visual e áudio curto aprovado pela DOOX.',where:'F1–F5 · ~10s',capacity:'10 vagas · 2 por faixa'},
 PATROCINADOR_EPISODIO:{num:'04',short:'Patrocinadora',name:'Patrocinadora do Episódio',desc:'Depois do hook, o episódio entra em tela preta exclusiva da empresa antes de voltar à narrativa.',where:'Após o hook · tela própria',capacity:'Até 5 por episódio'},
 FLAME:{num:'05',short:'Flame',name:'Flame',desc:'Microvídeo de 10 a 15 segundos mostrando um recorte real e relevante do dia a dia da empresa.',where:'Interlúdio audiovisual · 10–15s',capacity:'Até 4 por episódio'}
};
const state={catalog:null,sponsors:[],sim:{mode:'RODAPE',company:'Sua empresa',profile:'@suaempresa',segment:'Seu segmento',benefit:'',coupon:'',logo:null,flameVideo:null,flameName:''},wizard:{step:1,mode:'RODAPE',range:null,quantity:1,company:'',name:'',whatsapp:'',email:'',profile:'',segment:'',benefit:'',coupon:'',observation:'',terms:false,rules:false,companyTerms:false}};
async function api(action,body=null,method=body?'POST':'GET'){const r=await fetch(`${API}?action=${encodeURIComponent(action)}`,{method,cache:'no-store',headers:{'Content-Type':'application/json'},body:body?JSON.stringify({action,...body}):undefined});const j=await r.json().catch(()=>({}));if(!r.ok||j.ok===false)throw new Error(j.message||`Erro ${r.status}`);return j}
async function materialApi(action,body){const r=await fetch(`${MATERIALS}?action=${encodeURIComponent(action)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...body})});const j=await r.json().catch(()=>({}));if(!r.ok||j.ok===false)throw new Error(j.message||`Erro ${r.status}`);return j}
function mode(code){return state.catalog?.modalidades?.find(m=>m.codigo===code)||null}
function priceFor(code,range=null){const m=mode(code);if(!m)return 0;if(m.exige_faixa){const f=m.faixas?.find(x=>x.codigo===(range||m.faixas?.[0]?.codigo));return Number(f?.preco_unitario||0)}return Number(m.preco_base||0)}
function nav(route){history.pushState({},'',route);render();scrollTo({top:0,behavior:'smooth'})}
function active(path){return location.pathname===path?'active':''}
function saveToken(obj){let list=[];try{list=JSON.parse(localStorage.getItem('doox_v3_requests')||'[]')}catch{}list=list.filter(x=>x?.token&&x.code!==obj.code);list.unshift(obj);localStorage.setItem('doox_v3_requests',JSON.stringify(list.slice(0,8)));localStorage.setItem('doox_v3_last_token',obj.token)}
function remembered(){try{return JSON.parse(localStorage.getItem('doox_v3_requests')||'[]')}catch{return[]}}
function currentToken(){return new URLSearchParams(location.search).get('token')||localStorage.getItem('doox_v3_last_token')||''}
function logoMarkup(logo,company='Sua empresa'){return logo?`<img class="brand-logo" src="${logo}" alt="Logo da empresa">`:`<span class="brand-logo fallback">${esc((company||'S')[0]).toUpperCase()}</span>`}
function brandData(sim=state.sim){return{company:sim.company||'Sua empresa',profile:sim.profile||'@suaempresa',segment:sim.segment||'Seu segmento',logo:sim.logo}}
function watchCue(mini=false){return `<div class="watch-cue${mini?' mini':''}"><span>Você está assistindo</span><b>HOCCO.</b></div>`}
