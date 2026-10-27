# Cidades e confiabilidade — candidata de 27/10/2026

## Implementação

- Cidade aproximada sugerida a partir dos cabeçalhos Vercel no servidor, sem GPS. Troca manual prevalece; falha de geolocalização não bloqueia a navegação. Não é comprovante de residência.
- Métricas privadas por cidade, com identificador de navegador transformado em hash rotativo diário no servidor. O IP bruto, perfil, conteúdo e links privados não são enviados à tabela de expansão. Filtro básico de robôs, deduplicação por navegador/dia, opção de desativação em Informações, retenção limitada de hashes e agregados.
- Controle administrativo mostra cidades, contagens diárias, situação e alertas. Critério: >=100 visitas deduplicadas em cada um de seis dias completos consecutivos de Brasília. Gera indicação interna; não abre cidade automaticamente nem certifica pessoas únicas. Abertura, análise, observação e pausa ficam na equipe, com auditoria.
- Capacidade de até50 empresas por cidade, compartilhada entre categorias. Pedidos pagos em curadoria reservam vaga; pedidos não pagos reservam48h. Guarda no banco impede ativar excedente no período. Não é reserva por categoria.
- Referência inicial do patrocínio alterada para6990 centavos em novas inscrições; controles existentes continuam podendo mudar esse preço. Pedidos anteriores preservam o valor contratado. Preço conferido novamente antes de criar, com guarda transacional após upload. Cidades de cadastros anteriores permanecem abertas; novas cidades exigem abertura no controle.
- Reconciliação financeira em fila, lotes de até10, autorização de servidor própria, travas com lease e retomada após falha. Consulta ao Mercado Pago não cria cobrança nem substitui verificação de valor, referência, moeda, recebedor e ambiente. Retentativas espaçadas; limite de7dias sinalizado no controle. Agendamento separado após publicação da função. Não recupera automaticamente toda divergência histórica ou reembolso antigo sem webhook.
- Correção de divergência dos termos entre cliente, Edge Function e criação de pedido no banco. Versão nova2026-10-27.v11; compatibilidade de envio de vídeo com a versão pública anterior2026-10-26.v10, registrando a versão efetivamente aceita. Versões antigas incompatíveis recusadas.
- Comunidade/LIVE exigem aceite explícito; consentimento e preço ficam registrados na transação. Mudança de preço ou programação não é aceita silenciosamente.
- Perfil: recuo lateral dos campos, contraste, tamanho e quebras. Aceites, documentos e links com enquadramento responsivo. Links privados preservados.
- Duas artes ilustrativas novas no carrossel, otimizadas em WebP, sem apresentação como registro documental de acontecimentos. Favicon de borboleta azul e laranja sem moldura, com ícones separados de instalação.
- Manifesto próprio para instalação do Controle, com início e escopo /controle/. Autenticação da equipe preservada. Não é outro domínio nem outra base de dados.
- Retorno do checkout consulta novamente o acompanhamento. APIs não entram no cache offline; versão do shell atualizada.

## Verificações antes da publicação

- 174 testes Node passaram.
- 15 verificações de banco no sandbox com transação e rollback: sequência de dias, limiar, deduplicação, acesso, leases, 51ªempresa bloqueada, vaga de outra cidade independente e empresas pagas aguardando curadoria contando na capacidade.
- A auditoria anterior acrescentou52cenários de código e23verificações financeiras em tabelas temporárias. Não representam uma compra no checkout externo de teste.

## Limites mantidos explícitos

Não implementa conta recuperável entre aparelhos, ofensiva centralizada, Realtime privado em todas as telas, IA contextual externa ou certificação de segurança absoluta. Perfil continua local; links privados permitem recuperar pedidos. As métricas são estimativas e podem ser afetadas por VPN, operadoras, limpeza de armazenamento e tráfego automatizado.

O sandbox permanente ainda não tem a estrutura financeira completa da produção para checkout ponta a ponta com vendedor/comprador fictícios. Não anunciar esse teste como realizado. Não foram alterados secrets de pagamento, cobradas compras reais, apagados pedidos ou imagens de empresas. Credencial nova restrita à comunicação interna de métricas/recuperação é independente do Mercado Pago.

## Verificação de implantação

Build de prévia READY. Criação transacional de pedido de vídeo e de Comunidade com aceite atual passou no banco, terminando em ROLLBACK sem registros fictícios persistidos. O teste identificou e corrigiu a conversão do avatar para smallint exigida pelas rotinas existentes. Ajustes de contraste e recuo do perfil conferidos visualmente na prévia de desktop; a sessão não dispõe de emulação móvel para validar visualmente todos os tamanhos. As migrações de cidades foram divididas por etapa de implantação.
