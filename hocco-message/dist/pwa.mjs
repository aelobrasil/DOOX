const control=location.pathname.startsWith('/controle');
const installStorageKey=control?'hocco-control-installed':'hocco-message-installed';
const media=window.matchMedia('(display-mode: standalone)');
let installPrompt=null,detected=false;
const rememberedInstall=()=>{try{return localStorage.getItem(installStorageKey)==='true'}catch{return false}};
const rememberInstall=()=>{detected=true;try{localStorage.setItem(installStorageKey,'true')}catch{}};
const installed=()=>detected||media.matches||window.navigator.standalone===true||rememberedInstall();
function update(){
 if(media.matches||window.navigator.standalone===true)rememberInstall();
 if(installed()){document.querySelectorAll('#install-app,#install-help').forEach(el=>el.remove());return}
 const button=document.querySelector('#install-app');if(button)button.hidden=false;
}
async function checkRelated(){
 update();if(installed()||typeof navigator.getInstalledRelatedApps!=='function')return;
 try{
  const apps=await navigator.getInstalledRelatedApps(),path=control?'/controle/manifest.webmanifest':'/manifest.webmanifest',id=new URL(control?'/controle/':'/',location.origin).href;
  if(apps.some(app=>{try{return app.platform==='webapp'&&(new URL(app.id||'invalid',location.origin).href===id||new URL(app.url||'invalid',location.origin).pathname===path)}catch{return false}})){rememberInstall();update()}
 }catch{}
}
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();if(installed())return;installPrompt=event;update()});
window.addEventListener('appinstalled',()=>{rememberInstall();installPrompt=null;update()});
window.addEventListener('storage',event=>{if(event.key===installStorageKey||event.key===null)update()});
window.addEventListener('pageshow',checkRelated);
media.addEventListener?.('change',update);
document.addEventListener('click',async event=>{
 const button=event.target.closest?.('#install-app');if(!button)return;
 if(installed()){update();return}
 if(installPrompt){try{await installPrompt.prompt();const choice=await installPrompt.userChoice;if(choice?.outcome==='accepted'){rememberInstall();update()}}catch{button.textContent='Tentar instalar'}finally{installPrompt=null}return}
 const help=document.querySelector('#install-help'),ios=/iphone|ipad|ipod/i.test(navigator.userAgent);
 if(help){help.textContent=ios?'No Safari, toque em Compartilhar e escolha “Adicionar à Tela de Início”.':'Abra o menu do navegador e escolha “Instalar '+(control?'HOCCO Controle':'HOCCO Message')+'” ou “Adicionar à tela inicial”.';help.hidden=false}
 button.textContent='Como instalar';button.setAttribute('aria-expanded','true');
});
new MutationObserver(()=>{if(installed())update()}).observe(document.body,{childList:true,subtree:true});
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));
checkRelated();
