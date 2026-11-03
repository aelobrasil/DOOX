import {api,esc} from './config.mjs';
const KEY='hocco-app-push-device-v1',OPT='hocco-app-push-enabled';
const valid=v=>/^[a-f0-9]{64}$/.test(v||'');
export function pushDeviceToken(create=false){try{let key=localStorage.getItem(KEY);if(!valid(key)&&create){key=Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,'0')).join('');localStorage.setItem(KEY,key)}return valid(key)?key:null}catch{return null}}
const supported=()=>typeof Notification!=='undefined'&&'serviceWorker'in navigator&&'PushManager'in window;
const publicBytes=value=>Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));
const setEnabled=value=>{try{localStorage.setItem(OPT,value?'true':'false')}catch{}};
export function notificationRows(items){return items.length?items.map(x=>`<article class="app-notification-item ${x.read_at?'':'is-unread'}"><strong>${esc(x.title)}</strong><p>${esc(x.body)}</p><small>${esc(new Date(x.created_at).toLocaleString('pt-BR'))}</small><button class="btn secondary small" data-notification-read="${esc(x.id)}">${x.read_at?'Voltar ao Reality':'Ler e voltar ao Reality'}</button></article>`).join(''):'<p class="hint">Nenhuma notificação por aqui ainda.</p>'}
export function mountReturnActivity(){
 let last=0,busy=false,composing=false;const root=document.querySelector('#app');
 const configPromise=api('push.config').catch(()=>({enabled:false}));
 const registrationPromise=supported()?navigator.serviceWorker.register('/sw.js').then(()=>navigator.serviceWorker.ready).catch(()=>null):Promise.resolve(null);
 function context(){return{deviceToken:pushDeviceToken(),composing}}
 async function activity(force=false){const token=pushDeviceToken();if(!token||document.hidden||busy||!force&&Date.now()-last<300000)return;busy=true;try{const id=new URL(location.href).searchParams.get('hocco_return');await api('push.activity',{...context(),notificationId:id});last=Date.now()}catch{}finally{busy=false}}
 async function disable(){const token=pushDeviceToken();if(token)await api('push.disable',{deviceToken:token});setEnabled(false);if(supported()){const registration=await registrationPromise;const subscription=await registration?.pushManager.getSubscription();await subscription?.unsubscribe()}}
 async function open(){document.querySelector('dialog.app-notifications')?.remove();const dialog=document.createElement('dialog');dialog.className='app-notifications';dialog.innerHTML='<div class="dialog-head"><div><h2>Notificações do HOCCO</h2><p>O Reality chama você de volta pelo próprio app.</p></div><button class="close" type="button" aria-label="Fechar notificações">×</button></div><p class="hint">Após 48h sem acessar, você pode receber um aviso. Retornar interrompe o ciclo. As três primeiras tentativas têm intervalo de 48h; depois, 14 dias.</p><p data-push-status role="status">Verificando este aparelho…</p><div class="actions"><button class="btn" type="button" data-push-enable disabled>Ativar notificações do app</button><button class="btn secondary" type="button" data-push-disable hidden>Desativar notificações</button></div><p class="hint"><a href="/#privacidade" target="_blank" rel="noopener">Ler Política de Privacidade</a></p><section data-push-inbox aria-label="Suas notificações"></section>';
 document.body.append(dialog);dialog.querySelector('.close').onclick=()=>dialog.close();dialog.addEventListener('close',()=>dialog.remove());dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close()});dialog.showModal();
 const q=s=>dialog.querySelector(s),enable=q('[data-push-enable]'),stop=q('[data-push-disable]'),status=q('[data-push-status]');
 let config,registration,existingSubscription;
 try{[config,registration]=await Promise.all([configPromise,registrationPromise]);if(!dialog.isConnected)return;existingSubscription=await registration?.pushManager.getSubscription();let result={items:[],enabled:false};const token=pushDeviceToken();if(token)result=await api('push.inbox',{deviceToken:token});if(!dialog.isConnected)return;
 q('[data-push-inbox]').innerHTML=notificationRows(result.items||[]);stop.hidden=!result.enabled;enable.hidden=result.enabled&&!result.paused;
 status.textContent=!supported()?'Este navegador não oferece notificações push. No iPhone/iPad, adicione o HOCCO à Tela de Início e abra por lá.':!config.enabled||!registration?'Notificações temporariamente indisponíveis.':Notification.permission==='denied'?'As notificações estão bloqueadas nas configurações deste navegador.':result.enabled&&!result.paused?'Notificações ativadas neste aparelho.':result.paused?'Os envios foram pausados após falhas. Ative novamente para tentar.':'Ative para receber avisos do HOCCO, inclusive quando o app estiver fechado.';
 enable.disabled=!supported()||!config.enabled||!registration||Notification.permission==='denied';
 enable.onclick=async()=>{enable.disabled=true;status.textContent='Aguarde a autorização do aparelho…';try{
 // New subscriptions start directly from this deliberate click. Existing permission permits recovery after cleared storage.
 if(existingSubscription&&!pushDeviceToken()){await existingSubscription.unsubscribe();existingSubscription=null}
 const subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:publicBytes(config.publicKey)});
 const deviceToken=pushDeviceToken(true);if(!deviceToken)throw Error('Não foi possível guardar a autorização neste aparelho.');
 await api('push.subscribe',{deviceToken,subscription:subscription.toJSON(),version:config.version,consent:true,noticeVersion:'2026-11-03.push.v1'});setEnabled(true);last=Date.now();enable.hidden=true;stop.hidden=false;status.textContent='Notificações ativadas neste aparelho.';
 }catch(error){status.textContent=Notification.permission==='denied'?'Você não permitiu notificações. Sua participação continua disponível.':error.message||'Não foi possível ativar as notificações.';enable.disabled=false}};
 stop.onclick=async()=>{stop.disabled=true;try{await disable();stop.hidden=true;enable.hidden=false;enable.disabled=false;status.textContent='Notificações desativadas neste aparelho.'}catch(e){status.textContent=e.message;stop.disabled=false}};
 dialog.querySelectorAll('[data-notification-read]').forEach(button=>button.onclick=async()=>{try{await api('push.read',{deviceToken:pushDeviceToken(),id:button.dataset.notificationRead});dialog.close();location.hash='inicio'}catch(e){status.textContent=e.message}});
 }catch(e){if(dialog.isConnected)status.textContent=e.message}
 }
 function mount(){const header=document.querySelector('body>header');if(header&&!header.querySelector('[data-app-notifications]')){const button=document.createElement('button');button.type='button';button.className='app-notification-bell';button.dataset.appNotifications='';button.setAttribute('aria-label','Notificações do HOCCO');button.title='Notificações do app';button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M9 21h6"/></svg>';button.onclick=open;header.insertBefore(button,header.querySelector('.avatar'))}
 const profile=document.querySelector('.profile-reset');if(profile&&!profile.querySelector('[data-profile-notifications]')){const button=document.createElement('button');button.type='button';button.className='btn secondary full';button.dataset.profileNotifications='';button.textContent='Gerenciar notificações do app';button.onclick=open;profile.append(button)}}
 mount();new MutationObserver(mount).observe(root,{childList:true,subtree:true});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)activity(true)});window.addEventListener('focus',()=>activity());window.addEventListener('hashchange',()=>{composing=/^#(?:enviar|participar)/.test(location.hash);activity(true)});setInterval(()=>activity(),300000);
 document.addEventListener('input',event=>{if(!composing&&event.target.matches?.('#community-message,#message')){composing=true;activity(true)}});
 // A revoked browser permission also disables the server subscription on the next visit.
 if(pushDeviceToken()&&supported()&&Notification.permission==='denied')api('push.disable',{deviceToken:pushDeviceToken()}).catch(()=>{});else activity(true);
}
