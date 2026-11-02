# Cadastro empresarial e Pix

Cadastro com três etapas obrigatórias: identificação/responsável, perfil público/imagens/oferta e revisão/aceite. Os campos e autorizações existentes são preservados. Validação por etapa; envio somente após revisão final. CNPJ validado antes de avançar. Layout branco e azul independente do catálogo cinematográfico.

O patrocínio permite gerar QR Code Pix real na página, via /v1/payments do Mercado Pago. Valor, e-mail e CNPJ vêm do pedido privado conferido no servidor, nunca do valor enviado pelo navegador. A referência financeira e o webhook existentes são mantidos. Idempotência estável por pedido, imagem e código retornados pelo provedor; confirmação pelo webhook/reconciliação, nunca pelo retorno ou pelo botão copiar. Cartão e checkout externo continuam disponíveis. CNPJs alfanuméricos ou reservas com menos de 30 minutos seguem pelo checkout externo. Nenhuma chave estática alternativa foi introduzida.

Acompanhamento pendente consulta a cada três segundos, sem sobrepor chamadas e sem descartar o QR enquanto o pagamento não muda de status. Parâmetros anexados ao retorno não contaminam o token privado.

Verificação: testes de regressão, idempotência, preço/referência, dados inválidos, código vencido e renderização do checkout. Sem efetuar pagamento real durante os testes.
