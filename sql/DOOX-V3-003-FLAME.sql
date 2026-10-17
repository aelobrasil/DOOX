-- DOOX V3.3 — FLAME
-- Modalidade audiovisual de 10–15 segundos. Até 4 vagas por episódio.
begin;
insert into doox_v2.modalidades(codigo,nome,descricao,ativo,exige_faixa,exige_logo,exige_audio,exclusivo_pessoa_fisica,capacidade_padrao,quantidade_minima,quantidade_maxima,preco_base,ordem)
values('FLAME','Flame','Microvídeo de 10 a 15 segundos com um recorte real e relevante do dia a dia da empresa.',true,false,true,false,false,4,1,1,139.90,50)
on conflict(codigo) do update set
 nome=excluded.nome,descricao=excluded.descricao,ativo=true,exige_faixa=false,exige_logo=true,exige_audio=false,
 exclusivo_pessoa_fisica=false,capacidade_padrao=4,quantidade_minima=1,quantidade_maxima=1,preco_base=139.90,ordem=50;
commit;
