import Link from 'next/link';

export const metadata = { title: 'Termos de Uso · HOCCO Hype' };
const H2=({children})=><h2 style={{marginTop:28,fontSize:20}}>{children}</h2>;

export default function TermsPage(){return <main style={{maxWidth:900,margin:'0 auto',padding:'42px 22px 90px',fontFamily:'Arial,Helvetica,sans-serif',color:'#142b49',lineHeight:1.65}}>
  <Link href="/" style={{color:'#075eea',textDecoration:'none',fontWeight:800}}>← Voltar</Link>
  <p style={{fontSize:11,fontWeight:900,letterSpacing:'.12em',color:'#627a99',marginTop:34}}>HOCCO HYPE · TERMOS DE USO · VERSÃO 2.1 · 13/10/2026</p>
  <h1 style={{fontSize:40,letterSpacing:'-.03em'}}>Termos de Uso</h1>
  <p>Estes Termos explicam as condições para usar o HOCCO Hype e participar de Ofertas do Momento, HC, XP, frequência, ofensiva, missões, Drops, benefícios, experiências e Impulsões.</p>
  <H2>1. Quem pode usar</H2><p>A versão atual é destinada a pessoas com 18 anos ou mais. A conta é pessoal e deve utilizar informações verdadeiras.</p>
  <H2>2. Ofertas do Momento</H2><p>Empresas podem divulgar promoções, serviços ou benefícios por tempo determinado. Ao abrir uma oferta, o membro pode ser direcionado para um canal externo informado pela empresa. A empresa ofertante é responsável pela veracidade, validade, disponibilidade, condições e atendimento relacionados à promoção. A HOCCO fornece o espaço de divulgação e o direcionamento.</p>
  <H2>3. HC, XP, nível, frequência e ofensiva</H2><p>HC e XP são recursos internos de participação. Não são dinheiro, investimento, crédito ou saldo resgatável. Frequência representa constância de participação e ofensiva representa sequência de dias válidos. A quebra da sequência pode reiniciar a ofensiva sem eliminar HC já consolidado. As formas de ganhar ou utilizar esses recursos são mostradas no aplicativo e podem ser atualizadas de forma prospectiva.</p>
  <H2>4. Missões e atividades</H2><p>Missões podem conceder HC, XP ou progressão quando isso estiver indicado. A missão de Ofertas do Momento pode exigir a abertura de ofertas distintas e utiliza mecanismos de deduplicação. Ações automatizadas, repetitivas de forma artificial ou destinadas a manipular recompensas podem ser desconsideradas.</p>
  <H2>5. Drops e oportunidades</H2><p>Drops podem exigir HC, XP, nível, frequência, dias ativos, missões ou combinações desses critérios. Cumprir os requisitos torna o membro elegível quando a oportunidade assim indicar, mas não garante seleção quando houver mais elegíveis do que vagas.</p>
  <H2>6. Rodada HOCCO</H2><p>Quando uma oportunidade tiver mais participantes elegíveis do que vagas, a HOCCO poderá realizar seleção aleatória entre os elegíveis. O sistema pode registrar participantes, ordem da rodada, selecionados e suplentes para preservar a integridade operacional. O método aplicável deve ser informado na oportunidade.</p>
  <H2>7. Benefícios e empresas</H2><p>Empresas participantes podem oferecer descontos, serviços, produtos ou outras vantagens. A empresa ofertante é responsável por cumprir aquilo que divulgou e por informar as condições relevantes. A HOCCO pode revisar, suspender ou remover ofertas incompatíveis com as regras da plataforma.</p>
  <H2>8. Impulsão</H2><p>Impulsão é apoio voluntário à HOCCO. Não é investimento, participação societária ou promessa de retorno financeiro. O pagamento só é considerado confirmado após validação. A Impulsão não compra HC, seleção em Drops ou prioridade. <Link href="/termos-impulsao">Ver Termos de Impulsão.</Link></p>
  <H2>9. Notificações</H2><p>Notificações são opcionais. O usuário pode permitir, recusar ou revogar a permissão sem perder acesso ao aplicativo.</p>
  <H2>10. Uso indevido</H2><p>Não é permitido automatizar interações, criar contas para fraude, acessar contas de terceiros, manipular missões ou seleções, fraudar pagamentos, explorar falhas ou tentar comprometer o funcionamento da plataforma. Violações podem resultar em invalidação de ações, limitação, suspensão ou encerramento da conta.</p>
  <H2>11. Alterações do serviço</H2><p>Recursos podem ser atualizados, corrigidos, substituídos ou encerrados. Mudanças relevantes em direitos, obrigações ou tratamento de dados poderão exigir nova ciência ou aceite.</p>
  <H2>12. Exclusão da conta</H2><p>O usuário pode solicitar exclusão. Dados serão eliminados ou anonimizados quando aplicável, ressalvadas hipóteses de conservação necessárias por obrigação legal, segurança, prevenção a fraude, registros financeiros ou exercício regular de direitos.</p>
  <H2>13. Privacidade</H2><p>O tratamento de dados pessoais segue a <Link href="/privacidade">Política de Privacidade</Link>.</p>
  <H2>14. Regras complementares</H2><p>As <Link href="/regras-hype">Regras de Participação</Link> e as <Link href="/regras-hc">Regras de HC e Experiências</Link> complementam estes Termos quando aplicáveis.</p>
  <H2>15. Atendimento</H2><p>Responsável operacional: HOCCO / DOOX Studios. Atendimento pelos canais oficiais disponibilizados na plataforma.</p>
</main>}
