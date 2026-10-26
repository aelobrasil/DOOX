# HOCCO — atualização local e laboratório — 26/10/2026

## Entrega
- Cidade/UF obrigatórias em novas inscrições de patrocinadores; pedidos anteriores preservados.
- Localidade, condições e validade das ofertas no perfil público; ofertas com validade vencida deixam de ser anunciadas.
- Filtro manual de cidade/UF combinado com categoria, salvo somente no navegador, sem GPS.
- Contagens agregadas por empresa e dia para visitas ao perfil e cliques, com resumo por cidade/categoria no administrativo. Não equivalem a vendas nem pessoas únicas.
- Programação de assunto atual, título, data/hora de Brasília e capacidade da próxima LIVE.
- Registro da data/título contratados em cada nova mensagem LIVE. Controle concorrente da capacidade no banco; pedidos pendentes também reservam lugar. Sem transferência silenciosa entre datas.
- LIVE sem programação futura ou sem vaga não recebe novos pedidos; checkout de LIVE vencida é bloqueado.
- Lançamento Comunidade R$3,50/4h e LIVE R$5,50/24h, somente para novos pedidos. Patrocínio continua no valor vigente configurado, R$39,90/7 dias na inspeção.
- Controle administrativo acessível somente após autenticação e autorização da equipe.
- Laboratório com dados fictícios no projeto separado hocco-mp-sandbox, função hocco-lab e tabela hm_lab_scenarios. A função recusa qualquer projeto diferente do sandbox. Sessão administrativa validada pela API de produção em chamada somente de autorização.
- Cenários simulados: comunidade, LIVE, vídeo e patrocínio; pagamento, aprovação, repetição, leitura, veiculação e devolução. Utiliza moderação e verificação financeira compartilhadas; não usa o checkout Mercado Pago nem envia notificações reais. Limpeza restrita aos cenários fictícios do administrador.

## Verificação
111 testes Node passaram. SQL transacional com rollback verificou reserva da última vaga LIVE, bloqueio de excedente, snapshot de preço/data, publicação após pagamento, duração24h e cadastro local de patrocinador pendente. Os dados sintéticos desses testes não permaneceram no banco de produção.
As novas tabelas possuem RLS e acesso direto público/autenticado revogado; acesso via funções autenticadas. O laboratório é simulação, não certificação de integração real do Mercado Pago.

## Limites e pendências anteriores
Não implementa nesta entrega identidade persistente dos clientes, recuperação de conta, ofensiva no servidor, Realtime privado, reconciliação financeira independente agendada, IA contextual externa nem preço automático. O erro previamente observado no checkout externo não é considerado resolvido por testes simulados. Mantém capacidade global atual de patrocinadores, sem ativar automaticamente50 vagas por cidade/categoria. Não cria programação fictícia de LIVE: equipe deverá salvar a data e abrir a fila.

Correção de execução: entrypoint Deno do laboratório encaminha apenas a requisição ao handler; teste de regressão cobre os metadados de conexão do runtime.
