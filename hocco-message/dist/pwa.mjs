const button=document.querySelector('#install-app');
const help=document.querySelector('#install-help');
let installPrompt=null;
const installed=()=>window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true||localStorage.getItem('hocco-message-installed')==='true';
function update(){if(installed()){button?.remove();help?.remove();return}if(button)button.hidden=false}
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;update()});
window.addEventListener('appinstalled',()=>{localStorage.setItem('hocco-message-installed','true');installPrompt=null;button?.remove()});
button?.addEventListener('click',async()=>{if(installed()){button.remove();return}if(installPrompt){installPrompt.prompt();const choice=await installPrompt.userChoice;if(choice?.outcome==='accepted'){localStorage.setItem('hocco-message-installed','true');button.remove()}installPrompt=null;return}const ios=/iphone|ipad|ipod/i.test(navigator.userAgent);if(help){help.textContent=ios?'No Safari, toque em Compartilhar e escolha “Adicionar à Tela de Início”.':'Abra o menu do navegador e escolha “Instalar Hocco Message” ou “Adicionar à tela inicial”.';help.hidden=false}button.textContent='Como instalar';button.setAttribute('aria-expanded','true')});
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));
update();
