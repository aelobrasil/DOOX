HOCCO API V1 — ponte nova para o Supabase HOCCO

IMPORTANTE
- Não substitui nem altera HTML, CSS, JS ou imagens do site atual.
- As rotas são novas: /api/hocco-v1 e /api/hocco-materials-v1.
- Não usa DOOX_DATABASE_URL.
- Não usa o Supabase antigo.
- Não expõe a secret key no navegador.

1) VERCEL > Settings > Environment Variables
Adicionar:
HOCCO_SUPABASE_URL=https://vebqvedmhfaebvdantiu.supabase.co
HOCCO_SUPABASE_SECRET_KEY=<secret key do projeto HOCCO>
HOCCO_PUBLIC_BASE_URL=<URL pública do site>

Marcar Production. Se você testa Preview, marcar Preview também.
Depois fazer Redeploy.

2) Copiar para o projeto atual, SEM mexer no frontend:
api/hocco-v1.js
api/hocco-materials-v1.js

3) TESTE DE SAÚDE
Abrir:
https://SEU-DOMINIO/api/hocco-v1?action=health
Esperado:
{"ok":true,"service":"HOCCO API V1","configured":true,"database":true,"version":"1.0.0"}

4) CATÁLOGO
Abrir:
https://SEU-DOMINIO/api/hocco-v1?action=catalog
Esperado: ok=true e 13 entradas em catalogo.

5) NÃO TROCAR O FORMULÁRIO AINDA.
Primeiro validamos health e catalog. Depois fazemos um POST controlado em /api/hocco-v1.
Somente após o POST + materiais passarem é que a integração do site atual é cortada para a API HOCCO.
