from pathlib import Path
p=Path('impulsionadores/app/components/Minigames.js')
s=p.read_text(encoding='utf-8')
fixes={
"stats={[['Nível',level||'—'],['Meta','6'],['Pontos',result?.score??Math.max(0,(level-1)*100)]}":"stats={[['Nível',level||'—'],['Meta','6'],['Pontos',result?.score??Math.max(0,(level-1)*100)]]}",
"stats={[['Rodada',round?`${round}/5`:'—'],['Acertos',correct],['Pontos',correct*100]}":"stats={[['Rodada',round?`${round}/5`:'—'],['Acertos',correct],['Pontos',correct*100]]}",
}
for old,new in fixes.items():
    if old not in s:
        raise SystemExit('Trecho de sintaxe não encontrado: '+old[:80])
    s=s.replace(old,new,1)
p.write_text(s,encoding='utf-8')
Path(__file__).unlink()
