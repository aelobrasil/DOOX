# HOCCO Message — fluxo de patrocinadores por cidade (03/11/2026)

## Regras de negócio
- Cadastro disponível em todo o Brasil, sem limite mínimo de audiência/visitas.
- A empresa informa cidade e UF, além de CNPJ e informações de publicação. UF permanece obrigatória **somente no cadastro administrativo/comercial** para evitar confusão entre municípios homônimos.
- A capacidade é de 50 empresas distintas por cidade/UF para a janela de patrocínio. O banco controla o estoque ao aceitar solicitações e novamente na ativação para impedir sobreposição acima de 50.
- O patrocínio tem vigência de sete dias iniciada **após aprovação humana e confirmação válida do pagamento**. Sem aprovação, pagamento confirmado ou vigência, não há publicação.
- Os dados financeiros e históricos não são apagados ao expirar.

## Jornada da empresa
1. **Solicitação** — `/ir-alem/#novo`: identifica empresa, CNPJ, cidade, UF, categoria, descrição, logo/capa, destino, condições e consentimento.
2. **Pedido pendente** — `/ir-alem/#pedido/<codigo>/<token>`: acompanha o cadastro em análise. O link contém token privado e não deve ser compartilhado.
3. **Controle de equipe** — `/controle/`: revisão manual de identidade, conteúdo e materiais. Rejeição não publica.
4. **Checkout** — apenas após aprovação da curadoria. Pagamento por provedor; webhook validado no servidor; nunca confiar em retorno de navegador.
5. **Ativação** — trigger `hm_prepare_sponsor_activation` define `starts_at` e `expires_at` com sete dias. Regra `hm_guard_city_sponsor_activation` previne exceder 50 empresas simultâneas por cidade/UF.
6. **Vitrines** — API `sponsor.catalog` retorna exclusivamente registros `approved + confirmed + not held + not archived + within time window`. O visitante vê as empresas na página inicial HOCCO (seção Empresas e ofertas pelo Brasil), em `/ir-alem/` (seção **Sua cidade está na HOCCO**) e no perfil `/ir-alem/#empresa/<id>`.
7. **Descoberta por cidade** — visitante digita **somente cidade**; sem seletor obrigatório de UF. Cidades homônimas aparecem agrupadas pelo nome, mas cada cartão indica a UF; filtro por categoria é opcional. Botão Todo o Brasil limpa o filtro.
8. **Fim de vigência** — API remove a empresa automaticamente dos resultados por hora de expiração; renovação inicia nova janela conforme regras existentes.

## Separação entre patrocínio e benefício
- Uma empresa com patrocínio ativo aparece mesmo sem oferta promocional.
- Uma promoção vencida não aparece no cartão, sem retirar a empresa durante a vigência contratada.

## Testes
- `npm test` via GitHub Actions; `tests/nationwide-launch.test.mjs` verifica descoberta nacional, cidade sem UF e homônimos.
- SQL readonly testa condições de elegibilidade no Supabase.
- Homologação visual no navegador e um fluxo empresarial ponta a ponta seguem necessários antes de promover a produção.

## Segurança
- Não criar pagamento artificial na produção nem forçar registro pendente a `confirmed`.
- Não publicar patrocínio arquivado, vencido, reembolsado ou com bloqueio financeiro.
