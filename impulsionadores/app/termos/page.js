import Link from 'next/link';

export const metadata = { title: 'Termos de Uso · HOCCO Hype' };

const H2=({children})=><h2 style={{marginTop:28,fontSize:20}}>{children}</h2>;
export default function TermsPage(){return <main style={{maxWidth:900,margin:'0 auto',padding:'42px 22px 90px',fontFamily:'Arial,Helvetica,sans-serif',color:'#142b49',lineHeight:1.65}}>
  <Link href="/" style={{color:'#075eea',textDecoration:'none',fontWeight:800}}>← Voltar</Link>
  <p style={{fontSize:11,fontWeight:900,letterSpacing:'.12em',color:'#627a99',marginTop:34}}>HOCCO HYPE · TERMOS DE USO · VERSÃO 2.0 · 12/10/2026</p>
  <h1 style={{fontSize:40,letterSpacing:'-.03em'}}>Termos de Uso</h1>
  <p>Estes Termos disciplinam o acesso ao HOCCO Hype, incluindo Hype, HC, XP, ofensiva, missões, minigames, Impulsões, benefícios, experiências, interações empresariais e demais recursos do ecossistema.</p>
  <H2>1. Elegibilidade e conta</H2><p>A versão atual é destinada a pessoas com 18 anos ou mais. A conta é pessoal e deve utilizar informações verdadeiras. Contas múltiplas, automatizadas ou criadas para manipular Hypes, HC, ranking, experiências ou benefícios podem ser limitadas, suspensas ou encerradas.</p>
  <H2>2. Hype</H2><p>Hype é uma interação comunitária de apoio ou preferência. Cada Hype válido está sujeito às regras de data, quadro, horário, conta e integridade do sistema. Planos comerciais alteram exposição visual, mas não compram votos, peso, posição ou vitória.</p>
  <H2>3. HC, XP, nível e ofensiva</H2><p>HC e XP são mecanismos internos de participação. Não são moeda, investimento, crédito financeiro, ativo negociável ou saldo resgatável em dinheiro. A ofensiva representa continuidade de atividade segundo as regras vigentes. A recusa de notificações não reduz HC, XP, ofensiva, Hypes, benefícios ou acesso.</p>
  <H2>4. Missões e minigames</H2><p>Missões e minigames podem conceder progressão quando expressamente indicado. A conclusão é validada pelo sistema. Automação, manipulação do navegador ou exploração técnica destinada a simular uma conclusão legítima pode invalidar a ação.</p>
  <H2>5. Benefícios</H2><p>Empresas participantes podem oferecer descontos ou vantagens. A empresa é responsável pela oferta e pelo cumprimento de suas condições. A HOCCO pode intermediar descoberta e acesso, mas não substitui as obrigações legais do fornecedor.</p>
  <H2>6. Experiências</H2><p>Experiências podem exigir HC mínimo, inscrição, confirmação e disponibilidade de vagas. Cumprir o requisito não garante seleção. Regras específicas da oportunidade prevalecem quando apresentadas antes da inscrição. <Link href="/regras-hc">Ver regras de HC e Experiências.</Link></p>
  <H2>7. Impulsão</H2><p>Impulsão é apoio voluntário à HOCCO. Não constitui investimento, participação societária ou promessa de retorno econômico. Pagamentos só são considerados confirmados após validação. Quando houver XP associado, a regra será a informada no app e não cria direito a HC, prioridade ou benefício. <Link href="/termos-impulsao">Ver Termos de Impulsão.</Link></p>
  <H2>8. Notificações</H2><p>Notificações são opcionais. O usuário pode permitir, recusar ou revogar a permissão no navegador ou aparelho sem penalidade. Quando autorizadas, podem tratar de atividade da conta, Hype, ofensiva, experiências, benefícios, pagamentos e comunicações do ecossistema.</p>
  <H2>9. Integridade e condutas proibidas</H2><p>Não é permitido manipular votações, criar contas artificiais, tentar acessar contas de terceiros, fraudar pagamentos, explorar vulnerabilidades ou interferir na infraestrutura. Medidas proporcionais podem incluir invalidação da ação, limitação, suspensão ou encerramento da conta.</p>
  <H2>10. Disponibilidade e evolução</H2><p>A plataforma pode passar por manutenção, correções e atualizações. Recursos podem ser adicionados, alterados ou removidos. Mudanças materiais em direitos, obrigações ou tratamento de dados podem exigir novo aceite.</p>
  <H2>11. Exclusão da conta</H2><p>O usuário pode solicitar exclusão. Dados sem necessidade de conservação serão eliminados ou anonimizados; informações que precisem permanecer por obrigação legal, exercício regular de direitos, segurança, prevenção a fraude ou outra hipótese legítima podem ser conservadas pelo período necessário.</p>
  <H2>12. Privacidade e retenção</H2><p>O tratamento de dados segue a <Link href="/privacidade">Política de Privacidade e Ciclo de Vida de Dados</Link>. Dados temporários não são mantidos indefinidamente e podem ser consolidados ou eliminados conforme a finalidade.</p>
  <H2>13. Regras complementares</H2><p>As <Link href="/regras-hype">Regras do Hype</Link> e as <Link href="/regras-hc">Regras de HC e Experiências</Link> complementam estes Termos.</p>
  <H2>14. Responsável e contato</H2><p>Responsável operacional: HOCCO / DOOX Studios. Os canais oficiais de atendimento e privacidade são os disponibilizados dentro do aplicativo e da área empresarial.</p>
</main>}
