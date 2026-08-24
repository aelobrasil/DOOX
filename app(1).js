
/* DOOX DEFINITIVO — pricing consistency patch */
const DOOX_FINAL_PRICES = {
  apoiador: 9.90,
  master: 20.00,
  overlay: { ess: 9.90, reg: 14.90, val: 19.90, prem: 29.90, esp: 39.90 },
  overlayAudio: { ess: 29.90, reg: 39.90, val: 49.90, prem: 59.90, esp: 79.90 },
  rodape: { standard: 14.90, premium: 29.90 },
  comercial: { standard: 19.90 },
  documental: { standard: 49.90 }
};
function dooxCategoryPrice(product, category) {
  const map = product === 'overlay' ? DOOX_FINAL_PRICES.overlay :
              product === 'overlay-audio' ? DOOX_FINAL_PRICES.overlayAudio :
              product === 'rodape' ? DOOX_FINAL_PRICES.rodape :
              product === 'comercial' ? DOOX_FINAL_PRICES.comercial :
              product === 'documental' ? DOOX_FINAL_PRICES.documental : null;
  if (!map) return null;
  return Number(map[category] ?? map.standard ?? Object.values(map)[0]);
}
function dooxFormatBRL(v) {
  return Number(v || 0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
}

/* DOOX Studios —  PWA MVP
   Persistência local no aparelho: IndexedDB + sessionStorage.
   Sem banco de dados central. Pedido finalizado no WhatsApp.
*/

const CONFIG = {
  whatsappNumber: "5514981150675", // formato internacional, ex.: 5514999999999
  publicInstagram: "https://www.instagram.com/", // opcional
  youtube: "https://www.youtube.com/@HOCCPOV",
  tiktok: "https://www.tiktok.com/@hoccobrasil"
};

const PRODUCTS = {
  apoiador: { id:"apoiador", title:"Apoiador Individual", short:"Créditos", price:9.90, priceLabel:"R$ 9,90", description:"Seu nome ou @ aparece no painel de apoiadores/créditos. Não é publicidade dentro da narrativa.", details:["Painel de apoiadores","Apoio à "], type:"support" },
  master: { id:"master", title:"Apoiador Master", short:"Destaque", price:49.90, priceLabel:"R$ 49,90", description:"Uma presença de maior destaque dentro do painel de apoiadores/créditos. Não é publicidade dentro da narrativa.", details:["Maior destaque","Painel de apoiadores"], type:"support" },
  curso: { id:"curso", title:"Rodapé Comercial", short:"Exposição discreta", price:null, priceLabel:"R$ 15,00", description:"Identificação visual discreta da marca na parte inferior da tela, integrada à narrativa por aproximadamente 5 segundos. A categoria define a relevância esperada do momento.", details:["~5 segundos","Faixa inferior"], type:"display" },
  insercao: { id:"insercao", title:"Inserção Comercial", short:"Empresas", price:49.90, priceLabel:"R$ 49,90", description:"Pequeno quadro retangular com a identidade visual da empresa por aproximadamente 5 segundos. Até 10 empresas por episódio.", details:["~5 segundos","Até 10 empresas por episódio"], type:"company" },
  overlay: { id:"overlay", title:"Sponsor Overlay", short:"Inserção visual", price:null, priceLabel:"R$ 20,00", description:"Inserção visual de aproximadamente 5 segundos integrada à narrativa. A categoria define a relevância esperada do momento.", details:["~5 segundos","Controle editorial DOOX"], type:"overlay" },
  overlayAudio: { id:"overlayAudio", title:"Sponsor Overlay + Áudio", short:"Inserção visual + som", price:null, priceLabel:"R$ 39,90", description:"Inserção visual de aproximadamente 5 segundos com um elemento sonoro curto aprovado pela DOOX Studios. A categoria define a relevância esperada do momento.", details:["~5 segundos","Áudio curto integrado"], type:"overlayAudio" },
  documental: { id:"documental", title:"Inserção Documental", short:"Projeto personalizado", price:null, priceLabel:"Sob consulta", description:"Integração de marca, produto ou serviço em projeto audiovisual personalizado.", details:["Integração narrativa","Projeto personalizado"], type:"consult" }
};

const OVERLAY_CATEGORIES = [
  {id:"essencial", label:"Entrada Essencial", moment:"Momento de menor atenção narrativa", desc:"Inserção em um momento de baixa relevância da cena, sem conflito com acontecimentos importantes da narrativa.", price:20.00},
  {id:"regular", label:"Entrada Regular", moment:"Momento de atenção normal", desc:"Inserção durante um momento comum do episódio, integrada naturalmente ao andamento da história.", price:29.90},
  {id:"valorizada", label:"Entrada Valorizada", moment:"Momento de maior atenção", desc:"Inserção em uma passagem que naturalmente concentra mais atenção do espectador.", price:39.90},
  {id:"premium", label:"Entrada Premium", moment:"Momento importante da narrativa", desc:"Inserção em uma parte relevante da narrativa, com maior potencial de atenção e retenção.", price:49.90},
  {id:"especial", label:"Entrada Especial", moment:"Momento de alta relevância", desc:"Inserção destinada a momentos de grande destaque, tensão, expectativa ou forte atenção narrativa.", price:59.90}
];
const AUDIO_CATEGORIES = [
  {id:"essencial", label:"Entrada Essencial + Áudio", moment:"Momento de menor atenção narrativa", desc:"Inserção visual discreta acompanhada de um elemento sonoro curto, integrada a um momento de baixa relevância.", price:39.90},
  {id:"regular", label:"Entrada Regular + Áudio", moment:"Momento de atenção normal", desc:"Inserção visual + áudio curto durante um momento comum do episódio, integrada naturalmente à história.", price:49.90},
  {id:"valorizada", label:"Entrada Valorizada + Áudio", moment:"Momento de maior atenção", desc:"Inserção visual + áudio em uma passagem com maior concentração de atenção do espectador.", price:59.90},
  {id:"premium", label:"Entrada Premium + Áudio", moment:"Momento importante da narrativa", desc:"Inserção visual + áudio integrada a uma parte relevante da narrativa, com maior potencial de atenção.", price:69.90},
  {id:"especial", label:"Entrada Especial + Áudio", moment:"Momento de alta relevância", desc:"Inserção visual + áudio em um momento de grande destaque, tensão, expectativa ou forte atenção narrativa.", price:89.90}
];
const FOOTER_CATEGORIES = [
  {id:"essencial", label:"Rodapé Essencial", moment:"Momento de menor atenção", desc:"Identificação discreta da marca na parte inferior da tela durante um momento de baixa relevância narrativa.", price:15.00},
  {id:"regular", label:"Rodapé Regular", moment:"Momento de atenção normal", desc:"Presença da marca no rodapé durante um momento comum do episódio, integrada ao andamento da história.", price:20.00},
  {id:"valorizada", label:"Rodapé Valorizado", moment:"Momento de maior atenção", desc:"Presença no rodapé durante uma passagem com maior atenção do espectador.", price:29.90},
  {id:"premium", label:"Rodapé Premium", moment:"Momento importante da narrativa", desc:"Presença destacada no rodapé durante uma parte relevante da narrativa.", price:39.90}
];
function categoryFor(productId,id){
  const cats = productId==="overlayAudio" ? AUDIO_CATEGORIES : productId==="curso" ? FOOTER_CATEGORIES : OVERLAY_CATEGORIES;
  return cats.find(x=>x.id===id);
}
function categoryPrice(productId,id){ const c=categoryFor(productId,id); return c?c.price:null; }


const state = {
  productId: null,
  categoryId: null,
  quantity: 1,
  preference: "Próximo episódio disponível",
  customer: {
    kind:"pf", name:"", whatsapp:"", email:"", document:"", company:"", handle:"", note:""
  },
  termsAccepted: false
};

const $ = (sel) => document.querySelector(sel);
const app = $("#app");
const toast = $("#toast");

const LOCAL_DB={name:"hocco-local",version:1,store:"app"};
let dbPromise=null;
function openLocalDB(){
  if(dbPromise) return dbPromise;
  dbPromise=new Promise((resolve,reject)=>{
    if(!window.indexedDB){reject(new Error("IndexedDB unavailable"));return;}
    const req=indexedDB.open(LOCAL_DB.name,LOCAL_DB.version);
    req.onupgradeneeded=()=>{ if(!req.result.objectStoreNames.contains(LOCAL_DB.store)) req.result.createObjectStore(LOCAL_DB.store); };
    req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error);
  });
  return dbPromise;
}
async function localSet(key,value){
  try{const db=await openLocalDB(); await new Promise((resolve,reject)=>{const tx=db.transaction(LOCAL_DB.store,"readwrite"); tx.objectStore(LOCAL_DB.store).put(value,key); tx.oncomplete=resolve; tx.onerror=()=>reject(tx.error);});}catch(e){}
}
async function localGet(key){
  try{const db=await openLocalDB(); return await new Promise((resolve,reject)=>{const tx=db.transaction(LOCAL_DB.store,"readonly"); const req=tx.objectStore(LOCAL_DB.store).get(key); req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error);});}catch(e){return null;}
}
async function localDelete(key){
  try{const db=await openLocalDB(); await new Promise((resolve,reject)=>{const tx=db.transaction(LOCAL_DB.store,"readwrite"); tx.objectStore(LOCAL_DB.store).delete(key); tx.oncomplete=resolve; tx.onerror=()=>reject(tx.error);});}catch(e){}
}
function persistState(){
  try{sessionStorage.setItem("doox_hocco_state",JSON.stringify(state));}catch(e){}
  localSet("draft",JSON.parse(JSON.stringify(state)));
}
function restoreState(){
  try{const raw=sessionStorage.getItem("doox_hocco_state"); if(raw){const saved=JSON.parse(raw); Object.assign(state,saved); state.customer={...state.customer,...(saved.customer||{})}; return;}}catch(e){}
  localGet("draft").then(saved=>{if(saved){Object.assign(state,saved);state.customer={...state.customer,...(saved.customer||{})};render();}});
}


function money(v){
  return new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(v);
}

function safeText(v, max=300){
  return String(v ?? "").replace(/[<>]/g,"").trim().slice(0,max);
}

function randomId(){
  const arr = new Uint32Array(3);
  crypto.getRandomValues(arr);
  return "DOOX-" + Array.from(arr).map(x=>x.toString(16).padStart(8,"0")).join("").slice(0,10).toUpperCase();
}

function playSelectSound(){
  try{
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if(!AudioContext) return;
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(105, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(58, ctx.currentTime + 0.11);
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.055, ctx.currentTime + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + 0.13);
    setTimeout(()=>ctx.close(),180);
  }catch(e){}
}

function flashToast(msg){
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(()=>toast.classList.remove("show"),2400);
}

function validateText(value, max){
  const s = safeText(value,max);
  if(!s || s.length > max) return false;
  return true;
}

function validatePublicText(value){
  const s = safeText(value,120);
  const banned = [
    /nazi/i, /hitler/i, /pedofil/i, /porn/i, /sexo\s+com\s+menor/i,
    /matar\s+todos/i, /vai\s+morrer/i
  ];
  if(banned.some(rx=>rx.test(s))) return false;
  return true;
}

function setRoute(path){
  const current = window.location.hash.replace(/^#/,'') || "/";
  if(current===path){ render(); return; }
  history.pushState({dooxRoute:path}, "", "#" + path);
  render();
  requestAnimationFrame(()=>window.scrollTo({top:0,behavior:"smooth"}));
}

document.addEventListener("click",(e)=>{
  const routeEl = e.target.closest("[data-route]");
  if(routeEl){
    const href = routeEl.getAttribute("href");
    if(href && href.startsWith("#/")){
      e.preventDefault();
      setRoute(href.slice(1));
    }
  }
});

window.addEventListener("popstate", render);
window.addEventListener("hashchange", render);

function pageShell(inner, options={}){
  const showBack = options.showBack !== false;
  const back = showBack ? `
    <div class="page-toolbar">
      <button class="back-button" type="button" data-back aria-label="Voltar para a página anterior">
        <span aria-hidden="true">←</span><span>Voltar</span>
      </button>
    </div>` : "";
  return `<section class="page">${back}${inner}</section>`;
}

function goBack(){
  const path=window.location.hash.replace(/^#/,'') || "/";
  if(path==="/"){ return; }
  if(window.history.length>1){ window.history.back(); return; }
  setRoute("/insercoes");
}

function youtubeLogo(size=22){
  return `<svg class="social-logo youtube-logo" width="${size}" height="${Math.round(size*0.7)}" viewBox="0 0 36 25" aria-hidden="true" focusable="false"><rect x="1" y="1" width="34" height="23" rx="7" fill="#FF0000"/><path d="M15 7.2 25.1 12.5 15 17.8V7.2Z" fill="#fff"/></svg>`;
}

function tiktokLogo(size=22){
  return `<svg class="social-logo tiktok-logo" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M14.2 3c.4 2.7 1.8 4.5 4.5 4.8v3.2c-1.5-.1-2.9-.6-4.2-1.5v6.2c0 4-2.6 6.3-5.9 6.3-3.1 0-5.6-2.2-5.6-5.3 0-3.2 2.7-5.6 6-5.6.4 0 .8 0 1.2.1v3.3c-.4-.1-.8-.2-1.2-.2-1.4 0-2.6.9-2.6 2.3 0 1.2.9 2.1 2.2 2.1 1.6 0 2.4-1 2.4-3V3h3.2Z" fill="#25F4EE" transform="translate(-1 0)"/><path d="M15.2 2c.4 2.7 1.8 4.5 4.5 4.8V10c-1.5-.1-2.9-.6-4.2-1.5v6.2c0 4-2.6 6.3-5.9 6.3-3.1 0-5.6-2.2-5.6-5.3 0-3.2 2.7-5.6 6-5.6.4 0 .8 0 1.2.1v3.3c-.4-.1-.8-.2-1.2-.2-1.4 0-2.6.9-2.6 2.3 0 1.2.9 2.1 2.2 2.1 1.6 0 2.4-1 2.4-3V2h3.2Z" fill="#FE2C55" transform="translate(1 0)"/><path d="M14.7 2.2c.4 2.7 1.8 4.5 4.5 4.8v3.2c-1.5-.1-2.9-.6-4.2-1.5v6.2c0 4-2.6 6.3-5.9 6.3-3.1 0-5.6-2.2-5.6-5.3 0-3.2 2.7-5.6 6-5.6.4 0 .8 0 1.2.1v3.3c-.4-.1-.8-.2-1.2-.2-1.4 0-2.6.9-2.6 2.3 0 1.2.9 2.1 2.2 2.1 1.6 0 2.4-1 2.4-3V2.2h3.2Z" fill="#111"/></svg>`;
}

function flagBrazil(){
  return `<svg class="flag-svg" viewBox="0 0 100 70" aria-label="Bandeira do Brasil" role="img"><rect width="100" height="70" rx="3" fill="#009c3b"/><path d="M50 7 91 35 50 63 9 35 50 7Z" fill="#ffdf00"/><circle cx="50" cy="35" r="14" fill="#002776"/><path d="M37.7 31.5c7.8-3 17.7-2.5 25.3 1.6" fill="none" stroke="#fff" stroke-width="3.2"/><g fill="#fff"><circle cx="44" cy="34" r=".9"/><circle cx="48" cy="29.2" r=".8"/><circle cx="53" cy="30.2" r=".8"/><circle cx="58" cy="34.1" r=".8"/><circle cx="50" cy="37.7" r=".75"/></g></svg>`;
}

function flagSaoPaulo(){
  const stripes=Array.from({length:13},(_,i)=>`<rect x="0" y="${(i*70/13).toFixed(2)}" width="100" height="${(70/13+0.3).toFixed(2)}" fill="${i%2===0?'#fff':'#111'}"/>`).join('');
  return `<svg class="flag-svg" viewBox="0 0 100 70" aria-label="Bandeira do Estado de São Paulo" role="img"><g>${stripes}</g><rect x="0" y="0" width="34" height="35" fill="#d71920"/><circle cx="17" cy="17.5" r="8.6" fill="#fff"/><path d="M12.2 17.7c1.7-1.2 3.5-2 4.8-2.6 1.3.6 3.1 1.5 4.8 2.6-1.7 1.4-3.2 2.4-4.8 4-1.6-1.6-3.1-2.6-4.8-4Z" fill="#111"/></svg>`;
}

function home(){
  return pageShell(`
    <div class="hero">
      <div class="hero-bg"></div>
      <div class="hero-content">
        <div class="kicker"><span class="rec"></span> produção audiovisual</div>
        <h1>INSIRA SUA<br><span>MARCA.</span></h1>
        <p>Inserções comerciais dentro do universo audiovisual da  Formatos definidos para entrar na narrativa sem transformar a experiência em uma página de publicidade.</p>
        <div class="cta-row">
          <a class="btn primary" href="#/insercoes" data-route>Ver inserções</a>
          <a class="btn secondary" href="#/hocco" data-route>Conhecer a </a>
        </div>
        <div class="home-socials" aria-label="Redes sociais">
          <a class="home-social-icon" href="https://www.youtube.com/@HOCCPOV" target="_blank" rel="noopener noreferrer" aria-label="Abrir canal no YouTube">${youtubeLogo(30)}</a>
          <a class="home-social-icon" href="https://www.tiktok.com/@hoccobrasil" data-external-tiktok target="_blank" rel="noopener noreferrer" aria-label="Abrir perfil no TikTok">${tiktokLogo(30)}</a>
        </div>
        <div class="hero-points">
          <div class="hero-point"><strong>Você escolhe.</strong><span>A modalidade e a quantidade.</span></div>
          <div class="hero-point"><strong>A DOOX encaixa.</strong><span>Controle editorial é nosso.</span></div>
          <div class="hero-point"><strong>Você é avisado.</strong><span>Episódio + tempo previsto.</span></div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-head">
        <div>
          <div class="card-code">O universo</div>
          <h2>Você chegou no meio da história.</h2>
        </div>
        <p> acompanha a vida e a evolução de Alex Hocc diante das câmeras. A série não tem um final pronto.</p>
      </div>
      <div class="video-strip">
        <div class="media-card">
          <div class="media-content">
            <div class="small"></div>
            <h3>Uma cápsula do tempo digital.</h3>
            <div>Hoje é um episódio. Daqui a anos, é memória.</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="inner">
            <h3>Você pode fazer parte.</h3>
            <p>Sua participação entra no arquivo público da história, conforme a modalidade escolhida.</p>
            <div class="memory-social-title">Acompanhe nossos vídeos aqui</div><div class="home-inline-socials" aria-label="Redes sociais">
              <a class="home-inline-social" href="https://www.youtube.com/@HOCCPOV" target="_blank" rel="noopener noreferrer" aria-label="YouTube HOCCPOV" title="YouTube">${youtubeLogo(26)}</a>
              <a class="home-inline-social" href="https://www.tiktok.com/@hoccobrasil" data-external-tiktok target="_blank" rel="noopener noreferrer" aria-label="TikTok HOCCOBRASIL" title="TikTok">${tiktokLogo(26)}</a>
            </div>
            <div class="stat-line"><span>Produção</span><strong>DOOX Studios</strong></div>
          </div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-head">
        <div>
          <div class="card-code">COMO PARTICIPAR</div>
          <h2>Simples na frente. Controle nos bastidores.</h2>
        </div>
      </div>
      <div class="steps">
        <div class="step"><div class="step-num">01</div><h3>Escolha</h3><p>Selecione a modalidade e a quantidade.</p></div>
        <div class="step"><div class="step-num">02</div><h3>Cadastre</h3><p>Informe os dados necessários para a inserção.</p></div>
        <div class="step"><div class="step-num">03</div><h3>Finalize</h3><p>O pedido segue para o WhatsApp da DOOX.</p></div>
        <div class="step"><div class="step-num">04</div><h3>Aguarde</h3><p>A DOOX define o encaixe e avisa você.</p></div>
      </div>
    </div>

    <div class="section">
      <div class="section-head">
        <div>
          <div class="card-code">Escolha seu formato</div>
          <h2>Entre do seu jeito.</h2>
        </div>
        <a class="btn secondary" href="#/insercoes" data-route>Ver todos</a>
      </div>
      <div class="cards">
        ${productCard(PRODUCTS.apoiador,"mais simples","R$ 9,90")}
        ${productCard(PRODUCTS.master,"maior destaque","R$ 49,90")}
        ${productCard(PRODUCTS.curso,"exposição","R$ 15,00")}
        ${productCard(PRODUCTS.overlay,"dedicado a empresas","R$ 20,00")}
      ${productCard(PRODUCTS.overlayAudio,"produto separado","R$ 39,90")}
        ${productCard(PRODUCTS.insercao,"para empresas","R$ 49,90")}
      </div>
    </div>
  `, {showBack:false});
}

function productCard(p, ribbon, customPrice){
  return `
    <article class="card insert-card" data-product="${p.id}">
      <div class="ribbon">${p.type === "company" || p.type === "display" || p.type === "overlay" || p.type === "overlayAudio" ? "Dedicado a empresas" : ribbon}</div>
      <div class="card-top">
        <div class="card-code">${p.type === "support" ? "apoio" : p.type === "display" ? "faixa" : p.type === "overlay" || p.type === "overlayAudio" ? "overlay" : "projeto"}</div>
        
      </div>
      <h3>${p.title}</h3>
      <p>${p.description}</p>
      <div class="card-price">${customPrice ?? p.priceLabel}</div>
      <div class="card-footer">
        <span class="price-note">${p.details[0]}</span>
        <button class="btn primary select-product" data-product-id="${p.id}" type="button">Escolher</button>
      </div>
    </article>
  `;
}

function attachProductSounds(){
  document.querySelectorAll(".select-product").forEach(btn=>{
    let armed=false;
    btn.addEventListener("mouseenter",()=>{ if(!armed){ armed=true; playSelectSound(); }});
    btn.addEventListener("mouseleave",()=>{ armed=false; });
    btn.addEventListener("click",()=>{
      const id=btn.dataset.productId;
      state.productId=id; state.categoryId=null; state.quantity=1;
      if(id==="documental") setRoute("/insercao-documental");
      else if(id==="insercao") setRoute("/escolher");
      else setRoute("/escolher");
    });
  });
}

function insertions(){
  return pageShell(`
    <div class="section-head">
      <div><div class="card-code">DOOX STUDIOS / </div><h1 style="font-size:58px;line-height:.94;letter-spacing:-.06em;margin:.15em 0 0">Escolha sua inserção.</h1></div>
      <p>Formatos comerciais e modalidades de apoio integrados ao universo audiovisual da  Os valores completos aparecem dentro de cada modalidade.</p>
    </div>

    <div class="section" style="margin-bottom:26px">
      <div class="card-code">PARA EMPRESAS</div>
      <div class="cards">
        ${productCard(PRODUCTS.insercao,"10 vagas por episódio","R$ 49,90")}
        ${productCard(PRODUCTS.curso,"exposição discreta","R$ 15,00")}
        ${productCard(PRODUCTS.overlay,"inserção visual","R$ 20,00")}
        ${productCard(PRODUCTS.overlayAudio,"visual + áudio","R$ 39,90")}
      </div>
    </div>

    <div class="section">
      <div class="card-code">PARA APOIADORES</div>
      <div class="cards">
        ${productCard(PRODUCTS.apoiador,"apoio","R$ 9,90")}
        ${productCard(PRODUCTS.master,"maior destaque","R$ 49,90")}
      </div>
    </div>
  `);
}

function hocco(){
  return pageShell(`
    <div class="section-head">
      <div>
        <div class="kicker"><span class="rec"></span> </div>
        <h1 style="font-size:64px;line-height:.96;letter-spacing:-.06em;margin:.15em 0">Uma série original<br>DOOX Studios.</h1>
      </div>
    </div>
    <div class="video-strip">
      <div class="detail-panel">
        <div class="card-code">A história</div>
        <h2 style="font-size:34px;line-height:1;letter-spacing:-.04em">Você chegou no meio da história.</h2>
        <p> acompanha a vida de Alex Hocc enquanto novos projetos, empresas, pessoas, erros, decisões e acontecimentos surgem diante das câmeras.</p>
        <p>A série não tem um fim programado. Ela está em constante evolução. O próximo episódio ainda não aconteceu.</p>
        <div class="muted-box">A proposta é guardar momentos do presente como uma cápsula do tempo digital: pessoas, lugares e acontecimentos que poderão ser revistos muitos anos depois.</div>
      </div>
      <div class="stat-card">
        <div class="inner">
          <h3>Memória </h3>
          <p>Você pode fazer parte de algo que continua sendo construído.</p>
          <div class="social-dock" aria-label="Redes sociais da HOCCO">
            <a class="social-icon-button" href="https://www.youtube.com/@HOCCPOV" target="_blank" rel="noopener noreferrer" aria-label="YouTube HOCCPOV" title="YouTube">${youtubeLogo(34)}</a>
            <a class="social-icon-button" href="https://www.tiktok.com/@hoccobrasil" data-external-tiktok target="_blank" rel="noopener noreferrer" aria-label="TikTok HOCCOBRASIL" title="TikTok">${tiktokLogo(34)}</a>
          </div>
          <div class="production-note"><span>Produção</span><strong>DOOX Studios</strong></div>
        </div>
      </div>
    </div>
  `);
}

function howWorks(){
  return pageShell(`
    <div class="section-head">
      <div>
        <div class="card-code">Passo a passo</div>
        <h1 style="font-size:58px;line-height:.98;letter-spacing:-.05em;margin:.15em 0">Você escolhe.<br>A DOOX encaixa.</h1>
      </div>
      <p>O site foi desenhado para você comprar uma modalidade sem tirar da DOOX o controle da narrativa.</p>
    </div>
    <div class="timeline">
      <div class="timeline-item"><strong>1. Pedido</strong><span>Você escolhe a inserção e preenche seus dados.</span></div>
      <div class="timeline-item"><strong>2. Triagem</strong><span>O pedido segue para o WhatsApp da DOOX.</span></div>
      <div class="timeline-item"><strong>3. Produção</strong><span>A equipe encaixa a inserção no planejamento editorial.</span></div>
      <div class="timeline-item"><strong>4. Aviso</strong><span>Você recebe episódio e tempo previsto antes da publicação.</span></div>
    </div>
    <div class="section"></div>
    <div id="ruleModal" class="modal" hidden><div class="modal-backdrop" data-close-modal></div><div class="modal-card"><button class="modal-close" data-close-modal aria-label="Fechar">×</button><h2><br></h2><p> O cliente escolhe a modalidade, a categoria de momento e a quantidade desejada.</p><p>A DOOX analisa narrativa, edição, importância da cena, planejamento, disponibilidade e equilíbrio do episódio para definir o encaixe final.</p><p>A categoria escolhida representa uma faixa de relevância, não um minuto específico. Quando a inserção estiver programada, a DOOX informará o episódio e o tempo previsto de aparição.</p><button class="btn primary full" data-close-modal></button></div></div>
  `);
}

function choose(){
  if(!state.productId) return setRoute("/insercoes");
  const p=PRODUCTS[state.productId];
  if(state.productId==="overlay" || state.productId==="overlayAudio" || state.productId==="curso") return overlayChooser();
  return pageShell(`
    <div class="insert-grid">
      <div class="detail-panel">
        <div class="card-code">${p.type}</div><h1>${p.title}</h1><p>${p.description}</p>
        <ul style="padding-left:18px;color:#5f5f5f;font-size:13px">${p.details.map(d=>`<li>${d}</li>`).join("")}</ul>
        <div class="section quantity-box" style="margin-top:28px"><div class="card-code">Quantidade</div><div class="quantity-control" style="margin-top:10px"><button class="btn secondary" id="minusQty" type="button">−</button><div class="quantity-value">${state.quantity}</div><button class="btn secondary" id="plusQty" type="button">+</button></div><div class="small-note" style="margin-top:9px">${money(p.price)} por inserção.</div></div>
      </div>
      <div class="detail-panel"><div class="card-code">Resumo</div><div class="summary" style="margin-top:12px"><div class="summary-row"><span>Modalidade</span><strong>${p.title}</strong></div><div class="summary-row"><span>Quantidade</span><strong>${state.quantity}</strong></div><div class="summary-row summary-total"><span>Total</span><strong>${money(p.price*state.quantity)}</strong></div></div><div class="warning" style="margin-top:16px">Todos os pedidos passam por análise antes de serem aceitos.</div><div style="margin-top:15px"><button class="btn primary full" id="continueCustomer" type="button">Continuar</button></div></div>
    </div>`);
}

function overlayChooser(){
  const p=PRODUCTS[state.productId], isAudio=state.productId==="overlayAudio", isFooter=state.productId==="curso", categories=isAudio?AUDIO_CATEGORIES:isFooter?FOOTER_CATEGORIES:OVERLAY_CATEGORIES;
  const selected=categoryFor(state.productId,state.categoryId);
  return pageShell(`
    <div class="section-head"><div><div class="card-code">${p.title}</div><h1>${isAudio?"Imagem + som.":isFooter?"Presença no rodapé.":"A marca entra na cena."}</h1></div><p>${isAudio?"Modalidade própria com elemento sonoro curto integrado à aparição. O áudio é analisado pela produção.":isFooter?"Identificação visual discreta na parte inferior da tela, aproximadamente 5 segundos, com categoria definida pela relevância esperada do momento.":"Inserção visual de aproximadamente 5 segundos integrada à narrativa."}</p></div>
    <div class="insert-grid">
      <div class="detail-panel">
        <div class="card-code">Escolha a categoria</div>
        <div class="slot-grid">${categories.map(c=>`<button class="slot-card ${state.categoryId===c.id?"selected":""}" data-category="${c.id}" type="button"><span><strong>${c.label}</strong><small>${c.moment}</small><em>${c.desc}</em></span><span class="price">${money(c.price)}</span></button>`).join("")}</div>
        
      </div>
      <div class="detail-panel">
        <div class="card-code">Resumo da solicitação</div>
        <div class="summary" style="margin-top:12px"><div class="summary-row"><span>Modalidade</span><strong>${p.title}</strong></div><div class="summary-row"><span>Categoria</span><strong>${selected?selected.label:"Selecione"}</strong></div><div class="summary-row"><span>Quantidade</span><strong>${state.quantity}</strong></div><div class="summary-row"><span>Valor por inserção</span><strong>${selected?money(selected.price):"—"}</strong></div><div class="summary-row summary-total"><span>Total</span><strong>${selected?money(selected.price*state.quantity):"—"}</strong></div></div>
        <div class="quantity-box" style="margin-top:18px"><div class="card-code">Quantidade</div><div class="quantity-control" style="margin-top:10px"><button class="btn secondary" id="minusQty" type="button">−</button><div class="quantity-value">${state.quantity}</div><button class="btn secondary" id="plusQty" type="button">+</button></div><div class="small-note" style="margin-top:8px">Mínimo 1 · máximo 50</div></div>
        <div class="warning" style="margin-top:16px">A categoria representa uma faixa de relevância do momento. Ela não garante um minuto específico.</div>
        <div style="margin-top:15px"><button class="btn primary full" id="continueBug" type="button" ${selected?"":"disabled"}>Continuar</button></div>
      </div>
    </div>
    <div id="ruleModal" class="modal" hidden><div class="modal-backdrop" data-close-modal></div><div class="modal-card"><button class="modal-close" data-close-modal aria-label="Fechar">×</button><h2><br></h2><p> O cliente escolhe a modalidade, a categoria e a quantidade desejada.</p><p>A DOOX analisa narrativa, edição, importância da cena, planejamento, disponibilidade e equilíbrio do episódio para definir o encaixe final.</p><p>A categoria escolhida representa uma faixa de relevância, não um minuto específico. Quando a inserção estiver programada, a DOOX informará o episódio e o tempo previsto de aparição.</p><button class="btn primary full" data-close-modal></button></div></div>`);
}

function customerForm(){
  const p=PRODUCTS[state.productId];
  let unitPrice = p.price;
  if(state.productId==="overlay") unitPrice = categoryPrice(state.productId,state.categoryId);
  if(state.productId==="overlayAudio") unitPrice = categoryPrice(state.productId,state.categoryId);
  if(state.productId==="curso") unitPrice = categoryPrice(state.productId,state.categoryId);
  const total = unitPrice * state.quantity;
  const isCompany = state.customer.kind === "empresa";
  return pageShell(`
    <div class="section-head">
      <div><div class="card-code">Pedido</div><h1 style="font-size:58px;line-height:.98;letter-spacing:-.05em;margin:.15em 0">Quase lá.</h1></div>
      <p>Agora diga se a solicitação será feita como pessoa física ou empresa. Depois do cadastro, você será encaminhado diretamente ao WhatsApp da DOOX para concluir a triagem.</p>
    </div>
    <div class="insert-grid">
      <div class="detail-panel">
        <div class="card-code">Quem está participando?</div>
        <div class="participant-switch" role="group" aria-label="Tipo de participante">
          <button type="button" class="participant-option ${!isCompany?"selected":""}" data-kind="pf">Pessoa física<span>CPF</span></button>
          <button type="button" class="participant-option ${isCompany?"selected":""}" data-kind="empresa">Empresa<span>CNPJ</span></button>
        </div>
        <div class="form-grid" style="margin-top:16px">
          <div class="field"><label for="name">${isCompany?"Nome do responsável":"Nome completo"} *</label><input id="name" maxlength="80" value="${escapeAttr(state.customer.name)}" autocomplete="name"></div>
          <div class="field"><label for="whatsapp">WhatsApp *</label><input id="whatsapp" maxlength="20" value="${escapeAttr(state.customer.whatsapp)}" autocomplete="tel" inputmode="tel"></div>
          <div class="field"><label for="email">E-mail *</label><input id="email" maxlength="150" value="${escapeAttr(state.customer.email)}" type="email" autocomplete="email" inputmode="email"></div>
          <div class="field"><label for="document">${isCompany?"CNPJ":"CPF"} *</label><input id="document" maxlength="18" value="${escapeAttr(state.customer.document)}" inputmode="numeric" autocomplete="off"></div>
          ${isCompany ? `<div class="field full"><label for="company">Razão social / nome da empresa *</label><input id="company" maxlength="100" value="${escapeAttr(state.customer.company)}" autocomplete="organization"></div>` : ""}
          <div class="field ${isCompany?"":"full"}"><label for="handle">@ / identificação pública</label><input id="handle" maxlength="40" value="${escapeAttr(state.customer.handle)}" placeholder="@seunome"></div>
          <div class="field full"><label for="note">Observação (opcional)</label><textarea id="note" maxlength="300" placeholder="Algo que a DOOX deva saber sobre o pedido.">${escapeAttr(state.customer.note)}</textarea></div>
        </div>
        <div class="small-note" style="margin-top:12px">Não envie senhas, dados bancários ou informações sensíveis. O CPF/CNPJ é usado para identificação da solicitação.</div>
      </div>
      <div class="detail-panel">
        <div class="card-code">Resumo</div>
        <div class="summary" style="margin-top:12px">
          <div class="summary-row"><span>Participação</span><strong>${isCompany?"Empresa":"Pessoa física"}</strong></div>
          <div class="summary-row"><span>Produto</span><strong>${p.title}</strong></div>
          ${state.categoryId?`<div class="summary-row"><span>Categoria</span><strong>${categoryFor(state.productId,state.categoryId)?.label||state.categoryId}</strong></div>`:""}
          <div class="summary-row"><span>Quantidade</span><strong>${state.quantity}</strong></div>
          <div class="summary-row"><span>Preferência</span><strong>${state.preference}</strong></div>
          <div class="summary-row summary-total"><span>Total</span><strong>${money(total)}</strong></div>
        </div>
        <div style="margin-top:18px" class="checkbox">
          <input id="termsCheck" type="checkbox" ${state.termsAccepted ? "checked" : ""}>
          <label for="termsCheck">Li e aceito os <a href="#/termos" data-route style="color:var(--orange);font-weight:700">Termos de Uso</a> e a <a href="#/privacidade" data-route style="color:var(--orange);font-weight:700">Política de Privacidade</a>.</label>
        </div>
        <div class="warning" style="margin-top:16px">Ao criar o pedido, o site abrirá a etapa de triagem. <strong>O próximo passo é o WhatsApp da DOOX.</strong></div>
        <div style="margin-top:16px"><button class="btn primary full" id="reviewOrder" type="button">Rever pedido</button></div>
        <div style="margin-top:10px"><button class="btn secondary full" id="backToChoose" type="button">Voltar à escolha</button></div>
      </div>
    </div>
  `);
}

function escapeAttr(s){
  return safeText(s,200).replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

function reviewOrder(){
  const p=PRODUCTS[state.productId];
  let unitPrice=p.price;
  if(state.productId==="overlay") unitPrice=categoryPrice(state.productId,state.categoryId);
  if(state.productId==="overlayAudio") unitPrice=categoryPrice(state.productId,state.categoryId);
  const total=unitPrice*state.quantity, c=state.customer;
  return pageShell(`
    <div class="section-head"><div><div class="card-code">Última conferência</div><h1>Rever pedido.</h1></div>
    <p>Confira tudo antes de enviar. Se algo estiver errado, volte para editar. Se estiver tudo certo, continue para o WhatsApp.</p></div>
    <div class="detail-panel review-panel">
      <div class="summary">
        <div class="summary-row"><span>Participação</span><strong>${c.kind==="empresa"?"Empresa":"Pessoa física"}</strong></div>
        <div class="summary-row"><span>Nome</span><strong>${escapeAttr(c.name)}</strong></div>
        ${c.company?`<div class="summary-row"><span>Empresa</span><strong>${escapeAttr(c.company)}</strong></div>`:""}
        <div class="summary-row"><span>${c.kind==="empresa"?"CNPJ":"CPF"}</span><strong>${escapeAttr(c.document)}</strong></div>
        <div class="summary-row"><span>Produto</span><strong>${p.title}</strong></div>
        ${state.categoryId?`<div class="summary-row"><span>Categoria</span><strong>${categoryFor(state.productId,state.categoryId)?.label||state.categoryId}</strong></div>`:""}
        <div class="summary-row"><span>Quantidade</span><strong>${state.quantity}</strong></div>
        <div class="summary-row summary-total"><span>Total</span><strong>${money(total)}</strong></div>
      </div>
      <div class="warning" style="margin-top:18px">Todos os pedidos passam por análise antes de serem aceitos. O envio não representa aprovação automática.</div>
      <div class="cta-row review-actions" style="margin-top:20px">
        <button class="btn secondary" id="editOrder" type="button">Voltar e editar</button>
        <button class="btn primary" id="confirmOrder" type="button">Está tudo certo — continuar</button>
      </div>
    </div>`);
}

function orderSuccess(orderId,total){
  return pageShell(`<div class="handoff-screen">
    <div class="handoff-rec"><span class="rec"></span> pedido recebido</div>
    
    <div class="handoff-hocco"></div>
    <p>Seu pedido foi registrado. Agora vamos continuar a triagem no WhatsApp da DOOX Studios.</p>
    <div class="handoff-order">Pedido ${orderId} · ${money(total)}</div>
    <div class="handoff-loader"><span></span><span></span><span></span></div>
    <small>Preparando o WhatsApp…</small>
    <button class="btn secondary" id="openWhatsApp" type="button" style="margin-top:20px">Ir ao WhatsApp agora</button>
  </div>`);
}

function documental(){
  return pageShell(`
    <div class="insert-grid">
      <div class="detail-panel">
        <div class="card-code">Projeto personalizado</div>
        <h1>Inserção Documental</h1>
        <p>Sua empresa, produto ou serviço entra na própria história — sem transformar a série em um intervalo comercial.</p>
        <div class="muted-box"><strong>Preço:</strong> sob consulta. Cada projeto depende de complexidade, participação e planejamento editorial.</div>
      </div>
      <div class="detail-panel">
        <div class="card-code">Solicitar projeto</div>
        <div class="form-grid" style="margin-top:16px">
          <div class="field"><label for="dname">Nome *</label><input id="dname" maxlength="80"></div>
          <div class="field"><label for="dwhatsapp">WhatsApp *</label><input id="dwhatsapp" maxlength="20"></div>
          <div class="field full"><label for="dcompany">Empresa *</label><input id="dcompany" maxlength="100"></div>
          <div class="field full"><label for="dtext">Conte em poucas linhas o que você quer colocar na história *</label><textarea id="dtext" maxlength="700"></textarea></div>
        </div>
        <div style="margin-top:14px"><button class="btn primary full" id="requestProject" type="button">Solicitar contato</button></div>
      </div>
    </div>
  `);
}

function terms(){
  return pageShell(`<div class="legal">
    <div class="card-code">DOOX Studios</div>
    <h1>Termos de Uso</h1>
    <p>Versão inicial do MVP comercial da DOOX Studios. Este texto é um modelo operacional e deve ser revisado juridicamente antes da utilização comercial definitiva.</p>
    <h2>1. Objeto</h2>
    <p>Este site permite solicitar e adquirir modalidades comerciais e inserções relacionadas à série , produzida pela DOOX Studios.</p>
    <h2>2. Pedido, análise e atendimento</h2>
    <p>O pedido é criado no site e encaminhado ao atendimento oficial da DOOX Studios. A solicitação passa por análise de disponibilidade, formato, quantidade e encaixe editorial antes da confirmação. Eventuais condições de pagamento serão informadas pela equipe no atendimento oficial.</p>
    <h2>3. Controle editorial</h2>
    <p>A aquisição de uma inserção não garante ao comprador o direito de escolher episódio, data, posição, minuto, segundo ou ordem de exibição. A DOOX Studios mantém o controle editorial e define o encaixe de acordo com a produção, a narrativa, a disponibilidade e o planejamento.</p>
    <p>Quando uma inserção for programada, a DOOX Studios informará ao comprador o episódio e o momento previsto de exibição. O tempo comunicado é estimado e pode sofrer pequenos ajustes na edição final.</p>
    <h2>4. Materiais e conteúdo</h2>
    <p>O comprador declara possuir os direitos necessários sobre nome, marca, logo, @ e demais materiais que apresentar à DOOX Studios. A DOOX poderá recusar, adaptar ou solicitar alteração de conteúdo que seja ilícito, enganoso, ofensivo, discriminatório, incompatível com a identidade do projeto ou contrário às regras aplicáveis das plataformas.</p>
    <h2>5. Publicação e arquivo</h2>
    <p>A participação pode permanecer associada ao episódio publicado enquanto esse conteúdo estiver disponível. A DOOX Studios não garante disponibilidade do conteúdo por prazo determinado, nem garante visualizações, alcance, vendas, leads ou retorno financeiro.</p>
    <h2>6. Cancelamentos e reembolsos</h2>
    <p>Cancelamentos, arrependimento e reembolsos serão tratados conforme a legislação aplicável, as características do serviço contratado e o estágio de execução do pedido. Nenhuma cláusula deste documento limita direitos legais que não possam ser afastados.</p>
    <h2>7. Condutas proibidas</h2>
    <p>É proibido utilizar o site para spam, fraude, tentativa de manipular pedidos, ataques automatizados, conteúdo ilícito ou tentativa de burlar limites das modalidades. A DOOX poderá limitar ou bloquear acessos em casos de abuso.</p>
    <h2>8. Comunicação</h2>
    <p>O comprador autoriza comunicações operacionais relacionadas ao pedido por WhatsApp e/ou e-mail, incluindo confirmação, pagamento, programação, alteração e publicação.</p>
    <h2>9. Propriedade intelectual</h2>
    <p>Nome, identidade visual, conteúdo, materiais e marcas da DOOX Studios e da  permanecem protegidos pelas normas aplicáveis e não podem ser explorados comercialmente sem autorização.</p>
    <h2>10. Atualizações</h2>
    <p>A DOOX Studios pode atualizar estes termos para refletir mudanças no site, nos produtos ou na legislação, sem afastar direitos já consolidados dos consumidores.</p>
  </div>`);
}

function privacy(){
  return pageShell(`<div class="legal">
    <div class="card-code">DOOX Studios</div>
    <h1>Política de Privacidade</h1>
    <p>Versão inicial do MVP. Deve ser revisada juridicamente antes da publicação definitiva.</p>
    <h2>1. Dados coletados</h2>
    <p>O site pode solicitar nome, WhatsApp, e-mail, CPF/CNPJ, empresa, @ e informações necessárias para identificar e atender o pedido.</p>
    <h2>2. Finalidade</h2>
    <p>Os dados são usados para criar o pedido, prestar atendimento, confirmar pagamento, organizar a inserção, comunicar o andamento e comprovar a execução do serviço.</p>
    <h2>3. Compartilhamento</h2>
    <p>Os dados não são vendidos. Podem ser compartilhados com prestadores necessários à operação, quando aplicável e dentro das finalidades informadas.</p>
    <h2>4. Segurança</h2>
    <p>A aplicação adota medidas técnicas e organizacionais proporcionais ao MVP. O site não solicita senhas bancárias e não recebe comprovantes por upload. O comprovante é enviado diretamente pelo WhatsApp.</p>
    <h2>5. Retenção</h2>
    <p>Os dados podem ser mantidos pelo período necessário para atendimento, registro da relação comercial, cumprimento de obrigações legais e exercício de direitos.</p>
    <h2>6. Direitos</h2>
    <p>O titular pode solicitar informações e exercer os direitos previstos na legislação aplicável por meio do canal oficial informado pela DOOX Studios.</p>
  </div>`);
}

function render(){
  persistState();
  const path=window.location.hash.replace(/^#/,"") || "/";
  let html="";
  if(path==="/" ) html=home();
  else if(path==="/hocco") html=hocco();
  else if(path==="/insercoes") html=insertions();
  else if(path==="/como-funciona") html=howWorks();
  else if(path==="/escolher") html=choose();
  else if(path==="/sponsor-overlay") html=overlayChooser();
  else if(path==="/cliente") html=customerForm();
  else if(path==="/rever-pedido") html=reviewOrder();
  else if(path==="/insercao-documental") html=documental();
  else if(path==="/termos") html=terms();
  else if(path==="/privacidade") html=privacy();
  else if(path==="/pedido") { const raw=sessionStorage.getItem("doox_last_order"); html=raw ? orderSuccess(JSON.parse(raw).id, JSON.parse(raw).total) : pageShell(`<div class="empty"><h2>Pedido não encontrado.</h2><a class="btn primary" href="#/insercoes" data-route>Voltar às inserções</a></div>`); }
  else html=pageShell(`<div class="empty"><h2>Página não encontrada.</h2><a class="btn primary" href="#/" data-route>Voltar</a></div>`);
  app.innerHTML=html;
  const headerHomeBack = document.getElementById("headerHomeBack");
  if(headerHomeBack){ headerHomeBack.hidden = path === "/"; }
  bindPage();
}

function sendOrderToWhatsApp(order){
  const customer = order.customer || {};
  const customerType = customer.kind === "empresa" ? "EMPRESA" : "PESSOA FÍSICA";
  const category = order.categoryId
    ? (categoryFor(order.productId, order.categoryId)?.label || order.categoryId)
    : null;

  const lines = [
    "🔶 DOOX STUDIOS",
    "🔸 NOVA SOLICITAÇÃO ",
    "━━━━━━━━━━━━━━━━━━",
    "",
    `✅ PEDIDO ${order.id || "#DOOX-XXXX"}`,
    "",
    "🎬 INSERÇÃO",
    order.product || "Não informado",
    category ? `◈ CATEGORIA\n${category}` : null,
    `◈ QUANTIDADE\n${order.quantity || 1} inserção${Number(order.quantity) === 1 ? "" : "ões"}`,
    order.unitPrice != null ? `◈ VALOR UNITÁRIO\n${money(order.unitPrice)}` : null,
    order.total != null ? `🔶 TOTAL\n${money(order.total)}` : null,
    `⏹️ PREFERÊNCIA\n${order.preference || "Próximo episódio disponível"}`,
    "",
    "━━━━━━━━━━━━━━━━━━",
    "👤 CLIENTE",
    "━━━━━━━━━━━━━━━━━━",
    `Tipo: ${customerType}`,
    customer.name ? `Nome: ${customer.name}` : null,
    customer.kind === "empresa" && customer.company ? `Empresa: ${customer.company}` : null,
    customer.document ? `${customer.kind === "empresa" ? "CNPJ" : "CPF"}: ${customer.document}` : null,
    customer.whatsapp ? `WhatsApp: ${customer.whatsapp}` : null,
    customer.email ? `E-mail: ${customer.email}` : null,
    customer.handle ? `@ / PERFIL\n${customer.handle}` : null,
    customer.note ? `📝 OBSERVAÇÃO\n${customer.note}` : null,
    "",
    "━━━━━━━━━━━━━━━━━━",
    "🔸 STATUS",
    "Solicitação enviada para triagem.",
    "Aguardo a análise e confirmação da DOOX Studios.",
    "",
    "⏹️ Este envio não representa aprovação automática.",
    "",
    "🔶  · DOOX STUDIOS"
  ].filter(Boolean).join("\n");

  const number = String(CONFIG.whatsappNumber || "").replace(/\D/g, "");
  if (!number || number === "SEUNUMEROWHATSAPPAQUI") {
    flashToast("Número do WhatsApp da DOOX Studios não configurado.");
    return false;
  }

  const url = `https://wa.me/${number}?text=${encodeURIComponent(lines)}`;

  // Redirecionamento funciona tanto no navegador quanto no PWA instalado.
  window.location.assign(url);
  return true;
}

function bindPage(){
  attachProductSounds();

  document.querySelectorAll("[data-external-tiktok]").forEach(link=>{
    link.addEventListener("click",()=>{
      // URL oficial única; mantém o destino correto mesmo dentro do PWA.
      link.href=CONFIG.tiktok;
    });
  });

  document.querySelectorAll("[data-back]").forEach(btn=>{
    btn.addEventListener("click",()=>goBack());
  });

  document.querySelectorAll(".preference").forEach(btn=>{
    btn.addEventListener("click",()=>{
      state.preference=btn.dataset.pref;
      playSelectSound();
      render();
    });
  });

  document.querySelectorAll("[data-category]").forEach(btn=>{
    let armed=false;
    btn.addEventListener("mouseenter",()=>{if(!armed){armed=true;playSelectSound();}});
    btn.addEventListener("mouseleave",()=>{armed=false;});
    btn.addEventListener("click",()=>{
      state.categoryId=btn.dataset.category;
      playSelectSound();
      render();
    });
  });

  const minus=$("#minusQty"), plus=$("#plusQty");
  if(minus){
    minus.addEventListener("click",()=>{state.quantity=Math.max(1,state.quantity-1);render();});
    plus.addEventListener("click",()=>{state.quantity=Math.min(50,state.quantity+1);render();});
  }

  const cont=$("#continueCustomer");
  if(cont){
    cont.addEventListener("click",()=>{
      if((state.productId==="overlay" || state.productId==="overlayAudio") && !state.categoryId){flashToast("Escolha uma categoria.");return;}
      setRoute("/cliente");
    });
  }

  const contBug=$("#continueBug");
  if(contBug){
    contBug.addEventListener("click",()=>{
      if(!state.categoryId){flashToast("Escolha uma categoria.");return;}
      state.preference="Próximo episódio disponível";
      setRoute("/cliente");
    });
  }

  const ruleModal=$("#ruleModal");
  if(ruleModal){
    document.querySelectorAll("[data-close-modal]").forEach(el=>el.addEventListener("click",()=>ruleModal.hidden=true));
    const trigger=$("#ruleCentral"); if(trigger) trigger.addEventListener("click",()=>ruleModal.hidden=false);
  }

  document.querySelectorAll(".participant-option").forEach(btn=>{
    btn.addEventListener("click",()=>{
      state.customer.kind=btn.dataset.kind;
      playSelectSound();
      render();
    });
  });

  const backToChoose=$("#backToChoose");
  if(backToChoose) backToChoose.addEventListener("click",()=>{
    if(state.productId==="overlay" || state.productId==="overlayAudio") setRoute("/sponsor-overlay");
    else setRoute("/escolher");
  });

  const customerFields=["name","whatsapp","email","document","company","handle","note"];
  customerFields.forEach(id=>{
    const el=$("#"+id);
    if(el) el.addEventListener("input",()=>{ state.customer[id]=safeText(el.value,id==="note"?300:id==="name"?80:id==="company"?100:id==="handle"?40:180); });
  });
  const termsCheck=$("#termsCheck");
  if(termsCheck) termsCheck.addEventListener("change",()=>{state.termsAccepted=termsCheck.checked;});

  const review=$("#reviewOrder");
  if(review){
    review.addEventListener("click",()=>{
      const fields={name:$("#name")?.value,whatsapp:$("#whatsapp")?.value,email:$("#email")?.value,document:$("#document")?.value,company:$("#company")?.value,handle:$("#handle")?.value,note:$("#note")?.value};
      if(!validateText(fields.name,80)||!validateText(fields.whatsapp,20)||!validateText(fields.email,150)||!validateText(fields.document,18)){flashToast("Preencha corretamente os campos obrigatórios.");return;}
      if(state.customer.kind==="empresa"&&!validateText(fields.company,100)){flashToast("Informe o nome da empresa.");return;}
      if(fields.handle&&!validatePublicText(fields.handle)){flashToast("O @ informado não pode ser usado.");return;}
      if(!$("#termsCheck").checked){flashToast("Aceite os termos para continuar.");return;}
      state.customer={kind:state.customer.kind,...Object.fromEntries(Object.entries(fields).map(([k,v])=>[k,safeText(v,k==="note"?300:k==="name"?80:k==="company"?100:k==="handle"?40:180)]))};
      setRoute("/rever-pedido");
    });
  }
  const editOrder=$("#editOrder");
  if(editOrder) editOrder.addEventListener("click",()=>setRoute("/cliente"));
  const confirmOrder=$("#confirmOrder");
  if(confirmOrder) confirmOrder.addEventListener("click",()=>{
    const orderId=randomId();
    let unitPrice=PRODUCTS[state.productId].price;
    if(state.productId==="overlay") unitPrice=categoryPrice(state.productId,state.categoryId)??unitPrice;
    if(state.productId==="overlayAudio") unitPrice=categoryPrice(state.productId,state.categoryId)??unitPrice;
    const total=unitPrice*state.quantity;
    const order={id:orderId,product:PRODUCTS[state.productId].title,productId:state.productId,categoryId:state.categoryId,quantity:state.quantity,unitPrice,preference:state.preference,total,customer:state.customer,createdAt:new Date().toISOString()};
    sessionStorage.setItem("doox_last_order",JSON.stringify(order));
    localSet("lastOrder",order);
    localSet("draft",{...state,customer:{...state.customer}});
    setRoute("/pedido");
  });
  const open=$("#openWhatsApp");
  if(open){
    open.addEventListener("click",()=>{
      const raw=sessionStorage.getItem("doox_last_order");
      if(!raw){flashToast("Pedido não encontrado nesta sessão.");return;}
      sendOrderToWhatsApp(JSON.parse(raw));
    });
  }

  const returnToSite=$("#returnToSite");
  if(returnToSite) returnToSite.addEventListener("click",()=>setRoute("/insercoes"));

  const req=$("#requestProject");
  if(req){
    req.addEventListener("click",()=>{
      const n=safeText($("#dname")?.value,80), w=safeText($("#dwhatsapp")?.value,20), c=safeText($("#dcompany")?.value,100), t=safeText($("#dtext")?.value,700);
      if(!n||!w||!c||!t){flashToast("Preencha os campos obrigatórios.");return;}
      if(!validatePublicText(c) || !validatePublicText(t)){flashToast("Revise o texto enviado.");return;}
      if(CONFIG.whatsappNumber==="SEU_NUMERO_WHATSAPP_AQUI"){flashToast("Configure o número do WhatsApp em app.js antes de publicar.");return;}
      const msg=[
        "Olá, DOOX Studios.",
        "",
        "Quero solicitar um projeto de Inserção Documental.",
        `Nome: ${n}`,
        `WhatsApp: ${w}`,
        `Empresa: ${c}`,
        `Projeto: ${t}`
      ].join("\n");
      window.location.href=`https://wa.me/${CONFIG.whatsappNumber}?text=${encodeURIComponent(msg)}`;
    });
  }

}

function applyDeviceHints(){
  const conn=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
  if(conn && (conn.saveData || /(^|-)2g$/.test(conn.effectiveType||""))) document.documentElement.classList.add("low-bandwidth");
  if(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) document.documentElement.classList.add("reduced-motion");
  document.documentElement.classList.toggle("offline",!navigator.onLine);
}
window.addEventListener("online",()=>document.documentElement.classList.remove("offline"));
window.addEventListener("offline",()=>document.documentElement.classList.add("offline"));
applyDeviceHints();
restoreState();
if(!history.state || !history.state.dooxRoute){ history.replaceState({dooxRoute: window.location.hash.replace(/^#/ ,"") || "/"}, "", window.location.href); }
render();


/* DOOX DEFINITIVO — final handoff and review */
function dooxShowHandoffAndWhatsApp(message){
  const overlay = document.getElementById('hoccoHandoff');
  if (overlay) {
    overlay.classList.add('show');
    overlay.setAttribute('aria-hidden','false');
  }
  sessionStorage.setItem('doox_last_order', JSON.stringify({
    savedAt: new Date().toISOString(),
    message: message
  }));
  setTimeout(() => {
    window.location.href = 'https://wa.me/5514981150675?text=' + encodeURIComponent(message);
  }, 1300);
}
