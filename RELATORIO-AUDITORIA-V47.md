# RELATÓRIO DE AUDITORIA — DOOX / HOCCO V47 FINAL

Data: 09/09/2026
Escopo: site, HTML/CSS/JavaScript, API Vercel, Google Apps Script, fluxo de pedido, reserva, pagamento, painel privado, WhatsApp e PWA.

## 1. Resultado executivo

A base V47 foi submetida a uma auditoria estrutural e de consistência. Os erros identificados na rodada anterior foram tratados antes da montagem do pacote final.

Resultado: **aprovada em validações estáticas e de consistência interna; teste E2E com serviços externos permanece não executável neste ambiente**.

Não é declarado “zero falhas em produção” sem execução contra a implantação real do Google Apps Script/Vercel.

## 2. Correções críticas realizadas

### 2.1 Apps Script — concorrência de pagamento

Foi eliminado o risco de aquisição aninhada de `ScriptLock` durante confirmação de pagamento.

- `doPost()` utiliza o lock externo.
- `confirmarPagamento()` é o wrapper com lock para chamadas independentes.
- `confirmarPagamentoCore_()` executa sem adquirir um segundo lock.

### 2.2 Pagamento — coerência de estado

A confirmação financeira agora exige que o pedido esteja em `AGUARDANDO PAGAMENTO`. Isso impede que um registro financeiro seja marcado como pago enquanto o pedido permanece em etapa anterior.

### 2.3 Ações administrativas do Web App

As rotas mutáveis administrativas foram protegidas por `DOOX_OPERATOR_TOKEN` armazenado nas Propriedades do Script:

- `testSpreadsheet`
- `confirmarPagamento`
- `atualizarStatus`
- `publicarObservacao`

As operações públicas necessárias ao cliente permanecem disponíveis:

- `registerRequest`
- `informarPagamento`
- consultas `catalog` e `pedido`

### 2.4 Exposição desnecessária do Spreadsheet ID

O ID da planilha deixou de ser exposto na resposta pública de `health`. A consulta técnica `testSpreadsheet` passou a exigir autenticação operacional.

### 2.5 PIX

O nome usado no payload PIX foi alinhado ao titular informado para o recebimento, em formato compatível com o limite do campo PIX. A interface continua exibindo o nome completo do beneficiário.

### 2.6 Simulação

- duração comercial demonstrativa de aproximadamente 10 segundos;
- personalização por nome/@;
- remoção da linha diagonal sobre a área de empresas;
- nenhuma ação de compra dentro da simulação;
- compra iniciada exclusivamente por `PARTICIPAR DO REALITY`.

### 2.7 Navegação

- apenas um CTA de cabeçalho para `PARTICIPAR DO REALITY`;
- `Ver na simulação` removido de Empresas e Pessoas;
- `PROSSEGUIR COM ESTA PARTICIPAÇÃO` removido;
- ponte de segurança de navegação não duplica listeners.

### 2.8 PWA

A versão anterior referenciava `manifest.webmanifest` e `sw.js` sem conter esses arquivos no pacote. Ambos foram adicionados na V47.

O service worker não intercepta `/api/`, evitando cache de pedidos, disponibilidade e informações privadas.

## 3. Participar do Reality

O cliente consegue escolher:

- modalidade;
- quantidade;
- faixa comercial, nas modalidades aplicáveis;
- seus dados;
- observação;
- aceite de Termos e Regras.

O total é calculado como quantidade × valor unitário.

O navegador não é a autoridade final: o Apps Script valida modalidade, faixa, quantidade, preço e disponibilidade antes de registrar o pedido.

## 4. Disponibilidade e reserva

A reserva ocorre no servidor e utiliza o `ScriptLock` já adquirido pelo `doPost()` durante o registro.

Em falha de gravação do pedido/financeiro, existe rotina de compensação para excluir o pedido parcialmente criado e liberar a capacidade reservada.

## 5. Fluxo de pagamento

Fluxo estabelecido:

`SOLICITADO → EM ANÁLISE → AGUARDANDO PAGAMENTO → PAGAMENTO RECEBIDO`

O cliente pode informar que pagou, mas isso não altera automaticamente para `PAGAMENTO RECEBIDO`.

A confirmação é operacional.

## 6. Painel do cliente

O painel consulta somente pelo token privado do pedido e recebe:

- código;
- modalidade;
- faixa/momento;
- quantidade;
- valor unitário;
- total;
- episódio;
- status;
- observação da produção;
- instruções de materiais;
- dados de pagamento quando disponíveis;
- elegibilidade do comprovante ao final.

## 7. WhatsApp

Número oficial configurado:

**+55 (14) 98115-0675**

A mensagem pós-registro inclui o código, modalidade, quantidade, faixa quando aplicável, valores, checklist, pagamento oficial, acompanhamento e instrução para envio do comprovante.

O WhatsApp é canal de comunicação; o pedido oficial continua registrado no Apps Script/Sheets.

## 8. Estrutura institucional

O site contém versão de leitura rápida e versão completa dos avisos, incluindo:

- identificação do beneficiário;
- instituição financeira;
- regras PIX;
- prevenção contra fraude;
- o que a DOOX nunca solicita;
- aprovação;
- MOMENTO DESEJADO / FAIXA;
- materiais;
- comunicação oficial.

## 9. Validações estáticas realizadas

- HTML com tags `style` balanceadas: 6/6.
- HTML com tags `script` balanceadas: 6/6.
- IDs HTML duplicados: nenhum.
- CTA `data-go="request"`: 1.
- botões `[data-preview]`: 0.
- strings de CTAs antigos: nenhuma ocorrência.
- pseudo-elementos diagonais antigos da linha do rodapé: nenhuma ocorrência.
- funções duplicadas no Apps Script: nenhuma entre as 100 funções detectadas.
- `doGet`: 1.
- `doPost`: 1.
- `registerRequest_`: 1.
- `getPublicOrderStatus_`: 1.
- `confirmarPagamento`: 1.
- `confirmarPagamentoCore_`: 1.
- `atualizarStatusPedido_`: 1.
- `DOOX_onEdit`: 1.
- `getPublicCatalog_`: 1.
- `buildPublicPayment_`: 1.
- `vercel.json`: JSON válido.
- `sw.js`: sintaxe JavaScript válida.
- `api/request.js`: sintaxe JavaScript válida.
- Apps Script: sintaxe JavaScript válida quando avaliado como `.js`.
- referências locais críticas: manifest e service worker presentes no pacote final.

## 10. Auditoria de segurança aplicada

O Web App não deve permitir que uma chamada pública altere arbitrariamente:

- status;
- pagamento confirmado;
- observações internas/ao cliente;
- dados técnicos da planilha.

Essas ações exigem `DOOX_OPERATOR_TOKEN`.

## 11. Teste E2E externo

Não foi possível executar o ciclo contra o endereço externo real do Google Apps Script neste ambiente porque a resolução/acesso externo ao endpoint não esteve disponível. A mesma limitação impede uma confirmação online do deploy Vercel.

Portanto, este relatório distingue deliberadamente:

**VALIDADO:** estrutura, lógica interna, contratos locais, sintaxe, integridade de arquivos e regras críticas.

**PENDENTE DE VALIDAÇÃO NO AMBIENTE PUBLICADO:** pedido real de teste, resposta do Web App, gravação real na planilha, leitura real pelo painel e abertura efetiva do WhatsApp em navegador/dispositivo.

## 12. Procedimento de publicação

1. Substituir o código do Apps Script pelo arquivo V47.
2. Configurar a propriedade `DOOX_OPERATOR_TOKEN` com um token privado de pelo menos 20 caracteres.
3. Implantar/atualizar o Web App do Apps Script.
4. Publicar o conteúdo do pacote na Vercel.
5. Executar um pedido de teste com uma modalidade de baixa quantidade.
6. Confirmar o registro, token, pagamento, alteração de status, observação e finalização no painel.
7. Excluir o pedido de teste e liberar a vaga antes de iniciar a operação real.

## 13. Conclusão

A V47 é a versão de fechamento técnico desta rodada. A estrutura está alinhada ao modelo definido para a DOOX/HOCCO e os principais defeitos encontrados nas auditorias anteriores foram corrigidos.

A única afirmação não feita neste relatório é a de que o ambiente externo já foi validado integralmente, porque esse teste não pôde ser executado aqui.
