import Link from 'next/link';

export const metadata = { title: 'Termos de Uso · HOCCO Hype' };

const H2=({children})=><h2 style={{marginTop:28,fontSize:20}}>{children}</h2>;
export default function TermsPage(){return <main style={{maxWidth:900,margin:'0 auto',padding:'42px 22px 90px',fontFamily:'Arial,Helvetica,sans-serif',color:'#142b49',lineHeight:1.65}}>
  <Link href="/" style={{color:'#075eea',textDecoration:'none',fontWeight:800}}>← Voltar</Link>
  <p style={{fontSize:11,fontWeight:900,letterSpacing:'.12em',color:'#627a99',marginTop:34}}>HOCCO HYPE · TERMOS DE USO · VERSÃO 2.0 · 12/10/2026</p>
  <h1 style={{fontSize:40,letterSpacing:'-.03em'}}>Termos de Uso</h1>
  <p>Estes Termos explicam as condições para usar o HOCCO Hype e participar de Hypes, HC, XP, ofensiva, missões, benefícios, experiências e Impulsões.</p>
  <H2>1. Quem pode usar</H2><p>A versão atual é destinada a pessoas com 18 anos ou mais. A conta é pessoal e deve utilizar informações verdadeiras.</p>
  <H2>2. Hype</H2><p>Hype é uma interação da comunidade. Cada participação válida segue as regras exibidas no aplicativo. Planos comerciais podem ampliar a exposição visual de uma empresa, mas não compram votos, peso, posição ou vitória.</p>
  <H2>3. HC, XP, nível e ofensiva</H2><p>HC e XP são recursos internos de participação. Não são dinheiro, investimento, crédito ou saldo resgatável. As formas de ganhar ou utilizar esses recursos são informadas no aplicativo e nas regras correspondentes.</p>
  <H2>4. Missões e atividades</H2><p>Missões e outras atividades podem conceder progressão quando isso estiver indicado. Ações automatizadas, artificiais ou destinadas a manipular resultados podem ser invalidadas.</p>
  <H2>5. Benefícios</H2><p>Empresas participantes podem oferecer descontos ou outras vantagens. As condições aplicáveis devem ser apresentadas ao usuário, e a empresa ofertante é responsável por cumprir o benefício divulgado.</p>
  <H2>6. Experiências</H2><p>Experiências podem exigir HC, inscrição, confirmação e disponibilidade. Cumprir os requisitos não garante seleção, salvo quando a própria oportunidade disser expressamente o contrário. <Link href="/regras-hc">Ver regras de HC e Experiências.</Link></p>
  <H2>7. Impulsão</H2><p>Impulsão é apoio voluntário à HOCCO. Não é investimento, participação societária ou promessa de retorno financeiro. O pagamento só é considerado confirmado após validação. <Link href="/termos-impulsao">Ver Termos de Impulsão.</Link></p>
  <H2>8. Notificações</H2><p>Notificações são opcionais. O usuário pode permitir, recusar ou revogar a permissão sem perder acesso aos recursos do aplicativo.</p>
  <H2>9. Uso indevido</H2><p>Não é permitido manipular votações, criar contas para fraude, acessar contas de terceiros, fraudar pagamentos ou tentar comprometer o funcionamento da plataforma. Violações podem resultar em invalidação de ações, limitação, suspensão ou encerramento da conta.</p>
  <H2>10. Atualizações do serviço</H2><p>Recursos podem ser atualizados, corrigidos, substituídos ou encerrados. Mudanças relevantes em direitos, obrigações ou tratamento de dados poderão exigir nova ciência ou aceite.</p>
  <H2>11. Exclusão da conta</H2><p>O usuário pode solicitar exclusão. Dados serão eliminados ou anonimizados quando aplicável, ressalvadas hipóteses de conservação necessárias por obrigação legal, segurança, prevenção a fraude ou exercício regular de direitos.</p>
  <H2>12. Privacidade</H2><p>O tratamento de dados pessoais segue a <Link href="/privacidade">Política de Privacidade</Link>.</p>
  <H2>13. Regras complementares</H2><p>As <Link href="/regras-hype">Regras do Hype</Link> e as <Link href="/regras-hc">Regras de HC e Experiências</Link> complementam estes Termos.</p>
  <H2>14. Atendimento</H2><p>Responsável operacional: HOCCO / DOOX Studios. Atendimento pelos canais oficiais disponibilizados na plataforma.</p>
</main>}
