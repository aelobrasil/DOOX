import {api} from './config.mjs';
const KEY='hocco-authorized-return-keys';
function keys(){try{return JSON.parse(localStorage.getItem(KEY)||'[]').filter(x=>/^[a-f0-9]{64}$/.test(x)).slice(-100)}catch{return[]}}
export function rememberReturnPermission(token){if(!/^[a-f0-9]{64}$/.test(token||''))return;try{localStorage.setItem(KEY,JSON.stringify([...new Set([...keys(),token])].slice(-100)))}catch{}}
export const returnConsent=enabled=>enabled?'<label class="check return-consent"><input name="reminderOptIn" type="checkbox"><span>Quero receber mensagens de retorno ao HOCCO no WhatsApp após 48h sem acessar. As três primeiras tentativas têm intervalo de 48h; depois, 14 dias. Posso desativar no meu perfil. Opcional.</span></label>':'';
export function mountReturnActivity(getSavedTokens){
 let last=0,busy=false;
 const tokens=()=>[...new Set([...keys(),...getSavedTokens()])].filter(t=>/^[a-f0-9]{64}$/.test(t)).slice(-100);
 async function activity(){if(document.hidden||busy||Date.now()-last<300000)return;const list=tokens();if(!list.length)return;busy=true;try{await api('customer.activity',{tokens:list});last=Date.now()}catch{}finally{busy=false}}
 document.addEventListener('visibilitychange',activity);window.addEventListener('focus',activity);window.addEventListener('hashchange',activity);setInterval(activity,300000);activity();
 const observer=new MutationObserver(()=>{const profile=document.querySelector('.profile-reset');if(!profile||profile.querySelector('[data-stop-return]')||!tokens().length)return;const button=document.createElement('button');button.type='button';button.className='btn secondary full';button.dataset.stopReturn='';button.textContent='Desativar mensagens de retorno';button.onclick=async()=>{button.disabled=true;try{await api('customer.activity',{tokens:tokens(),disable:true});button.textContent='Mensagens de retorno desativadas';try{localStorage.removeItem(KEY)}catch{}}catch(error){button.textContent=error.message;button.disabled=false}};profile.append(button)});observer.observe(document.querySelector('#app'),{childList:true,subtree:true});
}
