'use client';

import {useState} from 'react';
import {
  Activity,BarChart3,Bell,Building2,CalendarDays,CheckCircle2,ChevronRight,
  CircleDollarSign,Clock3,Coffee,Dumbbell,Eye,Flame,Gift,Home,MapPin,
  Megaphone,MousePointerClick,PawPrint,Scissors,Search,ShieldCheck,Tag,
  Target,User,Users,Wrench,Zap
} from 'lucide-react';
import './demo.css';

const offers=[
  {name:'Ponto Norte Café',cat:'Alimentação',title:'Café da tarde com 25% de desconto',text:'Válido das 15h às 18h para membros HOCCO.',icon:Coffee,accent:'orange'},
  {name:'Vitta Studio',cat:'Fitness',title:'Primeira semana de treino gratuita',text:'Avaliação inicial e acesso completo durante 7 dias.',icon:Dumbbell,accent:'blue'},
  {name:'Barbearia Linha 14',cat:'Beleza',title:'Corte + barba com benefício exclusivo',text:'Pacote especial para membros da comunidade.',icon:Scissors,accent:'navy'},
  {name:'Conserta Lar',cat:'Serviços',title:'Visita técnica sem taxa de deslocamento',text:'Atendimento residencial com agendamento pelo WhatsApp.',icon:Wrench,accent:'green'},
  {name:'Pet Vale',cat:'Pets',title:'Banho completo com 20% de desconto',text:'Oferta válida para cães de pequeno e médio porte.',icon:PawPrint,accent:'violet'},
  {name:'Oficina Horizonte',cat:'Automotivo',title:'Check-up preventivo com 15 itens',text:'Diagnóstico visual e eletrônico com hora marcada.',icon:Activity,accent:'steel'}
];

const members=[
  ['Marina Lopes','184 HC','2.840 XP','24 dias'],
  ['Rafael Nunes','96 HC','1.920 XP','11 dias'],
  ['Camila Prado','221 HC','3.410 XP','31 dias'],
  ['João Meireles','74 HC','1.280 XP','8 dias'],
  ['Bianca Torres','143 HC','2.210 XP','17 dias']
];

const queue=[
  ['Ponto Norte Café','Café da tarde com 25% OFF','Pagamento confirmado','17/10'],
  ['Vitta Studio','Semana gratuita para novos alunos','Em análise','18/10'],
  ['Conserta Lar','Visita técnica sem taxa','Pagamento informado','18/10'],
  ['Pet Vale','Banho completo com 20% OFF','Alteração solicitada','19/10']
];

export default function DemoPage(){
  const [mode,setMode]=useState('member');
  return <main className="demoRoot">
    <div className="demoNotice"><ShieldCheck/><span><b>MODO DEMONSTRAÇÃO</b><small>Todos os nomes, empresas, valores e métricas abaixo são fictícios. Nada desta tela é publicado como conteúdo real.</small></span></div>
    <div className="demoSwitcher">
      <button className={mode==='member'?'active':''} onClick={()=>setMode('member')}><User/> App do membro</button>
      <button className={mode==='business'?'active':''} onClick={()=>setMode('business')}><Megaphone/> Área de divulgações</button>
      <button className={mode==='control'?'active':''} onClick={()=>setMode('control')}><ShieldCheck/> HOCCO Control</button>
    </div>
    {mode==='member'&&<MemberDemo/>}
    {mode==='business'&&<BusinessDemo/>}
    {mode==='control'&&<ControlDemo/>}
  </main>;
}

function MemberDemo(){return <section className="demoPhone demoMember">
  <header className="dmTop"><div className="dmBrand"><b>HOCCO</b><i>Hype</i><small>HOCCO HOJE</small></div><div><button><Bell/></button><span className="dmAvatar">M</span></div></header>
  <div className="dmBody">
    <section className="dmWelcome"><div><small>MEMBRO HOCCO</small><h1>Olá, Marina</h1><p>Há novas oportunidades para você hoje.</p></div><div className="dmStats"><span><Flame/> Ofensiva: <b>24 dias</b></span><span><Zap/> HC: <b>184</b></span><div><small>Seu engajamento de hoje</small><b>3/5</b><i><em style={{width:'60%'}}/></i></div></div></section>
    <label className="dmSearch"><Search/><input readOnly placeholder="Buscar ofertas, serviços ou categorias"/></label>
    <div className="dmCats"><button className="active">Todos</button><button>Alimentação</button><button>Fitness</button><button>Beleza</button><button>Serviços</button><button>Pets</button></div>
    <div className="dmTitle"><span><Tag/><h2>Ofertas de hoje</h2></span><button>Ver todas <ChevronRight/></button></div>
    <div className="dmOfferGrid">{offers.map(o=><OfferCard key={o.name} offer={o}/>)}</div>
    <section className="dmMission"><Target/><div><small>MISSÃO DO DIA</small><b>Conheça 5 ofertas diferentes</b><p>Você já abriu 3 empresas hoje.</p><i><em style={{width:'60%'}}/></i></div><strong>3/5</strong></section>
    <section className="dmDrop"><Gift/><div><small>DROP DISPONÍVEL</small><b>Jantar especial para 5 membros</b><p>Requer 80 HC e ofensiva mínima de 10 dias.</p></div><button>Participar</button></section>
    <section className="dmCommunity"><Users/><span><b>Comunidade ativa</b><small>1.286 membros participaram nesta semana</small></span><em>6 ofertas agora</em></section>
  </div>
  <nav className="dmNav"><button className="active"><Home/><span>Início</span></button><button><Tag/><span>Ofertas</span></button><button><Target/><span>Missões</span></button><button><Gift/><span>Drops</span></button><button><User/><span>Perfil</span></button></nav>
</section>}

function OfferCard({offer}){const I=offer.icon;return <article className="dmOffer"><div className={`dmCover ${offer.accent}`}><I/><span>EMPRESA VERIFICADA</span></div><div className="dmOfferBody"><div className="dmCompany"><span><I/></span><div><b>{offer.name}</b><small>{offer.cat}</small></div><CheckCircle2/></div><h3>{offer.title}</h3><p>{offer.text}</p><div className="dmMeta"><span><MapPin/> Bauru/SP</span><span><CalendarDays/> Hoje</span></div><button>Abrir oferta <ChevronRight/></button></div></article>}

function BusinessDemo(){return <section className="demoDesktop demoBusiness">
  <header className="dbTop"><div className="dmBrand"><b>HOCCO</b><i>Hype</i></div><span>Minha Área de Divulgações</span><button>Voltar ao app</button></header>
  <div className="dbBody">
    <section className="dbHero"><div><small>ÁREA EXCLUSIVA DA MARCA</small><h1>Ponto Norte Café</h1><p>Gerencie publicações, acompanhe resultados e coloque campanhas anteriores no ar novamente.</p></div><span><CheckCircle2/> Área liberada</span></section>
    <div className="dbKpis"><Kpi icon={Megaphone} label="Divulgação ativa" value="1"/><Kpi icon={Tag} label="Divulgações feitas" value="12"/><Kpi icon={MousePointerClick} label="Cliques totais" value="1.486"/><Kpi icon={CircleDollarSign} label="Investimento" value="R$ 598,80"/></div>
    <div className="dbActions"><button className="primary"><Megaphone/> Nova divulgação</button><button><Tag/> Republicar uma anterior</button></div>
    <div className="dbSummary"><Mini icon={Megaphone} title="Divulgação atual" text="Café da tarde com 25% OFF" foot="Publicada hoje"/><Mini icon={CalendarDays} title="Próxima programada" text="Combo brunch para duas pessoas" foot="18/10"/><Mini icon={BarChart3} title="Último resultado" text="2.481 visualizações" foot="314 cliques externos"/></div>
    <div className="dbTabs"><button className="active">Ativas</button><button>Em análise</button><button>Programadas</button><button>Encerradas</button><button>Rascunhos</button></div>
    <section className="dbCampaign"><div className="dbCampaignVisual"><Coffee/></div><div><header><span><small>PUBLICADA</small><h2>Café da tarde com 25% de desconto</h2></span><CheckCircle2/></header><p>Oferta válida das 15h às 18h. Direcionamento para WhatsApp da empresa.</p><div className="dbMetrics"><span><Eye/><b>2.481</b><small>visualizações</small></span><span><MousePointerClick/><b>314</b><small>cliques</small></span><span><BarChart3/><b>12,7%</b><small>CTR</small></span></div><footer><button>Ver detalhes</button><button className="primary">Republicar</button><button>Duplicar e editar</button></footer></div></section>
    <div className="dbBottom"><section><h3>Status da divulgação</h3><div className="dbTimeline">{['Rascunho','Pagamento','Análise','Aprovada','Programada','Publicada'].map((s,i)=><span key={s} className="done"><i><CheckCircle2/></i><small>{s}</small></span>)}</div></section><section><h3>Pagamentos recentes</h3><Row left="Café da tarde com 25% OFF" mid="R$ 49,90" right="Confirmado"/><Row left="Combo brunch para duas pessoas" mid="R$ 49,90" right="Confirmado"/><Row left="Café + sobremesa" mid="R$ 49,90" right="Encerrado"/></section></div>
  </div>
</section>}

function ControlDemo(){return <section className="demoDesktop demoControl">
  <aside className="dcSide"><div className="dcBrand"><b>HOCCO</b><i>Control</i><small>DEMONSTRAÇÃO</small></div>{[['Visão Geral',Home],['Empresas & Prestadores',Building2],['Ofertas',Tag],['Fila de Análise',ShieldCheck],['Pagamentos',CircleDollarSign],['Drops',Gift],['Membros',Users],['Missões',Target],['Métricas',BarChart3]].map(([l,I],i)=><button className={i===0?'active':''} key={l}><I/><span>{l}</span>{l==='Fila de Análise'&&<em>4</em>}</button>)}</aside>
  <div className="dcMain"><header className="dcTop"><label><Search/><input readOnly placeholder="Buscar empresas, membros ou divulgações"/></label><div><Bell/><span className="dmAvatar">A</span><b>Admin HOCCO</b></div></header><div className="dcContent"><section className="dcHead"><div><small>HOCCO CONTROL</small><h1>Visão Geral</h1><p>Um cenário preenchido para visualizar o funcionamento real da operação.</p></div><span className="dcDemoTag"><ShieldCheck/> Dados fictícios</span></section>
    <div className="dcKpis"><Kpi icon={Tag} label="Ofertas ativas hoje" value="38"/><Kpi icon={ShieldCheck} label="Solicitações pendentes" value="4"/><Kpi icon={Users} label="Membros ativos" value="1.286"/><Kpi icon={MousePointerClick} label="Cliques hoje" value="3.842"/><Kpi icon={CircleDollarSign} label="Receita hoje" value="R$ 1.896,20"/></div>
    <section className="dcPanel"><div className="dcPanelTitle"><span><h2>Fila de solicitações</h2><small>Revisão manual antes da publicação</small></span><button>Ver todas</button></div><div className="dcQueue">{queue.map((r,i)=><article key={r[0]}><span className="dcLogo">{r[0][0]}</span><div><b>{r[0]}</b><small>{r[1]}</small></div><strong>R$ 49,90</strong><em>{r[2]}</em><span>{r[3]}</span><div className="dcActions"><button className="ok">Aprovar</button><button>Revisar</button><button className="danger">Recusar</button></div></article>)}</div></section>
    <div className="dcSplit"><section className="dcPanel"><div className="dcPanelTitle"><span><h2>Empresas & Prestadores</h2><small>Relacionamento comercial consolidado</small></span></div>{offers.slice(0,5).map((o,i)=><Row key={o.name} icon={o.icon} left={o.name} mid={`${2+i*3} divulgações`} right={`${120+i*47} cliques`}/>)}</section><section className="dcPanel"><div className="dcPanelTitle"><span><h2>Membros</h2><small>HC, XP e ofensiva atual</small></span></div>{members.map(m=><Row key={m[0]} left={m[0]} mid={`${m[1]} · ${m[2]}`} right={m[3]}/>)}</section></div>
  </div></div>
</section>}

function Kpi({icon:Icon,label,value}){return <article className="demoKpi"><Icon/><span><small>{label}</small><b>{value}</b></span></article>}
function Mini({icon:Icon,title,text,foot}){return <article className="dbMini"><Icon/><span><b>{title}</b><strong>{text}</strong><small>{foot}</small></span></article>}
function Row({icon:Icon,left,mid,right}){return <div className="demoRow">{Icon?<span className="rowIcon"><Icon/></span>:null}<span><b>{left}</b><small>{mid}</small></span><em>{right}</em></div>}
