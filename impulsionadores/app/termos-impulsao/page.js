import Link from 'next/link';

export const metadata={title:'Termos de Impulsão · HOCCO Hype'};
const H2=({children})=><h2 style={{marginTop:28,fontSize:20}}>{children}</h2>;

export default function ImpulseTerms(){return <main style={{maxWidth:880,margin:'0 auto',padding:'42px 22px 90px',fontFamily:'Arial,Helvetica,sans-serif',color:'#142b49',lineHeight:1.65}}>
<Link href="/app" style={{color:'#075eea',textDecoration:'none',fontWeight:800}}>← Voltar ao app</Link>
<p style={{fontSize:11,fontWeight:900,letterSpacing:'.12em',color:'#627a99',marginTop:34}}>HOCCO HYPE · IMPULSÃO · VERSÃO 1.0 · 12/10/2026</p>
<h1 style={{fontSize:40,letterSpacing:'-.03em'}}>Termos de Impulsão</h1>
<p>Impulsão é uma forma voluntária de apoio financeiro à HOCCO disponibilizada dentro do aplicativo.</p>
<H2>1. Natureza</H2><p>Impulsão não é investimento, empréstimo, participação societária, aplicação financeira, aposta ou promessa de retorno econômico.</p>
<H2>2. Valor</H2><p>O valor mínimo vigente é apresentado no fluxo antes do pagamento. O membro escolhe livremente se deseja apoiar e em qual valor permitido pela interface.</p>
<H2>3. Confirmação</H2><p>A indicação “já fiz o PIX” apenas informa a operação. O pagamento é considerado confirmado somente após conferência administrativa ou integração financeira compatível.</p>
<H2>4. XP</H2><p>Quando informado pelo aplicativo, uma Impulsão confirmada pode gerar XP simbólico e fixo. O valor apoiado não aumenta a recompensa, não concede HC, não compra Hypes e não aumenta prioridade em experiências.</p>
<H2>5. Ausência de compra de resultado</H2><p>Impulsionar não compra posição no ranking, resultado do Hype, seleção em experiência, benefício empresarial ou poder de decisão sobre o projeto.</p>
<H2>6. Estorno e inconsistências</H2><p>Erros de pagamento, duplicidades comprovadas ou situações que exijam correção são analisados pelos canais oficiais. Registros financeiros necessários à conciliação, antifraude e obrigações aplicáveis podem permanecer protegidos mesmo após encerramento da conta.</p>
<H2>7. Privacidade</H2><p>Valores, referências e status de pagamento são tratados internamente conforme a <Link href="/privacidade">Política de Privacidade</Link>. A plataforma não precisa exibir publicamente quanto cada membro apoiou.</p>
<H2>8. Aceite</H2><p>Ao iniciar uma Impulsão, o membro utiliza o recurso sob estes Termos e os Termos de Uso gerais do HOCCO Hype.</p>
</main>}
