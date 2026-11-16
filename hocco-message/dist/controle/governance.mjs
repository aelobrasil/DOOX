import {esc,money} from '../config.mjs';

const sections=[
 ['Preços','Mensagem no vídeo · Comunidade · LIVE · Patrocínio · Reality','general'],
 ['Mensagens','Curadoria · edição · publicação · rejeição · devolução','purchases'],
 ['Comunidade e LIVE','Aprovação · edição · ocultação · restauração · leitura','community'],
 ['Patrocinadores','Cadastro · curadoria · preço · vagas · período · devolução','sponsors'],
 ['Conteúdo','Episódio · vídeo · LIVE · programação','content'],
 ['Notificações','Comunicados · público · prévia · fila · cancelamento','notifications'],
 ['Financeiro','Pagamentos · reconciliação · divergências · devoluções','finance'],
 ['Dados','Retenção · limpeza · registros protegidos · armazenamento','data'],
 ['Segurança','Equipe · remetentes · evidências · auditoria','senders'],
 ['Cidades','Mercados · disponibilidade · ofertas regionais','cities'],
 ['Sistema','Filas · reprocessamento · integrações · falhas','administrative']
];

const risk=(label,cls)=>'<span class="badge '+cls+'">'+label+'</span>';

export function mountGovernance(host,call,data,navigate){
 let disposed=false;
 host.innerHTML='<section><div class="control-page-head"><div><div class="eyebrow">HOCCO CONTROL · governança</div><h1>Governação central</h1><p>Uma única visão para administrar o comportamento do aplicativo. As áreas abaixo apontam para os controles que executam a mudança no servidor.</p></div><div class="actions"><button class="btn secondary" data-gov-refresh>Atualizar diagnóstico</button></div></div>'+
 '<section class="paper"><h2>Princípio de controle</h2><p class="hint">Toda mudança operacional deve seguir quatro etapas: <strong>validar → executar → registrar → verificar</strong>. Preços novos não alteram pedidos já criados; pagamentos, segurança e auditoria permanecem protegidos.</p>'+
 '<div class="metrics"><div class="metric"><b>'+((data.orders||[]).filter(x=>x.review==='pending'&&x.payment==='confirmed'&&!x.payment_hold).length)+'</b><span>Mensagens aguardando curadoria</span></div><div class="metric"><b>'+((data.sponsors||[]).filter(x=>x.review==='pending'&&!x.payment_hold).length)+'</b><span>Patrocinadores em análise</span></div><div class="metric"><b>'+money((data.payments||[]).filter(x=>x.provider_status==='approved').reduce((n,x)=>n+Number(x.amount_cents||0),0))+'</b><span>Pagamentos confirmados no recorte</span></div><div class="metric"><b>'+((data.audit||[]).length)+'</b><span>Eventos de auditoria carregados</span></div></div></section>'+
 '<div class="governance-grid">'+sections.map(([title,desc,route])=>'<button class="management-card governance-card" data-gov-route="'+route+'"><strong>'+esc(title)+'</strong><span>'+esc(desc)+'</span><b aria-hidden="true">→</b></button>').join('')+'</div>'+
 '<section class="paper" style="margin-top:18px"><h2>Proteções que não podem ser contornadas pelo painel</h2><div class="governance-protections">'+
 '<div><strong>Financeiro</strong><span>Pagamento confirmado, histórico financeiro e reconciliação não entram em limpeza administrativa genérica.</span>'+risk('PROTEGIDO','success')+'</div>'+
 '<div><strong>Segurança</strong><span>Dados sensíveis de remetentes e evidências exigem acesso registrado e finalidade administrativa.</span>'+risk('ACESSO CONTROLADO','orange')+'</div>'+
 '<div><strong>Auditoria</strong><span>Alterações administrativas devem permanecer rastreáveis para reconstruir quem fez o quê e quando.</span>'+risk('RASTREÁVEL','success')+'</div>'+
 '<div><strong>Pedidos existentes</strong><span>Alterar preço ou disponibilidade afeta novas operações; condições já aceitas permanecem registradas.</span>'+risk('PRESERVADO','success')+'</div>'+
 '<div><strong>Exclusão</strong><span>“Lixeira” significa arquivamento recuperável. Exclusão física somente para registros explicitamente elegíveis pela política.</span>'+risk('AÇÃO CRÍTICA','orange')+'</div>'+
 '<div><strong>Servidor</strong><span>Esconder um botão não é segurança. As permissões são verificadas no backend antes da operação.</span>'+risk('BACKEND','success')+'</div>'+
 '</div></section>'+
 '<section class="paper" style="margin-top:18px"><h2>Como cada alteração deve aparecer</h2><ol class="governance-flow"><li><strong>Antes</strong><span>valor atual, alvo, impacto e risco.</span></li><li><strong>Confirmação</strong><span>ação crítica exige confirmação explícita.</span></li><li><strong>Execução</strong><span>servidor valida permissão e regra de negócio.</span></li><li><strong>Registro</strong><span>ação, ator, horário, objeto e resultado.</span></li><li><strong>Verificação</strong><span>controle atualiza o estado e informa sucesso ou bloqueio.</span></li></ol></section>'+
 '<section class="paper" style="margin-top:18px"><h2>Mapa operacional</h2><p class="hint">O CONTROL não precisa concentrar todos os campos numa única tela. Ele precisa concentrar a <strong>governança</strong>: cada domínio tem seu editor especializado, com a mesma autoridade, auditoria e proteção.</p><div class="actions"><button class="btn purple" data-gov-route="general">Abrir preços e disponibilidade</button><button class="btn secondary" data-gov-route="purchases">Abrir mensagens</button><button class="btn secondary" data-gov-route="sponsors">Abrir patrocinadores</button><button class="btn secondary" data-gov-route="data">Abrir dados e limpeza</button></div></section>'+
 '<div class="hint" style="margin-top:16px">Última leitura do painel: '+new Date().toLocaleString('pt-BR')+'.</div></section>';
 host.querySelector('[data-gov-refresh]').onclick=()=>navigate('governance');
 host.querySelectorAll('[data-gov-route]').forEach(b=>b.onclick=()=>navigate(b.dataset.govRoute));
 return ()=>{disposed=true;if(disposed)host.replaceChildren()};
}
