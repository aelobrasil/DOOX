# Carrossel e interface — atualização

- Imagem de metamorfose em preto e branco adicionada ao carrossel, otimizada em WebP sem substituir os originais.
- Troca em duas etapas: escurecimento da imagem, mudança e retorno suave. Textos e controles permanecem estáveis. Preferência por movimento reduzido respeitada; timers descartados ao sair e ao ocultar a página.
- Botões e ações de navegação com geometria arredondada, foco visível, ícones SVG e tratamento consistente. Links, nomes acessíveis e handlers preservados.
- Ofertas da página inicial exigem cidade e UF, correspondência local e benefício não vazio e vigente. Sem cidade selecionada não há mistura de localidades. O catálogo geral de empresas permanece disponível e os cartões abrem o perfil público da empresa antes da visita externa.
- Detecção de instalação combina evento nativo, contexto standalone, estado salvo, mudança de modo, navegação e API de apps relacionados onde disponível. Não existe detecção universal entre navegadores e plataformas; o código não afirma o contrário. Cliente e Controle mantêm estados de instalação separados.
- Correção de integração: a página das empresas também carrega o manifesto do cliente e a rotina de instalação, para não reapresentar o botão nessa rota.
- Cache do shell atualizado. Sem alteração em banco, preços, pagamentos ou permissões.

Validação local: 186 testes Node passaram, incluindo isolamento das ofertas por cidade e UF, validade pelo horário de Brasília, escurecimento antes da troca e comportamento do botão de instalação. Instalação real em telefone não foi executada nesta sessão; não confundir os testes simulados com verificação em todos os aparelhos.
