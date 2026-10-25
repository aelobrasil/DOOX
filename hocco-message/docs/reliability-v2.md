# HOCCO Message — próxima versão

Base: aad402dd00302d098728b14a500fb4377dbb99cb.
Branch de trabalho: codex/hocco-reliability-v2. Não liberada em produção.

## Implementado nesta primeira etapa
- Patrocínio: importação correta do cartão de pagamento; remoção do PIX legado e dos handlers de confirmação manual obsoletos.
- Bloqueio do sessionStorage não impede abrir pagamento já criado.
- Reset do cliente limpa apenas dados locais; endpoint antigo recusa exclusão de pedidos/auditoria.
- Estados visuais de comunidade/LIVE derivados de fatos retornados pelo servidor: pendente, análise, processamento, publicado, expirado, oculto e devolvido.
- Atualização detecta mudanças nos horários de publicação/expiração e ocultação.
- Testes de execução de patrocínio com API simulada, estados de pagamento e bloqueio de reset.

## Pendências obrigatórias antes da versão completa
- Registro próprio de pagamentos, eventos idempotentes e transações atômicas.
- Reconciliação de pendentes, reembolsos, contestações, valor/moeda/recebedor/ambiente e observabilidade.
- Testar webhook e banco de ponta a ponta em ambiente isolado; nunca simular aprovação na produção.
- Identidade individual persistente, recuperação, RLS e ofensiva calculada no servidor.
- Realtime privado com reconexão, retomada de acompanhamento e fallback.
- Preço configurado no controle com snapshot/expiração do checkout e testes concorrentes.
- Reserva de vagas de patrocinadores, 7 dias a partir da publicação, renovação e retenção de imagens.
- Definir e implementar promessa exata de LIVE: exposição por 24h mais leitura, filas e adiamento.
- Rascunhos e edição segura antes de pagar; idempotência de criação; recuperação de checkout.
- Aplicar confirmação visual também a vídeo e patrocinadores e testar retorno do provedor no navegador.
- Completar gestão, permissões, histórico, ocultação, lixeira e exclusão por tipo de registro.
- Métricas mínimas, transparência e retenção; não coletar digitação ou navegação externa.
- Layout responsivo, acessibilidade, animação reduzida, navegação e instalação PWA.
- Moderação contextual e validação segura de links com limites e revisão de exceções.
- Avisos opt-in, vencimento e relatório com agendamento comprovado.
- Testes reais em navegador móvel/desktop, perda de conexão, retorno e versão instalada anterior.
- Publicação coordenada de backend/frontend, rollback e verificação de produção.

## Limites da verificação atual
Testes locais usam respostas simuladas. Não comprovam aprovação financeira real, execução visual em celular, integridade do banco remoto nem webhook do provedor. Produção não foi alterada por esta etapa.
