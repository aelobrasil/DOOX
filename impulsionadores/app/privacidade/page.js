import Link from 'next/link';

export const metadata = { title: 'Política de Privacidade · HOCCO Hype' };

const H2=({children})=><h2 style={{marginTop:28,fontSize:20}}>{children}</h2>;
export default function PrivacyPage(){return <main style={{maxWidth:900,margin:'0 auto',padding:'42px 22px 90px',fontFamily:'Arial,Helvetica,sans-serif',color:'#142b49',lineHeight:1.65}}>
  <Link href="/" style={{color:'#075eea',textDecoration:'none',fontWeight:800}}>← Voltar</Link>
  <p style={{fontSize:11,fontWeight:900,letterSpacing:'.12em',color:'#627a99',marginTop:34}}>HOCCO HYPE · POLÍTICA DE PRIVACIDADE · VERSÃO 2.0 · 12/10/2026</p>
  <h1 style={{fontSize:40,letterSpacing:'-.03em'}}>Política de Privacidade</h1>
  <p>Esta Política explica quais dados o HOCCO Hype pode tratar, para quais finalidades e quais direitos o usuário possui.</p>

  <H2>1. Dados que podemos tratar</H2><p>Podem ser tratados dados de cadastro e contato, informações de perfil, participação no aplicativo, Hypes, HC, XP, ofensiva, missões, experiências, Impulsões, pagamentos, preferências de comunicação, dados empresariais quando aplicável e registros necessários à segurança do serviço.</p>
  <H2>2. Para que usamos os dados</H2><p>Os dados podem ser usados para criar e proteger contas, oferecer recursos do aplicativo, registrar participação, disponibilizar benefícios e experiências, processar solicitações e pagamentos, atender usuários, prevenir abuso ou fraude e cumprir obrigações legais.</p>
  <H2>3. Informações visíveis para outros usuários</H2><p>Quando o recurso exigir, o aplicativo pode exibir informações de perfil como nome público, username, avatar, nível, XP ou ofensiva. E-mail, telefone e informações financeiras não são exibidos publicamente.</p>
  <H2>4. Notificações</H2><p>Notificações dependem de autorização do usuário e podem ser desativadas no navegador ou aparelho. Recusar notificações não reduz os recursos disponíveis na conta.</p>
  <H2>5. Empresas e pagamentos</H2><p>Participações comerciais podem exigir dados da empresa e de seus representantes. Informações relacionadas a pagamentos são tratadas para confirmação, conciliação, atendimento, prevenção a fraude e cumprimento de obrigações aplicáveis.</p>
  <H2>6. Compartilhamento</H2><p>Dados podem ser tratados por fornecedores necessários à operação do serviço, como hospedagem, autenticação, armazenamento, comunicação e processamento técnico. A HOCCO não vende dados pessoais dos membros.</p>
  <H2>7. Conservação</H2><p>Os dados são mantidos pelo tempo necessário às finalidades informadas e às obrigações aplicáveis. Informações que deixarem de ser necessárias podem ser eliminadas ou anonimizadas. Registros financeiros, jurídicos, de segurança ou necessários ao exercício regular de direitos podem permanecer por prazo compatível com sua finalidade.</p>
  <H2>8. Segurança</H2><p>São adotadas medidas técnicas e administrativas para reduzir riscos de acesso indevido, perda, alteração ou uso não autorizado de dados.</p>
  <H2>9. Direitos do titular</H2><p>O titular pode solicitar, quando aplicável, confirmação de tratamento, acesso, correção, anonimização, bloqueio, eliminação e outras providências previstas na legislação. Poderemos solicitar confirmação razoável de identidade antes de atender pedidos sensíveis.</p>
  <H2>10. Exclusão da conta</H2><p>Ao solicitar exclusão, dados serão eliminados ou anonimizados quando aplicável, ressalvadas informações que precisem permanecer por obrigação legal, segurança, prevenção a fraude ou exercício regular de direitos.</p>
  <H2>11. Alterações desta Política</H2><p>Esta Política pode ser atualizada. Mudanças relevantes poderão exigir nova ciência ou aceite.</p>
  <H2>12. Atendimento</H2><p>Responsável operacional: HOCCO / DOOX Studios. Solicitações de privacidade devem ser feitas pelos canais oficiais disponibilizados na plataforma.</p>
</main>}
