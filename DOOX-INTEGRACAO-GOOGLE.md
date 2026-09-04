# DOOX / HOCCO — integração V9

O site público envia somente 11 campos: name, type, whatsapp, email, profile, modality, moment, quantity, observation, termsAccepted, rulesAccepted.

O proxy Vercel aplica a mesma allowlist antes de chamar o Apps Script. O Apps Script aplica a allowlist novamente e recalcula preço/faixa no servidor.

Campos internos (Código DOOX, ID Cliente, timestamps, status, episódio, pagamento, materiais, programação, publicação e comprovantes) são criados/geridos pelo backend.

Para limpar a planilha existente sem perder histórico, publicar o Apps Script V9 e executar manualmente `migrateToV9()` uma única vez. A função cria um backup do arquivo no Drive, reorganiza os cabeçalhos, preserva os campos que conseguem ser mapeados e remove abas fora da arquitetura oficial.
