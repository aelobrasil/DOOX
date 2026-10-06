from pathlib import Path
p=Path('impulsionadores/app/components/Minigames.js')
s=p.read_text(encoding='utf-8')
old="stats={[['Nível',level||'—'],['Meta','6'],['Pontos',result?.score??Math.max(0,(level-1)*100)]}"
new="stats={[['Nível',level||'—'],['Meta','6'],['Pontos',result?.score??Math.max(0,(level-1)*100)]]}"
if old not in s:
    raise SystemExit('Trecho da Sequência HOCCO não encontrado')
p.write_text(s.replace(old,new,1),encoding='utf-8')
Path(__file__).unlink()
