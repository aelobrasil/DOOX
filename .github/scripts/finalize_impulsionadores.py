from pathlib import Path


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f'Âncora ausente em {label}: {old[:140]}')
    return text.replace(old, new, 1)

p = Path('impulsionadores/app/app/page.js')
s = p.read_text(encoding='utf-8')
s = replace_once(s,
"      loadExperiences(currentUser), loadCommunity(), loadImpulsions(currentUser),\n",
"      loadExperiences(currentUser), loadCommunity(), loadImpulsions(currentUser), loadPwaStatus(currentUser),\n",
'app/page.js')

s = replace_once(s,
"  async function loadImpulsions(currentUser = user) {\n    const { data } = await supabase.from('impulsionadores_impulsoes').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false }).limit(20);\n    setImpulsions(data || []);\n  }\n",
"  async function loadImpulsions(currentUser = user) {\n    const { data } = await supabase.from('impulsionadores_impulsoes').select('id,reference_code,status,created_at').eq('user_id', currentUser.id).order('created_at', { ascending: false }).limit(20);\n    setImpulsions(data || []);\n  }\n  async function loadPwaStatus(currentUser = user) {\n    if (!currentUser) return;\n    const localInstalled = typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true || localStorage.getItem('hocco_app_installed') === '1');\n    const { data } = await supabase.from('impulsionadores_pwa_status').select('installed_at').eq('user_id', currentUser.id).maybeSingle();\n    if (localInstalled || data?.installed_at) {\n      localStorage.setItem('hocco_app_installed', '1');\n      setAppInstalled(true);\n      if (localInstalled && !data?.installed_at) await supabase.from('impulsionadores_pwa_status').insert({ user_id: currentUser.id });\n    }\n  }\n",
'app/page.js')

s = replace_once(s,
"  }, [daily, youtubeVisited, miniGameDone]);\n\n  async function ensureIdentity",
"  }, [daily, youtubeVisited, miniGameDone]);\n\n  useEffect(() => {\n    if (!user || !appInstalled) return;\n    localStorage.setItem('hocco_app_installed', '1');\n    supabase.from('impulsionadores_pwa_status').insert({ user_id: user.id }).then(({ error }) => {\n      if (error && error.code !== '23505') console.warn('PWA status não persistido', error.code);\n    });\n  }, [user?.id, appInstalled]);\n\n  async function ensureIdentity",
'app/page.js')

old = """  async function completeMiniGame(gameKey, result) {
    haptic([20,35,20]);
    await logEvent('minigame_play', 'minigame', gameKey, result);
    if (gameKey !== dailyGame) return showToast(`${MINIGAMES[gameKey]?.name || 'Minigame'} concluído: ${result.score} pontos. Hoje a missão é ${MINIGAMES[dailyGame]?.name || 'outro jogo'}.`);
    if (miniGameDone) return showToast(`Missão diária já concluída. Resultado: ${result.score} pontos.`);
    const { data: awarded, error } = await supabase.rpc('complete_daily_minigame', { p_game_key: gameKey, p_result: result });
    if (error) return showToast('Partida concluída, mas o XP não pôde ser registrado. Tente novamente.');
    setMiniGameDone(true);
    await Promise.all([loadDaily(), loadProfile(), loadCommunity()]);
    showToast(awarded ? `${MINIGAMES[gameKey]?.name}: missão concluída. +5 XP.` : 'Missão diária já estava concluída.');
  }
"""
new = """  async function completeMiniGame(gameKey, result) {
    haptic([20,35,20]);
    await logEvent('minigame_play', 'minigame', gameKey, result);
    if (gameKey !== dailyGame) return showToast(`${MINIGAMES[gameKey]?.name || 'Minigame'} concluído: ${result.score} pontos. Hoje a missão é ${MINIGAMES[dailyGame]?.name || 'outro jogo'}.`);
    if (miniGameDone) return showToast(`Missão diária já concluída. Resultado: ${result.score} pontos.`);
    const { error } = await supabase.from('impulsionadores_missoes_diarias').insert({
      user_id: user.id,
      mission_date: todayBR(),
      mission_key: 'minigame_daily',
      metadata: { game_key: gameKey, result },
    });
    if (error && error.code !== '23505') {
      await loadDaily();
      return showToast('A partida terminou, mas a missão não pôde ser validada. Confira o jogo marcado como missão de hoje e tente novamente.');
    }
    await Promise.all([loadDaily(), loadProfile(), loadCommunity()]);
    setMiniGameDone(true);
    showToast(error?.code === '23505' ? 'Missão diária já estava concluída.' : `${MINIGAMES[gameKey]?.name}: missão concluída. +5 XP.`);
  }
"""
s = replace_once(s, old, new, 'app/page.js')

s = replace_once(s,
"  const totalImpulsed = impulsions.filter((i) => i.status === 'confirmada').reduce((sum, i) => sum + Number(i.amount || 0), 0);\n",
"  const confirmedImpulsions = impulsions.filter((i) => i.status === 'confirmada').length;\n",
'app/page.js')

s = replace_once(s,
'<button className="impulseCTA" onClick={()=>{setActiveImpulse(null);setImpulseOpen(true)}}><HeartHandshake/><div><b>Fazer uma Impulsão</b><span>Apoio voluntário à HOCCO a partir de R$ 3. Não compra HC, Hypes ou prioridade.</span></div><ChevronRight/></button>',
'<button className="impulseCTA" onClick={()=>{setActiveImpulse(null);setImpulseOpen(true)}}><HeartHandshake/><div><b>Fazer uma Impulsão</b><span>Apoio voluntário à HOCCO a partir de R$ 3. Após confirmação, registra +5 XP fixos — o valor não aumenta a recompensa e não compra HC, Hypes ou prioridade.</span></div><ChevronRight/></button>',
'app/page.js')

old_history = """        <section className="impulseHistory"><div className="sectionHead"><div><small>MINHAS IMPULSÕES</small><h2>{brl(totalImpulsed)} confirmados</h2></div><button onClick={()=>{setActiveImpulse(null);setImpulseOpen(true)}}>NOVA IMPULSÃO</button></div>{impulsions.slice(0,6).map((i)=><div className="impulseRow" key={i.id}><span><b>{i.reference_code}</b><small>{new Date(i.created_at).toLocaleDateString('pt-BR')} · {String(i.status).replaceAll('_',' ')}</small></span><strong>{brl(i.amount)}</strong></div>)}{!impulsions.length&&<p>Nenhuma Impulsão registrada ainda.</p>}</section>
"""
new_history = """        <section className="impulseHistory"><div className="sectionHead"><div><small>MINHAS IMPULSÕES</small><h2>{confirmedImpulsions} apoios confirmados</h2></div><button onClick={()=>{setActiveImpulse(null);setImpulseOpen(true)}}>NOVA IMPULSÃO</button></div><p className="fieldHelp">Por privacidade financeira e para evitar associação entre valor e benefício, o histórico do membro não exibe valores. O valor aparece somente durante o pagamento atual.</p>{impulsions.slice(0,6).map((i)=><div className="impulseRow" key={i.id}><span><b>{i.reference_code}</b><small>{new Date(i.created_at).toLocaleDateString('pt-BR')} · {String(i.status).replaceAll('_',' ')}</small></span><strong>APOIO</strong></div>)}{!impulsions.length&&<p>Nenhuma Impulsão registrada ainda.</p>}</section>
"""
s = replace_once(s, old_history, new_history, 'app/page.js')

s = replace_once(s,
'<p>A Impulsão é um apoio voluntário e não compra HC, Hypes, ranking ou prioridade em experiências.</p>',
'<p>A Impulsão é apoio voluntário. Depois da confirmação, registra +5 XP fixos, independentemente do valor. Não compra HC, Hypes, votos nem prioridade em experiências.</p>',
'app/page.js')
p.write_text(s, encoding='utf-8')

t = Path('impulsionadores/app/termos/page.js')
x = t.read_text(encoding='utf-8')
x = replace_once(x,
'<h2>5. Impulsão</h2><p>Impulsão é apoio financeiro voluntário à HOCCO, a partir de R$ 3,00. Não constitui investimento, participação societária, aplicação financeira ou promessa de retorno. Uma Impulsão não compra HC, Hypes, ranking ou prioridade em experiências.</p>',
'<h2>5. Impulsão</h2><p>Impulsão é apoio financeiro voluntário à HOCCO, a partir de R$ 3,00. Não constitui investimento, participação societária, aplicação financeira ou promessa de retorno. Após a confirmação, uma Impulsão pode registrar apenas +5 XP simbólicos e fixos, independentemente do valor apoiado. Esse XP não cria direito a produto, reembolso por expectativa de benefício, HC, Hypes, votos ou prioridade em experiências. O histórico do membro não exibe os valores apoiados; os registros financeiros necessários à operação, conciliação, prevenção a fraude e cumprimento de obrigações podem ser mantidos internamente.</p>',
'termos/page.js')
t.write_text(x, encoding='utf-8')

q = Path('impulsionadores/app/privacidade/page.js')
x = q.read_text(encoding='utf-8')
x = replace_once(x,
'<h2>4. Dados financeiros</h2><p>O aplicativo registra referências, valores e status de pagamento. Com o PIX atual, a confirmação financeira depende de conferência operacional até que exista integração bancária compatível. O aplicativo não exibe informações bancárias privadas além do necessário para pagamento.</p>',
'<h2>4. Dados financeiros</h2><p>O sistema registra internamente referências, valores e status de pagamento para conciliação, suporte, prevenção a fraude e cumprimento de obrigações. Com o PIX atual, a confirmação financeira depende de conferência operacional até que exista integração bancária compatível. Na área do membro, valores anteriores de Impulsões não são exibidos em histórico; o valor é mostrado somente no fluxo do pagamento em andamento.</p>',
'privacidade/page.js')
q.write_text(x, encoding='utf-8')

for f in ['.github/workflows/finalize-impulsionadores-once.yml', '.github/scripts/finalize_impulsionadores.py']:
    path = Path(f)
    if path.exists():
        path.unlink()
