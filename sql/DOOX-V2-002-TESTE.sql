-- DOOX V2 — TESTE CONTROLADO
-- Execute SOMENTE depois de DOOX-V2-001-BASE.sql.
-- Cria um pedido de teste idempotente e mostra o resultado.

select doox_v2.criar_pedido(jsonb_build_object(
  'idempotency_key','TESTE-V2-001',
  'tipo_participacao','EMPRESA',
  'modalidade','OVERLAY_AUDIO',
  'faixa','F1',
  'quantidade',1,
  'nome','Teste DOOX V2',
  'empresa','Empresa Teste DOOX V2',
  'whatsapp','14999999999',
  'email','teste-v2@doox.local',
  'perfil','@teste',
  'segmento','TESTE',
  'origem','TESTE_SQL',
  'aceites',jsonb_build_object(
    'termos_uso',true,
    'regras_participacao',true,
    'termo_empresa',true,
    'versao_termos','V2-2026-10-01',
    'versao_regras','V2-2026-10-01',
    'versao_termo_empresa','1.0-2026-09-20',
    'identificacao_assinatura','TESTE SQL'
  )
));

select * from doox_v2.v_pedidos where idempotency_key='TESTE-V2-001';
select * from doox_v2.pagamentos where pedido_id=(select id from doox_v2.pedidos where idempotency_key='TESTE-V2-001');
select * from doox_v2.aceites where pedido_id=(select id from doox_v2.pedidos where idempotency_key='TESTE-V2-001');
select * from doox_v2.historico_status where pedido_id=(select id from doox_v2.pedidos where idempotency_key='TESTE-V2-001') order by criado_em;
