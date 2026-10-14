from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / 'impulsionadores'


def replace_one(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'missing expected source fragment: {label}')
    return text.replace(old, new, 1)

# Member app: make offer filters real, favorites persistent and streak progress truthful.
p = ROOT / 'app/app/MemberAppFinal.js'
s = p.read_text()
s = replace_one(
    s,
    "import {Bell,Building2,CheckCircle2,ChevronRight,ExternalLink,Flame,Gamepad2,Gift,Heart,Home,LogOut,Megaphone,Search,Settings2,Sparkles,Tag,Target,Trophy,User,Volume2,VolumeX,Youtube,Zap}",
    "import {Bell,Building2,CalendarDays,CheckCircle2,ChevronRight,ExternalLink,Flame,Gamepad2,Gift,Heart,Home,LogOut,Megaphone,Search,Settings2,Sparkles,Tag,Target,Trophy,User,Volume2,VolumeX,Youtube,Zap}",
    'member lucide import',
)
s = replace_one(
    s,
    "[toast,setToast]=useState(''),[gameOpen,setGameOpen]=useState(false),[sound,setSound]=useState(true);",
    "[toast,setToast]=useState(''),[gameOpen,setGameOpen]=useState(false),[sound,setSound]=useState(true),[upcoming,setUpcoming]=useState([]),[offerMode,setOfferMode]=useState('today'),[favorites,setFavorites]=useState(()=>new Set());",
    'member extra states',
)
s = replace_one(
    s,
    "useEffect(()=>{try{setSound(localStorage.getItem('hocco:sounds')!=='off')}catch{};let alive=true;",
    "useEffect(()=>{try{setSound(localStorage.getItem('hocco:sounds')!=='off');const saved=JSON.parse(localStorage.getItem('hocco:favorites')||'[]');setFavorites(new Set(Array.isArray(saved)?saved:[]))}catch{};let alive=true;",
    'member favorites bootstrap',
)
s = replace_one(
    s,
    "setDrops(dr.data||[])}",
    "setDrops(dr.data||[]);const {data:up}=await supabase.rpc('hocco_ofertas_proximas',{p_days:7});setUpcoming(Array.isArray(up)?up:[])}",
    'member upcoming bootstrap',
)
s = replace_one(
    s,
    "async function loadOffers(){const {data}=await supabase.from('hocco_ofertas').select('*').eq('status','active').eq('display_date',todayBR()).order('created_at',{ascending:false}).limit(50);setOffers(data||[])}",
    "async function loadOffers(){const [{data},{data:up}]=await Promise.all([supabase.from('hocco_ofertas').select('*').eq('status','active').eq('display_date',todayBR()).order('created_at',{ascending:false}).limit(50),supabase.rpc('hocco_ofertas_proximas',{p_days:7})]);setOffers(data||[]);setUpcoming(Array.isArray(up)?up:[])}",
    'member reload current/upcoming',
)
s = replace_one(
    s,
    "function toggleSound(){const next=!sound;setSound(next);try{localStorage.setItem('hocco:sounds',next?'on':'off')}catch{};if(next)tone('success',true)}",
    "function toggleSound(){const next=!sound;setSound(next);try{localStorage.setItem('hocco:sounds',next?'on':'off')}catch{};if(next)tone('success',true)}\n function toggleFavorite(id){setFavorites(prev=>{const next=new Set(prev);next.has(id)?next.delete(id):next.add(id);try{localStorage.setItem('hocco:favorites',JSON.stringify([...next]))}catch{};return next});tone('tap',sound)}",
    'member favorite toggle',
)
s = replace_one(
    s,
    "const filtered=useMemo(()=>offers.filter(o=>{const q=search.trim().toLowerCase();return(cat==='Todos'||o.categoria===cat)&&(!q||`${o.nome_fantasia} ${o.titulo} ${o.oferta_texto} ${o.categoria}`.toLowerCase().includes(q))}),[offers,search,cat]);",
    "const filtered=useMemo(()=>{const source=offerMode==='upcoming'?upcoming:offers;return source.filter(o=>{if(offerMode==='favorites'&&!favorites.has(o.id))return false;const q=search.trim().toLowerCase();return(cat==='Todos'||o.categoria===cat)&&(!q||`${o.nome_fantasia} ${o.titulo} ${o.oferta_texto} ${o.categoria}`.toLowerCase().includes(q))})},[offers,upcoming,offerMode,favorites,search,cat]);",
    'member filtered source',
)
s = replace_one(
    s,
    "{tab==='ofertas'&&<><Page title=\"Ofertas\" text=\"Descubra produtos, serviços e oportunidades aprovadas pela HOCCO.\"/><SearchBox/><div className=\"hfFilterRow\"><button className=\"active\">🔥 Hoje</button><button>Próximas</button><button>♡ Favoritas</button></div><Cats/><Title icon={Flame} text=\"Ofertas do Momento\"/><div className=\"hfOfferGrid\">{filtered.map(o=><Offer key={o.id} o={o}/>)}{Array.from({length:Math.max(0,4-filtered.length)}).map((_,i)=><Empty key={`e${i}`} i={i+2}/>)}</div><Sponsors/></>}",
    "{tab==='ofertas'&&<><Page title=\"Ofertas\" text=\"Descubra produtos, serviços e oportunidades aprovadas pela HOCCO.\"/><SearchBox/><div className=\"hfFilterRow\"><button className={offerMode==='today'?'active':''} onClick={()=>setOfferMode('today')}><Flame/> Hoje</button><button className={offerMode==='upcoming'?'active':''} onClick={()=>setOfferMode('upcoming')}><CalendarDays/> Próximas</button><button className={offerMode==='favorites'?'active':''} onClick={()=>setOfferMode('favorites')}><Heart/> Favoritas</button></div><Cats/><Title icon={Flame} text={offerMode==='upcoming'?'Próximas ofertas':offerMode==='favorites'?'Suas favoritas':'Ofertas do Momento'}/><div className=\"hfOfferGrid\">{filtered.map(o=><Offer key={o.id} o={o} upcoming={offerMode==='upcoming'}/>)}{Array.from({length:Math.max(0,4-filtered.length)}).map((_,i)=><Empty key={`e${i}`} i={i+2}/>)}</div><Sponsors/></>}",
    'member real filter controls',
)
s = replace_one(
    s,
    "<Mission icon={Flame} title=\"Mantenha sua ofensiva ativa\" detail=\"Acesse e participe hoje.\" progress=\"1/1\" pct={100} reward=\"XP\" done={Boolean(profile.ultimo_dia_ativo===todayBR())}/>",
    "<Mission icon={Flame} title=\"Mantenha sua ofensiva ativa\" detail=\"Acesse e participe hoje.\" progress={profile.ultimo_dia_ativo===todayBR()?'1/1':'0/1'} pct={profile.ultimo_dia_ativo===todayBR()?100:0} reward=\"XP\" done={Boolean(profile.ultimo_dia_ativo===todayBR())}/>",
    'member streak progress',
)
s = replace_one(
    s,
    "function Offer({o}){return <article className=\"hfOffer\" data-offer-id={o.id}><div className=\"hfOfferImg\">{o.capa_url?<img src={o.capa_url} alt=\"\"/>:<Tag/>}<Heart/></div><div className=\"hfOfferBody\"><div className=\"hfCompany\">{o.logo_url?<img src={o.logo_url} alt=\"\"/>:<span>{o.nome_fantasia?.[0]||'H'}</span>}<div><b>{o.nome_fantasia}</b><small>{o.instagram||o.segmento||'Parceiro HOCCO'}</small></div><em>{o.categoria||'Oferta'}</em></div><h3>{o.oferta_texto||o.titulo}</h3>{o.descricao&&<p>{o.descricao}</p>}<small>Válido hoje · {dbr(`${o.display_date}T12:00:00-03:00`)}</small><button onClick={()=>openOffer(o)}>Ver oferta <ExternalLink/></button></div></article>}",
    "function Offer({o,upcoming=false}){const fav=favorites.has(o.id);return <article className=\"hfOffer\" data-offer-id={upcoming?undefined:o.id}><div className=\"hfOfferImg\">{o.capa_url?<img src={o.capa_url} alt=\"\"/>:<Tag/>}<button type=\"button\" className={`hfFavorite ${fav?'active':''}`} aria-label={fav?'Remover dos favoritos':'Adicionar aos favoritos'} onClick={()=>toggleFavorite(o.id)}><Heart fill={fav?'currentColor':'none'}/></button></div><div className=\"hfOfferBody\"><div className=\"hfCompany\">{o.logo_url?<img src={o.logo_url} alt=\"\"/>:<span>{o.nome_fantasia?.[0]||'H'}</span>}<div><b>{o.nome_fantasia}</b><small>{o.instagram||o.segmento||'Parceiro HOCCO'}</small></div><em>{o.categoria||'Oferta'}</em></div><h3>{o.oferta_texto||o.titulo}</h3>{o.descricao&&<p>{o.descricao}</p>}<small>{upcoming?`Programada para ${dbr(`${o.display_date}T12:00:00-03:00`)}`:`Válido hoje · ${dbr(`${o.display_date}T12:00:00-03:00`)}`}</small>{upcoming?<button disabled>Em breve</button>:<button onClick={()=>openOffer(o)}>Ver oferta <ExternalLink/></button>}</div></article>}",
    'member offer card',
)
p.write_text(s)

# Member CSS for favorite control and semantic filter icons.
p = ROOT / 'app/app/member-final.css'
s = p.read_text()
s = replace_one(
    s,
    ".hfOfferImg>svg:last-child{position:absolute;right:10px;top:10px;color:#fff;filter:drop-shadow(0 1px 2px rgba(0,0,0,.45))}",
    ".hfFavorite{position:absolute;right:10px;top:10px;width:34px;height:34px;border:0;border-radius:50%;display:grid;place-items:center;background:rgba(7,28,61,.58);color:#fff;backdrop-filter:blur(5px);z-index:2}.hfFavorite svg{width:18px;height:18px}.hfFavorite.active{background:#fff;color:#ef4058}.hfOfferImg>svg:last-child{color:#4a94ed}",
    'member favorite css',
)
s += "\n.hfFilterRow button{display:flex;align-items:center;gap:5px}.hfFilterRow button svg{width:14px;height:14px}.hfOfferBody>button:disabled{background:#e8eef5;color:#6d8199;cursor:default}\n"
p.write_text(s)

# Business correction: persist both business fields and offer fields.
p = ROOT / 'app/empresa/BusinessFinal.js'
s = p.read_text()
s = replace_one(
    s,
    "if(editing)res=await supabase.rpc('atualizar_oferta_solicitacao',{p_id:editing,p_categoria:draft.categoria,p_titulo:draft.titulo,p_oferta_texto:draft.oferta_texto,p_descricao:draft.descricao,p_destino_url:draft.destino_url,p_display_date:draft.display_date,p_logo_url:draft.logo_url,p_capa_url:draft.capa_url});",
    "if(editing)res=await supabase.rpc('atualizar_oferta_solicitacao_v2',{p_id:editing,p_cnpj:onlyDigits(draft.cnpj),p_razao_social:draft.razao_social,p_nome_fantasia:draft.nome_fantasia,p_responsavel:draft.responsavel,p_whatsapp:onlyDigits(draft.whatsapp),p_email:draft.email,p_cidade:draft.cidade,p_uf:draft.uf,p_segmento:draft.segmento,p_instagram:draft.instagram,p_categoria:draft.categoria,p_titulo:draft.titulo,p_oferta_texto:draft.oferta_texto,p_descricao:draft.descricao,p_destino_url:draft.destino_url,p_display_date:draft.display_date,p_logo_url:draft.logo_url,p_capa_url:draft.capa_url});",
    'business correction rpc',
)
p.write_text(s)

# Control: remove literal flame symbol and stop claiming systems are online when a load failed.
p = ROOT / 'app/controle/ControlFinal.js'
s = p.read_text()
s = replace_one(
    s,
    "import {Activity,Award,Banknote,BarChart3,Bell,Building2,CalendarDays,CheckCircle2,CircleDollarSign,ExternalLink,Gift,LayoutDashboard,LogOut,Megaphone,MousePointerClick,RefreshCw,Search,Settings,ShieldCheck,Sparkles,Tag,Target,Users,XCircle,Zap}",
    "import {Activity,Award,Banknote,BarChart3,Bell,Building2,CalendarDays,CheckCircle2,CircleDollarSign,ExternalLink,Flame,Gift,LayoutDashboard,LogOut,Megaphone,MousePointerClick,RefreshCw,Search,Settings,ShieldCheck,Sparkles,Tag,Target,Users,XCircle,Zap}",
    'control flame import',
)
s = replace_one(
    s,
    "[selected,setSelected]=useState(null);const t=useRef(null);",
    "[selected,setSelected]=useState(null),[syncOk,setSyncOk]=useState(true);const t=useRef(null);",
    'control sync state',
)
s = replace_one(
    s,
    "if(g.data){setCfg(g.data);setDraft(g.data)}const e=[o,r,s,p,c,d,g].find(x=>x.error)?.error;if(e)flash(`Atualização parcial: ${e.message}`)}",
    "if(g.data){setCfg(g.data);setDraft(g.data)}const e=[o,r,s,p,c,d,g].find(x=>x.error)?.error;setSyncOk(!e);if(e)flash(`Atualização parcial: ${e.message}`)}",
    'control sync result',
)
s = replace_one(s, "<em>🔥 {p.ofensiva_dias} dias</em>", "<em><Flame/> {p.ofensiva_dias} dias</em>", 'control streak icon')
s = replace_one(
    s,
    '<section><h3>Status da plataforma</h3><p>● App do usuário <b>Online</b></p><p>● Área comercial <b>Online</b></p><p>● Pagamentos <b>Online</b></p><p>● Realtime <b>Online</b></p></section>',
    "<section><h3>Status da plataforma</h3><p>Data API <b>{syncOk?'Sincronizada':'Atenção'}</b></p><p>Ofertas <b>{syncOk?'Operacional':'Verificar'}</b></p><p>Pagamentos <b>{syncOk?'Operacional':'Verificar'}</b></p><p>Última leitura <b>{syncOk?'Concluída':'Parcial'}</b></p></section>",
    'control truthful status',
)
p.write_text(s)

print('HOCCO audit source fixes applied')
