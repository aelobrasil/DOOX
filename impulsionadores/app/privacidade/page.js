import Link from 'next/link';

export const metadata = { title: 'Privacidade e Ciclo de Vida · HOCCO Hype' };

const H2=({children})=><h2 style={{marginTop:28,fontSize:20}}>{children}</h2>;
export default function PrivacyPage(){return <main style={{maxWidth:900,margin:'0 auto',padding:'42px 22px 90px',fontFamily:'Arial,Helvetica,sans-serif',color:'#142b49',lineHeight:1.65}}>
  <Link href="/" style={{color:'#075eea',textDecoration:'none',fontWeight:800}}>← Voltar</Link>
  <p style={{fontSize:11,fontWeight:900,letterSpacing:'.12em',color:'#627a99',marginTop:34}}>HOCCO HYPE · PRIVACIDADE E CICLO DE VIDA · VERSÃO 2.0 · 12/10/2026</p>
  <h1 style={{fontSize:40,letterSpacing:'-.03em'}}>Política de Privacidade e Ciclo de Vida de Dados</h1>
  <p>Esta Política explica como o HOCCO Hype trata dados de membros, empresas e operações, incluindo como informações temporárias são consolidadas, arquivadas ou eliminadas para evitar conservação indefinida.</p>
  <H2>1. Princípios</H2><p>Tratamos somente o que é necessário para operar, proteger, medir e evoluir a plataforma, observando finalidade, necessidade, transparência, segurança e retenção compatível com cada finalidade.</p>
  <H2>2. Dados tratados</H2><p>Podem ser tratados nome, e-mail, telefone, identificadores de conta, avatar, username, perfil, sessões, Hypes, interações, missões, HC, XP, ofensiva, experiências, Impulsões, pagamentos, preferências de notificação, dados empresariais e registros técnicos necessários à segurança e auditoria.</p>
  <H2>3. Finalidades</H2><p>Os dados são usados para criar e autenticar contas, manter progressão, validar Hypes e missões, disponibilizar benefícios e experiências, processar solicitações e pagamentos, prevenir abuso e fraude, produzir relatórios, enviar comunicações autorizadas e solucionar problemas.</p>
  <H2>4. Perfil público</H2><p>A comunidade pode exibir nome público, username, avatar, nível, XP e ofensiva. E-mail, telefone, informações financeiras e notas administrativas não são exibidos publicamente.</p>
  <H2>5. Notificações</H2><p>Web Push depende de autorização do usuário. A assinatura técnica necessária para entrega é armazenada somente após permissão. A recusa não reduz funcionalidades. Assinaturas inválidas podem ser automaticamente desativadas ou removidas.</p>
  <H2>6. Retenção inicial</H2><p>Sessões, telemetria e logs de Push são dados temporários e normalmente permanecem por cerca de 30 a 45 dias. Hypes, interações e missões brutas podem permanecer por cerca de 90 dias quando necessários à validação ou consolidação. Dados de conta permanecem enquanto necessários à relação com o membro. Registros financeiros, jurídicos, antifraude e administrativos seguem prazo compatível com sua finalidade e obrigações aplicáveis.</p>
  <H2>7. Consolidação</H2><p>Eventos antigos podem ser substituídos por métricas agregadas. Antes de remover dados brutos de Hype, o sistema exige a existência do relatório consolidado correspondente. Se a consolidação falhar, os dados brutos permanecem protegidos.</p>
  <H2>8. Capacidade e limpeza automática</H2><p>A infraestrutura monitora o espaço utilizado. A manutenção automática prioriza logs, sessões, tentativas, telemetria, Push antigo e eventos já consolidados. Pressão de armazenamento pode antecipar o descarte de dados temporários elegíveis, mas não autoriza apagar saldos atuais, contas ativas, contratos, pagamentos, relatórios protegidos ou auditoria necessária.</p>
  <H2>9. Arquivos</H2><p>Avatares, logos e imagens ficam armazenados enquanto vinculados a uma conta ou operação válida. Arquivos substituídos, abandonados ou órfãos podem ser eliminados após período de segurança, desde que não exista referência válida no sistema.</p>
  <H2>10. Dados de empresas</H2><p>Solicitações podem incluir CNPJ, razão social, nome fantasia, responsável, contatos, cidade, segmento, materiais, benefício e dados necessários à participação comercial. Dados financeiros e contratuais podem ter retenção maior que telemetria comum.</p>
  <H2>11. Compartilhamento e infraestrutura</H2><p>Podemos utilizar provedores tecnológicos necessários à hospedagem, autenticação, banco de dados, armazenamento e entrega de funcionalidades. A HOCCO não vende dados pessoais de membros.</p>
  <H2>12. Segurança</H2><p>Utilizamos autenticação, controles de acesso, RLS, validações server-side, auditoria e separação entre dados operacionais e administrativos. Nenhum sistema é isento de risco, mas incidentes relevantes serão tratados de acordo com as obrigações aplicáveis.</p>
  <H2>13. Direitos do titular</H2><p>O titular pode solicitar confirmação de tratamento, acesso, correção e, quando aplicável, anonimização, bloqueio ou eliminação. Algumas solicitações podem exigir verificação razoável de identidade.</p>
  <H2>14. Exclusão</H2><p>Na exclusão de conta, dados são classificados entre elimináveis, anonimizáveis e protegidos. Dados protegidos permanecem apenas pelo período necessário à finalidade legítima ou obrigação aplicável.</p>
  <H2>15. Alterações</H2><p>Esta Política pode ser atualizada. Alterações materiais recebem nova versão e podem exigir nova ciência ou aceite.</p>
  <H2>16. Responsável e contato</H2><p>Responsável operacional: HOCCO / DOOX Studios. Solicitações de privacidade devem ser feitas pelos canais oficiais disponibilizados dentro do aplicativo e da área empresarial.</p>
</main>}
