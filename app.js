/* DOOX Studios — static MVP
   Sem banco de dados. Pedido fechado no WhatsApp.
   IMPORTANTE: não coloque segredos ou chave PIX neste arquivo.
*/

const CONFIG = {
  whatsappNumber: "5514981150675", // formato internacional, ex.: 5514999999999
  publicInstagram: "https://www.instagram.com/", // opcional
  youtube: "https://www.youtube.com/@HOCCPOV",
  tiktok: "https://www.tiktok.com/@HOCCOBRASIL"
};

const PRODUCTS = {
  apoiador: {
    id: "apoiador",
    title: "Apoiador Individual",
    short: "Apoio à produção",
    price: 9.90,
    priceLabel: "R$ 9,90",
    description: "Seu nome ou @ entra no Painel de Apoiadores e nos créditos finais do episódio.",
    details: ["Painel de Apoiadores", "Créditos finais", "50 vagas por episódio"],
    type: "support"
  },
  master: {
    id: "master",
    title: "Apoiador Master",
    short: "Apoio premium",
    price: 20.00,
    priceLabel: "R$ 20,00 / semana",
    description: "Uma posição de destaque para quem quer apoiar a história desde o começo.",
    details: ["Destaque no Painel", "Créditos finais", "@ fixado na descrição", "Vigência semanal"],
    type: "support"
  },
  curso: {
    id: "curso",
    title: "Inserção em Curso",
    short: "Seu @ dentro do episódio",
    price: 39.9,
    priceLabel: "R$ 39,90 / nome",
    description: "Seu @ aparece em uma faixa inferior por aproximadamente 5 segundos, em grupos de até 5 nomes.",
    details: ["~5 segundos", "Até 5 nomes por entrada", "Grupos distribuídos no episódio"],
    type: "display"
  },
  overlay: {
    id: "overlay",
    title: "Sponsor Overlay",
    short: "Publicidade gráfica",
    price: 179.90,
    priceLabel: "A partir de R$ 69,90",
    description: "Uma inserção gráfica curta que aparece sobre a narrativa, sem interromper o episódio. A identidade HOCCO. surge primeiro e, em seguida, a identificação do episódio e a marca anunciante.",
    details: ["Dedicado a empresas", "~5 segundos", "10 posições por episódio", "DOOX define o encaixe final"],
    type: "overlay"
  },
  overlayAudio: {
    id: "overlayAudio",
    title: "Sponsor Overlay + Áudio",
    short: "Publicidade gráfica com som",
    price: 229.90,
    priceLabel: "A partir de R$ 119,90",
    description: "A mesma lógica do Sponsor Overlay, com um áudio curto integrado à entrada da marca. O áudio pode ser um som de marca ou um efeito/notificação aprovado pela produção.",
    details: ["Inclui Sponsor Overlay", "Áudio curto integrado", "Som da marca ou efeito aprovado", "10 posições por episódio"],
    type: "overlayAudio"
  },
  documental: {
    id: "documental",
    title: "Inserção Documental",
    short: "Sua marca dentro da história",
    price: null,
    priceLabel: "Sob consulta",
    description: "Produto, serviço ou empresa integrados naturalmente à história documental.",
    details: ["Integração narrativa", "Planejamento editorial", "Projeto personalizado"],
    type: "consult"
  }
};

const OVERLAY_SLOTS = [
  {id:"SO-01", label:"Premium 1", time:"abertura / maior atenção", price:179.90, status:"Disponível"},
  {id:"SO-02", label:"Premium 2", time:"abertura / alta atenção", price:159.90, status:"Disponível"},
  {id:"SO-03", label:"Alto 1", time:"parte inicial", price:139.90, status:"Disponível"},
  {id:"SO-04", label:"Alto 2", time:"parte inicial", price:124.90, status:"Disponível"},
  {id:"SO-05", label:"Médio 1", time:"meio / cena relevante", price:109.90, status:"Disponível"},
  {id:"SO-06", label:"Médio 2", time:"meio", price:99.90, status:"Disponível"},
  {id:"SO-07", label:"Médio 3", time:"meio / menor pressão", price:89.90, status:"Disponível"},
  {id:"SO-08", label:"Baixo 1", time:"parte final", price:79.90, status:"Disponível"},
  {id:"SO-09", label:"Baixo 2", time:"parte final", price:69.90, status:"Disponível"},
  {id:"SO-10", label:"Final", time:"encerramento / alta retenção", price:119.90, status:"Disponível"}
];

const OVERLAY_AUDIO_SURCHARGE = 50.00;

function overlaySlotPrice(slotId, withAudio=false){
  const slot = OVERLAY_SLOTS.find(s=>s.id===slotId);
  if(!slot) return null;
  return slot.price + (withAudio ? OVERLAY_AUDIO_SURCHARGE : 0);
}

const state = {
  productId: null,
  slotId: null,
  quantity: 1,
  preference: "Próximo episódio disponível",
  customer: {
    name:"", whatsapp:"", email:"", document:"", company:"", handle:"", note:""
  },
  termsAccepted: false
};

const $ = (sel) => document.querySelector(sel);
const app = $("#app");
const toast = $("#toast");

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
  history.pushState({dooxRoute:path}, "", "#" + path);
  render();
  window.scrollTo({top:0,behavior:"smooth"});
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
  if (window.history.length > 1) {
    window.history.back();
    return;
  }
  setRoute("/");
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
        <h1>Tem um<br><span>projeto?</span></h1>
        <p>Coloque sua marca dentro das histórias que a DOOX Studios produz. A HOCCO. é uma série documental original em constante evolução.</p>
        <div class="cta-row">
          <a class="btn primary" href="#/insercoes" data-route>Ver inserções</a>
          <a class="btn secondary" href="#/hocco" data-route>Conhecer a HOCCO.</a>
        </div>
        <div class="home-socials" aria-label="Redes sociais">
          <a class="home-social-icon" href="https://www.youtube.com/@HOCCPOV" target="_blank" rel="noopener noreferrer" aria-label="Abrir canal no YouTube">${youtubeLogo(30)}</a>
          <a class="home-social-icon" href="https://www.tiktok.com/@HOCCOBRASIL" target="_blank" rel="noopener noreferrer" aria-label="Abrir perfil no TikTok">${tiktokLogo(30)}</a>
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
        <p>HOCCO. acompanha a vida e a evolução de Alex Hocc diante das câmeras. A série não tem um final pronto.</p>
      </div>
      <div class="video-strip">
        <div class="media-card">
          <div class="media-content">
            <div class="small">HOCCO.</div>
            <h3>Uma cápsula do tempo digital.</h3>
            <div>Hoje é um episódio. Daqui a anos, é memória.</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="inner">
            <h3>Você pode fazer parte.</h3>
            <p>Sua participação entra no arquivo público da história, conforme a modalidade escolhida.</p>
            <div class="home-inline-socials" aria-label="Redes sociais">
              <a class="home-inline-social" href="https://www.youtube.com/@HOCCPOV" target="_blank" rel="noopener noreferrer" aria-label="YouTube HOCCPOV" title="YouTube">${youtubeLogo(26)}</a>
              <a class="home-inline-social" href="https://www.tiktok.com/@HOCCOBRASIL" target="_blank" rel="noopener noreferrer" aria-label="TikTok HOCCOBRASIL" title="TikTok">${tiktokLogo(26)}</a>
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
        ${productCard(PRODUCTS.apoiador,"mais simples","R$ 5,00")}
        ${productCard(PRODUCTS.master,"apoio premium","R$ 20,00 / semana")}
        ${productCard(PRODUCTS.curso,"exposição","R$ 39,90")}
        ${productCard(PRODUCTS.overlay,"dedicado a empresas","A partir de R$ 69,90")}
      ${productCard(PRODUCTS.overlayAudio,"com áudio integrado","A partir de R$ 119,90")}
      </div>
    </div>
  `, {showBack:false});
}

function productCard(p, ribbon, customPrice){
  return `
    <article class="card insert-card" data-product="${p.id}">
      <div class="ribbon">${p.id === "overlay" || p.id === "overlayAudio" ? "Dedicado a empresas" : ribbon}</div>
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
      state.productId=id; state.slotId=null; state.quantity=1;
      if(id==="documental") setRoute("/insercao-documental");
      else setRoute("/escolher");
    });
  });
}

function insertions(){
  return pageShell(`
    <div class="section-head">
      <div>
        <div class="card-code">DOOX Studios</div>
        <h1 style="font-size:58px;line-height:.98;letter-spacing:-.05em;margin:.15em 0 0">Escolha como participar do universo HOCCO.</h1>
      </div>
      <p>Os formatos são simples. O controle editorial continua com a DOOX Studios.</p>
    </div>
    <div class="cards">
      ${productCard(PRODUCTS.apoiador,"apoio","R$ 9,90")}
      ${productCard(PRODUCTS.master,"apoio premium","R$ 20,00 / semana")}
      ${productCard(PRODUCTS.curso,"exposição","R$ 39,90 / nome")}
      ${productCard(PRODUCTS.overlay,"dedicado a empresas","A partir de R$ 69,90")}
      ${productCard(PRODUCTS.overlayAudio,"com áudio integrado","A partir de R$ 119,90")}
      ${productCard(PRODUCTS.documental,"projeto","Sob consulta")}
    </div>
    <div class="section">
      <div class="warning"><strong>Novo modelo de preços:</strong> no Sponsor Overlay, cada posição possui um valor próprio. O preço varia conforme a importância editorial do momento, a atenção esperada e a posição da inserção no episódio. O valor não é igual para todos os momentos. <strong>O preço exibido é referente à posição escolhida.</strong> O Sponsor Overlay + Áudio acrescenta R$ 50,00 à posição selecionada.</div>
    </div>
    <div class="section">
      <div class="mvp-notice"><strong>MVP DOOX Studios:</strong> este site representa uma versão inicial do projeto comercial da DOOX Studios. Produtos, preços, formatos, posições e regras estão sujeitos a alterações e atualizações em breve.</div>
    </div>
  `);
}

function hocco(){
  return pageShell(`
    <div class="section-head">
      <div>
        <div class="kicker"><span class="rec"></span> HOCCO.</div>
        <h1 style="font-size:64px;line-height:.96;letter-spacing:-.06em;margin:.15em 0">Uma série original<br>DOOX Studios.</h1>
      </div>
    </div>
    <div class="video-strip">
      <div class="detail-panel">
        <div class="card-code">A história</div>
        <h2 style="font-size:34px;line-height:1;letter-spacing:-.04em">Você chegou no meio da história.</h2>
        <p>HOCCO. acompanha a vida de Alex Hocc enquanto novos projetos, empresas, pessoas, erros, decisões e acontecimentos surgem diante das câmeras.</p>
        <p>A série não tem um fim programado. Ela está em constante evolução. O próximo episódio ainda não aconteceu.</p>
        <div class="muted-box">A proposta é guardar momentos do presente como uma cápsula do tempo digital: pessoas, lugares e acontecimentos que poderão ser revistos muitos anos depois.</div>
      </div>
      <div class="stat-card">
        <div class="inner">
          <h3>Memória HOCCO.</h3>
          <p>Você pode fazer parte de algo que continua sendo construído.</p>
          <div class="social-dock" aria-label="Redes sociais da HOCCO">
            <a class="social-icon-button" href="https://www.youtube.com/@HOCCPOV" target="_blank" rel="noopener noreferrer" aria-label="YouTube HOCCPOV" title="YouTube">${youtubeLogo(34)}</a>
            <a class="social-icon-button" href="https://www.tiktok.com/@HOCCOBRASIL" target="_blank" rel="noopener noreferrer" aria-label="TikTok HOCCOBRASIL" title="TikTok">${tiktokLogo(34)}</a>
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
      <div class="timeline-item"><strong>2. Pagamento</strong><span>O pedido segue para o WhatsApp da DOOX.</span></div>
      <div class="timeline-item"><strong>3. Produção</strong><span>A equipe encaixa a inserção no planejamento editorial.</span></div>
      <div class="timeline-item"><strong>4. Aviso</strong><span>Você recebe episódio e tempo previsto antes da publicação.</span></div>
    </div>
    <div class="section">
      <div class="section-head"><div><div class="card-code">Regra central</div><h2>Você não compra o minuto.</h2></div></div>
      <div class="detail-panel">
        <p style="font-size:20px;color:#222;max-width:900px">Ao adquirir uma inserção, você compra o formato e o espaço comercial correspondente — não um minuto específico do episódio. A DOOX Studios mantém o controle editorial da HOCCO. e define em qual episódio e em qual momento sua inserção será utilizada, considerando a narrativa, a edição, a disponibilidade e o planejamento da produção. Quando sua inserção for programada, você receberá uma mensagem da DOOX Studios informando o episódio e o tempo previsto de aparição. <strong>Você não compra o minuto. Você compra uma posição comercial cujo valor varia conforme a importância do momento. O minuto e o segundo finais são definidos pela DOOX na edição.</strong></p>
      </div>
    </div>
  `);
}

function choose(){
  if(!state.productId) return setRoute("/insercoes");
  const p=PRODUCTS[state.productId];
  if(state.productId==="overlay" || state.productId==="overlayAudio") return overlayChooser();
  return pageShell(`
    <div class="insert-grid">
      <div class="detail-panel">
        <div class="card-code">${p.type}</div>
        <h1>${p.title}</h1>
        <p>${p.description}</p>
        <ul style="padding-left:18px;color:#5f5f5f;font-size:13px">${p.details.map(d=>`<li>${d}</li>`).join("")}</ul>
        ${p.price != null ? `
          <div class="section quantity-box" style="margin-top:28px">
            <div class="card-code">Quantidade</div>
            <div class="quantity-control" style="margin-top:10px">
              <button class="btn secondary" id="minusQty" type="button" aria-label="Diminuir quantidade">−</button>
              <div id="qtyValue" class="quantity-value">${state.quantity}</div>
              <button class="btn secondary" id="plusQty" type="button" aria-label="Aumentar quantidade">+</button>
            </div>
            <div class="small-note" style="margin-top:9px">${state.productId==="curso" ? `Cada nome custa ${money(p.price)}.` : `Cada unidade custa ${money(p.price)}.`}</div>
          </div>` : ""}
      </div>
      <div class="detail-panel">
        <div class="card-code">Preferência</div>
        <h2 style="font-size:28px;letter-spacing:-.04em;margin:4px 0 10px">Quando você gostaria de aparecer?</h2>
        <div class="option-row">
          ${["Próximo episódio disponível","Nos próximos episódios","Não tenho preferência"].map(v=>`
            <button type="button" class="option preference ${state.preference===v?"selected":""}" data-pref="${v}">
              <span class="left"><strong>${v}</strong><span>Preferência editorial, não garantia.</span></span>
              <span>${state.preference===v?"✓":""}</span>
            </button>`).join("")}
        </div>
        <div class="warning" style="margin-top:18px">A DOOX Studios define o episódio e o momento exato. Você será notificado quando a inserção for programada.</div>
        <div class="summary" style="margin-top:18px">
          <div class="summary-row"><span>${p.title}</span><strong>${state.quantity} × ${money(p.price)}</strong></div>
          <div class="summary-row summary-total"><span>Total inicial</span><strong>${money(p.price * state.quantity)}</strong></div>
        </div>
        <div style="margin-top:15px"><button class="btn primary full" id="continueCustomer" type="button">Continuar</button></div>
      </div>
    </div>
  `);
}

function overlayChooser(){
  const withAudio = state.productId === "overlayAudio";
  const title = withAudio ? "Sponsor Overlay + Áudio" : "Sponsor Overlay";
  const overlaySlot = OVERLAY_SLOTS.find(s=>s.id===state.slotId);
  const selectedPrice = overlaySlotPrice(state.slotId, withAudio);
  return pageShell(`
    <div class="section-head">
      <div><div class="card-code">${withAudio ? "Sponsor Overlay + Áudio" : "Sponsor Overlay"}</div><h1 style="font-size:58px;line-height:.98;letter-spacing:-.05em;margin:.15em 0">${title}</h1></div>
      <p>O valor não é fixo: cada momento do episódio tem um preço próprio conforme sua importância editorial e o potencial de atenção daquela cena.</p>
    </div>
    <div class="insert-grid">
      <div class="detail-panel">
        <div class="muted-box"><strong>Como aparece:</strong> HOCCO. → identificação do episódio → logo da empresa. ${withAudio ? "Além da identidade visual, há um áudio curto integrado à entrada da marca." : "A inserção é visual e integrada à narrativa, sem interromper o episódio."}</div>
        <div class="section" style="margin-top:20px">
          <div class="card-code">Por que os preços mudam?</div>
          <p style="font-size:17px;color:#222">Uma inserção em uma cena de alta atenção vale mais do que uma inserção em um momento de menor relevância. Por isso, a tabela considera a <strong>posição e o valor editorial do momento</strong>, e não apenas a quantidade de segundos.</p>
          <div class="steps" style="grid-template-columns:1fr 1fr;margin-top:10px">
            <div class="step"><div class="step-num">01</div><h3>Você escolhe a posição</h3><p>Veja o valor individual de cada momento disponível.</p></div>
            <div class="step"><div class="step-num">02</div><h3>A DOOX encaixa</h3><p>O minuto e o segundo finais são definidos na edição.</p></div>
          </div>
        </div>
        <div class="mvp-notice" style="margin-top:20px"><strong>Importante:</strong> a faixa representa o valor comercial daquela posição. O momento exato pode sofrer ajuste na edição para preservar a narrativa.</div>
      </div>
      <div class="detail-panel">
        <div class="card-code">Posições disponíveis</div>
        <div class="small-note" style="margin:7px 0 12px">${withAudio ? "Os valores abaixo já incluem o áudio curto integrado (+ R$ 50,00 por posição)." : "Cada posição tem seu próprio preço, definido pela importância do momento."}</div>
        <div class="option-row">
          ${OVERLAY_SLOTS.map(slot=>{
            const price=overlaySlotPrice(slot.id, withAudio);
            return `<button type="button" class="option bug-option ${state.slotId===slot.id?"selected":""}" data-slot="${slot.id}">
              <span class="left"><strong>${slot.label} · ${slot.time}</strong><span>${slot.id} · ${slot.status}</span></span>
              <span class="price">${money(price)}</span>
            </button>`;
          }).join("")}
        </div>
        <div class="summary" style="margin-top:16px">
          <div class="summary-row"><span>Slot</span><strong>${state.slotId || "Selecione"}</strong></div>
          ${state.slotId ? `<div class="summary-row"><span>Valor da posição</span><strong>${money(selectedPrice)}</strong></div>` : ""}
          ${state.slotId ? `<div class="summary-row"><span>Quantidade</span><strong>${state.quantity} × ${money(selectedPrice)}</strong></div>` : ""}
          <div class="summary-row summary-total"><span>Total</span><strong>${state.slotId ? money(selectedPrice * state.quantity) : "—"}</strong></div>
        </div>
        <div class="quantity-control" style="margin-top:14px">
          <button class="btn secondary" id="minusQty" type="button" aria-label="Diminuir quantidade">−</button>
          <div id="qtyValue" class="quantity-value">${state.quantity}</div>
          <button class="btn secondary" id="plusQty" type="button" aria-label="Aumentar quantidade">+</button>
        </div>
        <div style="margin-top:15px"><button class="btn primary full" id="continueBug" type="button" ${state.slotId?"":"disabled"}>Continuar</button></div>
      </div>
    </div>
  `);
}

function customerForm(){
  const p=PRODUCTS[state.productId];
  let unitPrice = p.price;
  if(p.type==="overlay" || p.type==="overlayAudio"){
    unitPrice = overlaySlotPrice(state.slotId, p.type==="overlayAudio") ?? p.price;
  }
  let total = unitPrice * state.quantity;
  return pageShell(`
    <div class="section-head">
      <div><div class="card-code">Pedido</div><h1 style="font-size:58px;line-height:.98;letter-spacing:-.05em;margin:.15em 0">Quase lá.</h1></div>
      <p>Precisamos só dos dados básicos para gerar seu pedido e abrir a conversa com a DOOX no WhatsApp.</p>
    </div>
    <div class="insert-grid">
      <div class="detail-panel">
        <div class="card-code">Seus dados</div>
        <div class="form-grid" style="margin-top:16px">
          <div class="field"><label for="name">Nome *</label><input id="name" maxlength="80" value="${escapeAttr(state.customer.name)}" autocomplete="name"></div>
          <div class="field"><label for="whatsapp">WhatsApp *</label><input id="whatsapp" maxlength="20" value="${escapeAttr(state.customer.whatsapp)}" autocomplete="tel"></div>
          <div class="field"><label for="email">E-mail *</label><input id="email" maxlength="150" value="${escapeAttr(state.customer.email)}" type="email" autocomplete="email"></div>
          <div class="field"><label for="document">CPF/CNPJ *</label><input id="document" maxlength="18" value="${escapeAttr(state.customer.document)}" inputmode="numeric"></div>
          <div class="field"><label for="company">Empresa</label><input id="company" maxlength="100" value="${escapeAttr(state.customer.company)}"></div>
          <div class="field"><label for="handle">@ / identificação pública</label><input id="handle" maxlength="40" value="${escapeAttr(state.customer.handle)}" placeholder="@seunome"></div>
          <div class="field full"><label for="note">Observação (opcional)</label><textarea id="note" maxlength="300" placeholder="Algo que a DOOX deva saber sobre o pedido.">${escapeAttr(state.customer.note)}</textarea></div>
        </div>
        <div class="small-note" style="margin-top:12px">Nomes, @ e identificações públicas passam por validação de conteúdo. Não envie senhas, dados bancários ou informações sensíveis.</div>
      </div>
      <div class="detail-panel">
        <div class="card-code">Resumo</div>
        <div class="summary" style="margin-top:12px">
          <div class="summary-row"><span>Produto</span><strong>${p.title}</strong></div>
          ${state.slotId?`<div class="summary-row"><span>Slot</span><strong>${state.slotId}</strong></div>`:""}
          <div class="summary-row"><span>Quantidade</span><strong>${state.quantity}</strong></div>
          <div class="summary-row"><span>Preferência</span><strong>${state.preference}</strong></div>
          <div class="summary-row summary-total"><span>Total</span><strong>${money(total)}</strong></div>
        </div>
        <div style="margin-top:18px" class="checkbox">
          <input id="termsCheck" type="checkbox" ${state.termsAccepted ? "checked" : ""}>
          <label for="termsCheck">Li e aceito os <a href="#/termos" data-route style="color:var(--orange);font-weight:700">Termos de Uso</a> e a <a href="#/privacidade" data-route style="color:var(--orange);font-weight:700">Política de Privacidade</a>.</label>
        </div>
        <div class="warning" style="margin-top:16px">A aquisição não garante episódio ou segundo exatos. A DOOX Studios faz o encaixe final e notifica você quando a inserção for programada.</div>
        <div style="margin-top:16px"><button class="btn primary full" id="createOrder" type="button">Criar pedido</button></div>
      </div>
    </div>
  `);
}

function escapeAttr(s){
  return safeText(s,200).replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

function orderSuccess(orderId,total){
  return pageShell(`
    <div class="detail-panel" style="max-width:820px;margin:0 auto;text-align:center">
      <div class="kicker" style="justify-content:center"><span class="rec"></span> pedido criado</div>
      <h1 style="font-size:64px;line-height:.96;letter-spacing:-.06em;margin:10px 0">Entrou na fila.</h1>
      <p style="max-width:650px;margin:0 auto 24px;color:var(--muted)">Seu pedido foi criado. O próximo passo é continuar pelo WhatsApp oficial da DOOX Studios para receber as instruções de pagamento.</p>
      <div class="confirmation-card">
        <div class="confirmation-step"><span>1</span><div><strong>Confira seus dados</strong><small>Revise o pedido antes de seguir.</small></div></div>
        <div class="confirmation-divider"></div>
        <div class="confirmation-step"><span>2</span><div><strong>Confirmação no WhatsApp</strong><small>Ao clicar, você será encaminhado diretamente para a triagem.</small></div></div>
        <div class="confirmation-order"><span>Pedido ${orderId}</span><b>${money(total)}</b></div>
      </div>
      <div style="margin-top:22px" class="cta-row confirmation-actions">
        <button class="btn primary" id="openWhatsApp" type="button">Finalizar no WhatsApp</button>
        <a class="btn secondary" href="#/insercoes" data-route>Voltar às inserções</a>
      </div>
    </div>
  `);
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
    <p>Este site permite solicitar e adquirir modalidades de apoio e inserção relacionadas à série HOCCO., produzida pela DOOX Studios.</p>
    <h2>2. Pedido e pagamento</h2>
    <p>O pedido é criado no site e concluído por meio do atendimento oficial da DOOX Studios. O pagamento é realizado conforme as instruções fornecidas no atendimento oficial. O pedido só é considerado pago após a confirmação do recebimento.</p>
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
    <p>Nome, identidade visual, conteúdo, materiais e marcas da DOOX Studios e da HOCCO. permanecem protegidos pelas normas aplicáveis e não podem ser explorados comercialmente sem autorização.</p>
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
  const path=window.location.hash.replace(/^#/,"") || "/";
  let html="";
  if(path==="/" ) html=home();
  else if(path==="/hocco") html=hocco();
  else if(path==="/insercoes") html=insertions();
  else if(path==="/como-funciona") html=howWorks();
  else if(path==="/escolher") html=choose();
  else if(path==="/sponsor-overlay") html=overlayChooser();
  else if(path==="/cliente") html=customerForm();
  else if(path==="/insercao-documental") html=documental();
  else if(path==="/termos") html=terms();
  else if(path==="/privacidade") html=privacy();
  else html=pageShell(`<div class="empty"><h2>Página não encontrada.</h2><a class="btn primary" href="#/" data-route>Voltar</a></div>`);
  app.innerHTML=html;
  const headerHomeBack = document.getElementById("headerHomeBack");
  if(headerHomeBack){ headerHomeBack.hidden = path === "/"; }
  bindPage();
}

function bindPage(){
  attachProductSounds();

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

  document.querySelectorAll(".bug-option").forEach(btn=>{
    let armed=false;
    btn.addEventListener("mouseenter",()=>{if(!armed){armed=true;playSelectSound();}});
    btn.addEventListener("mouseleave",()=>{armed=false;});
    btn.addEventListener("click",()=>{
      state.slotId=btn.dataset.slot;
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
      if(state.productId==="overlay" && !state.slotId){flashToast("Escolha um slot.");return;}
      setRoute("/cliente");
    });
  }

  const contBug=$("#continueBug");
  if(contBug){
    contBug.addEventListener("click",()=>{
      if(!state.slotId){flashToast("Escolha um slot.");return;}
      state.preference="Próximo episódio disponível";
      setRoute("/cliente");
    });
  }

  const customerFields=["name","whatsapp","email","document","company","handle","note"];
  customerFields.forEach(id=>{
    const el=$("#"+id);
    if(el) el.addEventListener("input",()=>{ state.customer[id]=safeText(el.value,id==="note"?300:id==="name"?80:id==="company"?100:id==="handle"?40:180); });
  });
  const termsCheck=$("#termsCheck");
  if(termsCheck) termsCheck.addEventListener("change",()=>{state.termsAccepted=termsCheck.checked;});

  const create=$("#createOrder");
  if(create){
    create.addEventListener("click",()=>{
      const fields = {
        name: $("#name")?.value,
        whatsapp: $("#whatsapp")?.value,
        email: $("#email")?.value,
        document: $("#document")?.value,
        company: $("#company")?.value,
        handle: $("#handle")?.value,
        note: $("#note")?.value
      };
      if(!validateText(fields.name,80) || !validateText(fields.whatsapp,20) || !validateText(fields.email,150) || !validateText(fields.document,18)){
        flashToast("Preencha corretamente os campos obrigatórios.");
        return;
      }
      if(fields.handle && !validatePublicText(fields.handle)){
        flashToast("O @ informado não pode ser usado.");
        return;
      }
      if(!$("#termsCheck").checked){
        flashToast("Aceite os termos para continuar.");
        return;
      }
      state.customer=Object.fromEntries(Object.entries(fields).map(([k,v])=>[k,safeText(v,k==="note"?300:k==="name"?80:k==="company"?100:k==="handle"?40:180)]));
      const orderId=randomId();
      let unitPrice=PRODUCTS[state.productId].price;
      if(state.productId==="overlay" || state.productId==="overlayAudio"){
        unitPrice=overlaySlotPrice(state.slotId,state.productId==="overlayAudio") ?? unitPrice;
      }
      let total=unitPrice * state.quantity;

      const order = {
        id: orderId,
        product: PRODUCTS[state.productId].title,
        productId: state.productId,
        slotId: state.slotId,
        quantity: state.quantity,
        unitPrice,
        preference: state.preference,
        total,
        customer: state.customer,
        createdAt: new Date().toISOString()
      };
      sessionStorage.setItem("doox_last_order", JSON.stringify(order));
      setRoute("/pedido");
    });
  }

  const open=$("#openWhatsApp");
  if(open){
    open.addEventListener("click",()=>{
      const raw=sessionStorage.getItem("doox_last_order");
      if(!raw){flashToast("Pedido não encontrado nesta sessão.");return;}
      const order=JSON.parse(raw);
      const msg = [
        "Olá, DOOX Studios. Quero finalizar meu pedido.",
        "",
        `Pedido: ${order.id}.`,
        `Produto: ${order.product}.`,
        order.productId==="overlayAudio" ? "Inclui áudio curto integrado." : null,
        order.slotId?`Slot: ${order.slotId}.`:null,
        `Quantidade: ${order.quantity}.`,
        order.unitPrice ? `Valor por posição/unidade: ${money(order.unitPrice)}.` : null,
        `Valor: ${money(order.total)}.`,
        `Preferência: ${order.preference}.`,
        `Nome: ${order.customer.name}`,
        `WhatsApp: ${order.customer.whatsapp}`,
        `E-mail: ${order.customer.email}`,
        `CPF/CNPJ: ${order.customer.document}`,
        order.customer.company?`Empresa: ${order.customer.company}`:null,
        order.customer.handle?`@: ${order.customer.handle}`:null,
        "",
        "Estou seguindo para a triagem."
      ].filter(Boolean).join("\n");
      if(CONFIG.whatsappNumber==="SEU_NUMERO_WHATSAPP_AQUI"){
        flashToast("Configure o número do WhatsApp em app.js antes de publicar.");
        return;
      }
      window.location.href=`https://wa.me/${CONFIG.whatsappNumber}?text=${encodeURIComponent(msg)}`;
    });
  }

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

  if(window.location.hash==="#/pedido"){
    // render order summary from session
    const raw=sessionStorage.getItem("doox_last_order");
    if(raw){
      const order=JSON.parse(raw);
      app.innerHTML=orderSuccess(order.id,order.total);
      bindPage();
    }
  }
}

render();
