# HOCCO / Hype — Governança Operacional V2

Estado aplicado no projeto Supabase em 13/10/2026.

## Princípios

- Supabase é a fonte de verdade para estados, progressão, pagamentos, elegibilidade e histórico.
- Reset de progressão não equivale a exclusão de conta.
- Suspensão bloqueia novas ações e preserva histórico.
- Anonimização remove identidade e acesso, preservando registros operacionais/financeiros necessários.
- Exclusão física de conta só é aceita quando não há histórico que exija preservação.
- Toda ação administrativa sensível exige motivo e é registrada em `hocco_admin_audit`.
- Administradores são protegidos contra exclusão/anônimização pelo fluxo de governança de membros.

## Estado de membro

`impulsionadores_perfis.governance_status`:

- `active`
- `suspended`
- `anonymized`

Campos auxiliares: `governance_reason`, `governance_updated_at`, `suspended_at`, `anonymized_at`.

A função privada `private.is_active_hocco_member(uuid)` é usada pelas políticas/regras de escrita. Membro suspenso não cria Hype, missão, sessão, Impulsão, inscrição/confirmacão de experiência ou Drop, nem atualiza perfil/contato/PWA/push.

## HC e frequência

Regra vigente no banco:

- primeira sessão válida do dia: +1 HC de frequência e +5 XP;
- Hypes válidos: até +2 HC por dia;
- máximo: 3 HC/dia;
- a recompensa diária é idempotente por `hc_diario` / `hc_ledger`.

## Governança administrativa

RPCs principais adicionadas/ajustadas:

- `admin_governance_dashboard()`
- `admin_update_hype_request(...)`
- `admin_update_experience(...)`
- `admin_set_experience_application(...)`
- `create_hype_business_request(...)` com requisito de conta ativa
- helpers de Drop com requisito de conta ativa

Experiências separam:

1. seleção;
2. confirmação (`confirmed_at`);
3. comparecimento (`participou_at`).

Horários editados pelo Control são interpretados em `America/Sao_Paulo` quando o valor chega sem offset explícito.

## Realtime

Realtime é usado como sinal de invalidação; a interface refaz a consulta à fonte de verdade. Tabelas de alto volume (votos/interações Hype) não foram adicionadas à replicação só para atualizar a UI; o Control usa refresh periódico para essas métricas.

## Admin Control

Edge Function versionada em `supabase/functions/admin-control/`.

Versão de produção ao criar este registro: v3.

Principais escopos:

- Marcas Permanentes;
- Hype comercial;
- Oportunidades (Drops, parceiros e experiências);
- progressão dos membros;
- financeiro;
- DOOX;
- auditoria;
- Storage;
- reset operacional completo.

Exclusões em massa são processadas em lotes, eliminando o antigo teto efetivo de 10 mil IDs por operação.

O backend v3 mantém compatibilidade temporária com o nome legado `membros_atividade_all` enquanto o frontend V2 não tiver sido publicado.

## Regras comerciais não alteradas pela governança

A capacidade Hype continua em 10 empresas por quadro e três quadros por dia. Alterar para 10 empresas no dia inteiro é uma decisão comercial separada e não deve ser feita implicitamente por uma migração de governança.

## Segurança conhecida

Continuam existindo avisos anteriores do Security Advisor em estruturas legadas (tabelas RLS sem policies, algumas funções `SECURITY DEFINER` expostas a `authenticated` com validação interna, e proteção contra senhas vazadas desativada). Esses itens não devem ser descritos como resolvidos pela Governança V2.
