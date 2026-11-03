(()=>{
 const key='hocco-theme',root=document.documentElement;
 const valid=value=>value==='light'||value==='dark';
 const read=()=>{try{const value=localStorage.getItem(key);return valid(value)?value:'dark'}catch{return 'dark'}};
 const paint=value=>{
  const theme=valid(value)?value:'dark';root.dataset.theme=theme;root.style.colorScheme=theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme==='light'?'#f7f5f1':'#090909');
  const button=document.querySelector('#theme-toggle');if(button){button.textContent=theme==='light'?'☾':'☀';button.setAttribute('aria-label',theme==='light'?'Ativar tema escuro':'Ativar tema claro');button.setAttribute('aria-pressed',String(theme==='light'));button.title=theme==='light'?'Tema claro · mudar para escuro':'Tema escuro · mudar para claro'}
 };
 paint(read());
 const mount=()=>{if(!document.querySelector('#theme-toggle')){const header=document.querySelector('body>header');if(header){const button=document.createElement('button');button.type='button';button.id='theme-toggle';button.className='theme-toggle';button.addEventListener('click',()=>{const next=root.dataset.theme==='light'?'dark':'light';try{localStorage.setItem(key,next)}catch{}paint(next)});const before=header.querySelector('.avatar,#install-app');header.insertBefore(button,before);}}paint(root.dataset.theme)};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
 window.addEventListener('storage',event=>{if(event.key===key||event.key===null)paint(read())});
})();
