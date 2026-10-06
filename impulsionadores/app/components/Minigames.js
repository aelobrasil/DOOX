'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Bolt, Brain, Crosshair, Gamepad2, Hash, Timer, Trophy, X } from 'lucide-react';
import styles from './Minigames.module.css';

export const MINIGAMES = {
  pulso: { name: 'Pulso HOCCO', short: 'Pulso', description: 'Toque no pulso antes que ele mude de posição.', icon: Bolt },
  reflexo: { name: 'Reflexo Azul', short: 'Reflexo', description: 'Espere o sinal e toque o mais rápido possível.', icon: Timer },
  sequencia: { name: 'Sequência HOCCO', short: 'Sequência', description: 'Memorize e repita uma sequência crescente.', icon: Brain },
  mira: { name: 'Mira Hype', short: 'Mira', description: 'Acerte o alvo móvel e mantenha a precisão.', icon: Crosshair },
  codigo: { name: 'Código HOCCO', short: 'Código', description: 'Memorize o código e digite antes da próxima rodada.', icon: Hash },
};

export function MiniGamesModal({ dailyGame = 'pulso', doneToday = false, onFinish, onClose }) {
  const [selected, setSelected] = useState(null);
  const game = selected ? MINIGAMES[selected] : null;
  const finish = async (result) => onFinish?.(selected, result);
  return <div className={styles.backdrop}>
    <section className={styles.modal}>
      <button className={styles.close} onClick={onClose} aria-label="Fechar"><X/></button>
      {!selected ? <>
        <div className={styles.hero}><Gamepad2/><div><small>HOCCO ARCADE</small><h2>Minigames</h2><p>Jogue todos quando quiser. Apenas o jogo marcado como missão do dia rende XP hoje.</p></div></div>
        <div className={styles.grid}>{Object.entries(MINIGAMES).map(([key, info]) => { const Icon=info.icon; const daily=key===dailyGame; return <button key={key} className={`${styles.card} ${daily?styles.daily:''}`} onClick={()=>setSelected(key)}><span className={styles.icon}><Icon/></span><div><b>{info.name}</b><p>{info.description}</p></div>{daily&&<em>{doneToday?'MISSÃO FEITA':'MISSÃO DE HOJE · +5 XP'}</em>}</button> })}</div>
        <div className={styles.note}><Trophy/><span>Os outros jogos servem para recorde e entretenimento. Eles não geram HC e não dão XP extra fora da missão diária.</span></div>
      </> : <>
        <button className={styles.back} onClick={()=>setSelected(null)}><ArrowLeft/> Todos os jogos</button>
        <div className={styles.gameTitle}><game.icon/><div><small>{selected===dailyGame?'MISSÃO DE HOJE':'MINIGAME HOCCO'}</small><h2>{game.name}</h2><p>{game.description}</p></div></div>
        {selected==='pulso'&&<Pulso onFinish={finish}/>} 
        {selected==='reflexo'&&<Reflexo onFinish={finish}/>} 
        {selected==='sequencia'&&<Sequencia onFinish={finish}/>} 
        {selected==='mira'&&<Mira onFinish={finish}/>} 
        {selected==='codigo'&&<Codigo onFinish={finish}/>} 
        <div className={styles.reward}>{selected===dailyGame?(doneToday?'XP da missão diária já foi recebido. Você pode continuar jogando.':'Conclua esta partida para receber +5 XP.'): 'Este jogo não é a missão de hoje. Jogue por diversão e recorde.'}</div>
      </>}
    </section>
  </div>;
}

function Pulso({onFinish}) {
  const [running,setRunning]=useState(false),[seconds,setSeconds]=useState(30),[hits,setHits]=useState(0),[misses,setMisses]=useState(0),[target,setTarget]=useState({x:50,y:50}),[result,setResult]=useState(null);
  const hitsRef=useRef(0),missRef=useRef(0),finishedRef=useRef(false);
  const move=()=>setTarget({x:10+Math.random()*80,y:14+Math.random()*72});
  useEffect(()=>{if(!running)return;if(seconds<=0&&!finishedRef.current){finishedRef.current=true;const total=hitsRef.current+missRef.current;const r={score:hitsRef.current*10,hits:hitsRef.current,misses:missRef.current,accuracy:total?Math.round(hitsRef.current/total*100):0,duration:30};setRunning(false);setResult(r);onFinish(r);return}const id=setTimeout(()=>setSeconds(v=>v-1),1000);return()=>clearTimeout(id)},[running,seconds]);
  useEffect(()=>{if(!running)return;const id=setTimeout(()=>{missRef.current++;setMisses(missRef.current);move()},Math.max(380,850-hits*14));return()=>clearTimeout(id)},[running,target,hits]);
  const start=()=>{hitsRef.current=0;missRef.current=0;finishedRef.current=false;setHits(0);setMisses(0);setSeconds(30);setResult(null);move();setRunning(true)};
  const hit=(e)=>{e.stopPropagation();if(!running)return;hitsRef.current++;setHits(hitsRef.current);navigator.vibrate?.(12);move()};
  const miss=()=>{if(!running)return;missRef.current++;setMisses(missRef.current);move()};
  return <GameFrame stats={[['Tempo',`${seconds}s`],['Acertos',hits],['Erros',misses]]} result={result} onStart={start} running={running} button={result?'Jogar novamente':'Começar'}><div className={styles.stage} onClick={miss}>{running?<button className={styles.pulse} onClick={hit} style={{left:`${target.x}%`,top:`${target.y}%`,width:`${Math.max(44,76-hits)}px`,height:`${Math.max(44,76-hits)}px`}}><Bolt/></button>:<Center result={result} fallback="30 segundos" detail="Cada acerto vale 10 pontos."/>}</div></GameFrame>;
}

function Reflexo({onFinish}) {
  const [round,setRound]=useState(0),[phase,setPhase]=useState('idle'),[times,setTimes]=useState([]),[result,setResult]=useState(null); const readyAt=useRef(0),timer=useRef(null);
  const next=()=>{setPhase('wait');clearTimeout(timer.current);timer.current=setTimeout(()=>{readyAt.current=performance.now();setPhase('go');navigator.vibrate?.(18)},900+Math.random()*1800)};
  const start=()=>{setRound(1);setTimes([]);setResult(null);next()};
  const tap=()=>{if(phase==='wait'){clearTimeout(timer.current);setPhase('early');setTimeout(next,700);return}if(phase!=='go')return;const ms=Math.max(1,Math.round(performance.now()-readyAt.current));const list=[...times,ms];setTimes(list);if(round>=5){const avg=Math.round(list.reduce((a,b)=>a+b,0)/list.length),r={score:Math.max(0,1500-avg),average_ms:avg,best_ms:Math.min(...list),rounds:5};setResult(r);setPhase('done');onFinish(r)}else{setRound(v=>v+1);setTimeout(next,500)}};
  useEffect(()=>()=>clearTimeout(timer.current),[]);
  return <GameFrame stats={[['Rodada',round?`${round}/5`:'—'],['Média',times.length?`${Math.round(times.reduce((a,b)=>a+b,0)/times.length)}ms`:'—'],['Melhor',times.length?`${Math.min(...times)}ms`:'—']]} result={result} onStart={start} running={phase==='wait'||phase==='go'||phase==='early'} button={result?'Jogar novamente':'Começar'}><button className={`${styles.reflexStage} ${styles[phase]||''}`} onClick={tap} disabled={phase==='idle'||phase==='done'}>{phase==='idle'&&'Prepare-se'}{phase==='wait'&&'ESPERE…'}{phase==='go'&&'AGORA!'}{phase==='early'&&'CEDO DEMAIS'}{phase==='done'&&<><strong>{result?.average_ms}ms</strong><span>média de reação</span></>}</button></GameFrame>;
}

function Sequencia({onFinish}) {
  const [sequence,setSequence]=useState([]),[input,setInput]=useState([]),[active,setActive]=useState(null),[phase,setPhase]=useState('idle'),[result,setResult]=useState(null),[level,setLevel]=useState(0); const timers=useRef([]);
  const clear=()=>{timers.current.forEach(clearTimeout);timers.current=[]};
  const flash=(seq)=>{setPhase('show');clear();seq.forEach((cell,i)=>{timers.current.push(setTimeout(()=>setActive(cell),500+i*650));timers.current.push(setTimeout(()=>setActive(null),850+i*650))});timers.current.push(setTimeout(()=>{setInput([]);setPhase('input')},seq.length*650+450))};
  const start=()=>{const seq=[Math.floor(Math.random()*4)];setResult(null);setLevel(1);setSequence(seq);flash(seq)};
  const press=(cell)=>{if(phase!=='input')return;const next=[...input,cell],expected=sequence[next.length-1];setActive(cell);setTimeout(()=>setActive(null),180);if(cell!==expected){const r={score:(level-1)*100,level:level-1,completed:false};setResult(r);setPhase('done');onFinish(r);return}setInput(next);if(next.length===sequence.length){if(level>=6){const r={score:600,level:6,completed:true};setResult(r);setPhase('done');onFinish(r);return}const seq=[...sequence,Math.floor(Math.random()*4)];setLevel(v=>v+1);setSequence(seq);setTimeout(()=>flash(seq),650)}};
  useEffect(()=>()=>clear(),[]);
  return <GameFrame stats={[['Nível',level||'—'],['Meta','6'],['Pontos',result?.score??Math.max(0,(level-1)*100)]} result={result} onStart={start} running={phase==='show'||phase==='input'} button={result?'Jogar novamente':'Começar'}><div className={styles.memoryStage}>{[0,1,2,3].map(i=><button key={i} className={`${styles.memoryCell} ${active===i?styles.lit:''}`} onClick={()=>press(i)} disabled={phase!=='input'}>{i+1}</button>)}{phase==='show'&&<span className={styles.memoryLabel}>MEMORIZE</span>}{phase==='input'&&<span className={styles.memoryLabel}>REPITA</span>}{phase==='idle'&&<span className={styles.memoryLabel}>6 NÍVEIS</span>}{phase==='done'&&<span className={styles.memoryLabel}>NÍVEL {result?.level}</span>}</div></GameFrame>;
}

function Mira({onFinish}) {
  const [running,setRunning]=useState(false),[seconds,setSeconds]=useState(20),[hits,setHits]=useState(0),[misses,setMisses]=useState(0),[target,setTarget]=useState({x:50,y:50}),[result,setResult]=useState(null);const hitRef=useRef(0),missRef=useRef(0),done=useRef(false);const move=()=>setTarget({x:8+Math.random()*84,y:12+Math.random()*76});
  useEffect(()=>{if(!running)return;if(seconds<=0&&!done.current){done.current=true;const total=hitRef.current+missRef.current,r={score:hitRef.current*12, hits:hitRef.current, misses:missRef.current, accuracy:total?Math.round(hitRef.current/total*100):0,duration:20};setResult(r);setRunning(false);onFinish(r);return}const id=setTimeout(()=>setSeconds(v=>v-1),1000);return()=>clearTimeout(id)},[running,seconds]);
  const start=()=>{hitRef.current=0;missRef.current=0;done.current=false;setHits(0);setMisses(0);setSeconds(20);setResult(null);move();setRunning(true)}; const hit=(e)=>{e.stopPropagation();if(!running)return;hitRef.current++;setHits(hitRef.current);navigator.vibrate?.(10);move()};const miss=()=>{if(!running)return;missRef.current++;setMisses(missRef.current)};
  return <GameFrame stats={[['Tempo',`${seconds}s`],['Acertos',hits],['Precisão',hits+misses?`${Math.round(hits/(hits+misses)*100)}%`:'—']]} result={result} onStart={start} running={running} button={result?'Jogar novamente':'Começar'}><div className={styles.stage} onClick={miss}>{running?<button className={styles.crossTarget} onClick={hit} style={{left:`${target.x}%`,top:`${target.y}%`}}><Crosshair/></button>:<Center result={result} fallback="20 segundos" detail="Acerte o máximo de alvos possível."/>}</div></GameFrame>;
}

function Codigo({onFinish}) {
  const [round,setRound]=useState(0),[code,setCode]=useState(''),[input,setInput]=useState(''),[phase,setPhase]=useState('idle'),[correct,setCorrect]=useState(0),[result,setResult]=useState(null);const timer=useRef(null);
  const newCode=()=>String(Math.floor(1000+Math.random()*9000));
  const showRound=(r)=>{const c=newCode();setCode(c);setInput('');setRound(r);setPhase('show');clearTimeout(timer.current);timer.current=setTimeout(()=>setPhase('input'),1800)};
  const start=()=>{setCorrect(0);setResult(null);showRound(1)};
  const press=(d)=>{if(phase!=='input'||input.length>=4)return;const next=input+d;setInput(next);if(next.length===4){const ok=next===code,nextCorrect=correct+(ok?1:0);if(ok)setCorrect(nextCorrect);setPhase(ok?'right':'wrong');if(round>=5){setTimeout(()=>{const r={score:nextCorrect*100,correct:nextCorrect,rounds:5};setResult(r);setPhase('done');onFinish(r)},650)}else setTimeout(()=>showRound(round+1),650)}};
  useEffect(()=>()=>clearTimeout(timer.current),[]);
  return <GameFrame stats={[['Rodada',round?`${round}/5`:'—'],['Acertos',correct],['Pontos',correct*100]} result={result} onStart={start} running={['show','input','right','wrong'].includes(phase)} button={result?'Jogar novamente':'Começar'}><div className={styles.codeStage}><div className={`${styles.codeDisplay} ${phase==='right'?styles.codeRight:''} ${phase==='wrong'?styles.codeWrong:''}`}>{phase==='show'?code:phase==='idle'?'----':phase==='done'?`${result?.score} pts`:(input.padEnd(4,'•'))}</div>{phase==='show'&&<small>MEMORIZE</small>}{phase==='input'&&<small>DIGITE O CÓDIGO</small>}<div className={styles.keypad}>{['1','2','3','4','5','6','7','8','9','0'].map(d=><button key={d} onClick={()=>press(d)} disabled={phase!=='input'}>{d}</button>)}</div></div></GameFrame>;
}

function GameFrame({stats,result,onStart,running,button,children}){return <><div className={styles.stats}>{stats.map(([a,b])=><span key={a}><small>{a}</small><b>{b}</b></span>)}</div>{children}<div className={styles.footer}><span>{result?`Resultado: ${result.score} pontos`:'Complete uma partida para registrar o resultado.'}</span><button onClick={onStart} disabled={running}>{button}</button></div></>}
function Center({result,fallback,detail}){return <div className={styles.center}>{result?<><strong>{result.score}</strong><b>pontos</b><span>{result.accuracy!=null?`${result.accuracy}% de precisão`:detail}</span></>:<><Gamepad2/><b>{fallback}</b><span>{detail}</span></>}</div>}
