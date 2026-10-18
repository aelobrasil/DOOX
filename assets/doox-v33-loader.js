'use strict';
(async()=>{
  const files=[
    '/assets/doox-v33-core.js?v=3.3.1',
    '/assets/doox-v33-visual.js?v=3.3.1',
    '/assets/doox-v33-pages-a.js?v=3.3.1',
    '/assets/doox-v33-pages-b.js?v=3.3.1',
    '/assets/doox-v33-pages-c.js?v=3.3.1',
    '/assets/doox-v33-runtime-a.js?v=3.3.1',
    '/assets/doox-v33-runtime-b.js?v=3.3.1',
    '/assets/doox-v34-patch.js?v=3.4.4'
  ];
  const parts=await Promise.all(files.map(async url=>{
    const response=await fetch(url,{cache:'no-store'});
    if(!response.ok) throw new Error(`Falha ao carregar ${url} (${response.status})`);
    return response.text();
  }));
  const source=parts.join('\n');
  new Function(source)();
})().catch(error=>{
  console.error('DOOX V3.4 loader',error);
  const app=document.getElementById('app');
  if(app) app.innerHTML='<main class="boot"><div class="brand">HOCCO<span>.</span></div><h2>Não foi possível abrir o app.</h2><p>Falha ao carregar a interface. Atualize a página.</p></main>';
});
