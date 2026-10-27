const UFS=new Set('AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' '));
let pending;
export function suggestCity(){
 if(pending)return pending;
 pending=(async()=>{
  try{
   const saved=JSON.parse(localStorage.getItem('hocco-city')||'null');
   let token=localStorage.getItem('hocco-geo-browser');
   if(!/^[a-f0-9]{64}$/.test(token||'')){token=Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');localStorage.setItem('hocco-geo-browser',token)}
   const optedOut=localStorage.getItem('hocco-location-metrics')==='off';
   const r=await fetch('/api/location',{method:optedOut?'GET':'POST',headers:{'content-type':'application/json'},...(optedOut?{}:{body:JSON.stringify({browserToken:token})}),signal:AbortSignal.timeout(6000)});
   if(!r.ok)return saved;
   const s=(await r.json()).suggestion;
   // A manual selection always wins, including an explicit all-cities selection.
   if(saved)return saved;
   if(s?.city&&UFS.has(s.uf)){const choice={city:s.city,uf:s.uf,approximate:true};localStorage.setItem('hocco-city',JSON.stringify(choice));return choice}
   return null;
  }catch{return null}
 })();return pending;
}
if(typeof document!=='undefined'&&!location.pathname.startsWith('/controle'))suggestCity();
