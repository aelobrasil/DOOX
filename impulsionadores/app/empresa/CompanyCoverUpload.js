'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, ImagePlus } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const MAX_SOURCE_BYTES=8*1024*1024;
const MAX_FINAL_BYTES=700*1024;

async function compressCover(file){
  const bitmap=await createImageBitmap(file);
  const scale=Math.min(1,1200/Math.max(bitmap.width,bitmap.height));
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(bitmap.width*scale));
  canvas.height=Math.max(1,Math.round(bitmap.height*scale));
  const ctx=canvas.getContext('2d');
  ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close?.();
  for(const q of [0.86,0.76,0.66,0.56]){
    const blob=await new Promise((r)=>canvas.toBlob(r,'image/webp',q));
    if(blob&&blob.size<=MAX_FINAL_BYTES)return blob;
  }
  throw new Error('cover_too_large');
}

export default function CompanyCoverUpload(){
  const [user,setUser]=useState(null);
  const [coverUrl,setCoverUrl]=useState('');
  const [busy,setBusy]=useState(false);
  const [msg,setMsg]=useState('');
  const submittedAt=useRef(null);

  useEffect(()=>{supabase.auth.getUser().then(({data})=>{setUser(data.user||null);const saved=sessionStorage.getItem('hocco_empresa_capa');if(saved)setCoverUrl(saved)})},[]);

  useEffect(()=>{
    const bind=()=>{
      const form=document.querySelector('.companyForm');
      if(!form||form.dataset.coverBound==='1')return;
      const fieldsets=[...form.querySelectorAll('fieldset')];
      const mediaField=fieldsets.find((f)=>f.querySelector('legend')?.textContent?.includes('3 · Logo'));
      if(!mediaField)return;
      form.dataset.coverBound='1';
      const legend=mediaField.querySelector('legend');if(legend)legend.textContent='3 · Imagens do card';
      const box=document.createElement('div');box.id='hocco-cover-slot';box.style.marginBottom='14px';mediaField.insertBefore(box,mediaField.children[1]||null);
      form.addEventListener('submit',(e)=>{
        if(!coverUrl){e.preventDefault();e.stopImmediatePropagation();setMsg('Envie a foto de capa antes de continuar.');document.getElementById('hocco-cover-slot')?.scrollIntoView({behavior:'smooth',block:'center'});return;}
        submittedAt.current=Date.now();setTimeout(()=>attachCoverToLatestRequest(),500);
      },true);
    };
    bind();const observer=new MutationObserver(bind);observer.observe(document.body,{childList:true,subtree:true});return()=>observer.disconnect();
  },[coverUrl,user?.id]);

  async function upload(event){
    const file=event.target.files?.[0];if(!file||!user)return;
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>MAX_SOURCE_BYTES)return setMsg('Use JPG, PNG ou WEBP com até 8 MB.');
    setBusy(true);setMsg('Otimizando foto de capa...');
    try{
      const blob=await compressCover(file);const path=`${user.id}/empresa-capa.webp`;
      const {error}=await supabase.storage.from('impulsionadores-avatars').upload(path,blob,{upsert:true,contentType:'image/webp',cacheControl:'31536000'});if(error)throw error;
      const {data}=supabase.storage.from('impulsionadores-avatars').getPublicUrl(path);const url=`${data.publicUrl}?v=${Date.now()}`;
      setCoverUrl(url);sessionStorage.setItem('hocco_empresa_capa',url);setMsg('Foto de capa recebida.');
    }catch(e){console.error(e);setMsg('Não foi possível processar a foto de capa.');}finally{setBusy(false)}
  }

  async function attachCoverToLatestRequest(){
    if(!user||!coverUrl)return;
    for(let i=0;i<12;i+=1){
      const {data}=await supabase.from('hype_solicitacoes').select('id,created_at,capa_url').eq('user_id',user.id).order('created_at',{ascending:false}).limit(1).maybeSingle();
      if(data&&submittedAt.current&&new Date(data.created_at).getTime()>=submittedAt.current-3000){await supabase.from('hype_solicitacoes').update({capa_url:coverUrl,updated_at:new Date().toISOString()}).eq('id',data.id);sessionStorage.removeItem('hocco_empresa_capa');return;}
      await new Promise((r)=>setTimeout(r,650));
    }
  }

  if(typeof document==='undefined')return null;const slot=document.getElementById('hocco-cover-slot');if(!slot)return null;
  return createPortal(<div style={{display:'grid',gap:8}}><label style={{border:'1px dashed #9bb9e9',borderRadius:18,padding:14,display:'grid',gridTemplateColumns:coverUrl?'92px 1fr':'1fr',gap:12,alignItems:'center',background:coverUrl?'#f4f8ff':'#fbfdff',cursor:'pointer'}}><input type="file" accept="image/jpeg,image/png,image/webp" onChange={upload} style={{display:'none'}}/>{coverUrl?<img src={coverUrl} alt="Foto de capa" style={{width:92,height:70,objectFit:'cover',borderRadius:12}}/>:null}<span>{coverUrl?<><CheckCircle2 size={18}/><b style={{display:'block'}}>FOTO DE CAPA RECEBIDA</b><small>Imagem principal do card no Hype.</small></>:<><ImagePlus size={22}/><b style={{display:'block',marginTop:5}}>{busy?'OTIMIZANDO...':'ENVIAR FOTO DE CAPA'}</b><small>Imagem horizontal do estabelecimento, produto ou serviço.</small></>}</span></label>{msg&&<small style={{color:'#31598d',fontWeight:700}}>{msg}</small>}<div style={{fontSize:11,color:'#66778e'}}>Obrigatório: <b>foto de capa + logo/perfil</b>. Não utilizaremos áudio neste fluxo.</div></div>,slot);
}
