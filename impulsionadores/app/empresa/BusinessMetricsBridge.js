'use client';

import {useEffect,useMemo,useState} from 'react';
import {createPortal} from 'react-dom';
import {BarChart3,Eye,MousePointerClick} from 'lucide-react';
import {supabase} from '../../lib/supabase';
import './business-metrics-bridge.css';

export default function BusinessMetricsBridge(){
  const [target,setTarget]=useState(null);
  const [rows,setRows]=useState([]);

  useEffect(()=>{
    let alive=true;
    const locate=()=>{
      const el=document.querySelector('.businessFinal .bfBottom');
      if(el&&alive)setTarget(el);
    };
    locate();
    const observer=new MutationObserver(locate);
    observer.observe(document.body,{childList:true,subtree:true});
    supabase.auth.getUser().then(({data})=>{
      if(!data.user||!alive)return;
      supabase.rpc('minhas_divulgacoes').then(({data:items})=>{if(alive)setRows(Array.isArray(items)?items:[])});
    });
    return()=>{alive=false;observer.disconnect()};
  },[]);

  const metrics=useMemo(()=>{
    const impressions=rows.reduce((sum,row)=>sum+Number(row.impressoes||0),0);
    const opens=rows.reduce((sum,row)=>sum+Number(row.aberturas||0),0);
    const clicks=rows.reduce((sum,row)=>sum+Number(row.cliques||0),0);
    const openRate=impressions?opens/impressions*100:0;
    const outboundRate=opens?clicks/opens*100:0;
    return {impressions,opens,clicks,openRate,outboundRate};
  },[rows]);

  if(!target||!rows.length)return null;
  return createPortal(<section className="bfFunnel"><h3>Funil das divulgações</h3><div><span><Eye/><b>{metrics.impressions.toLocaleString('pt-BR')}</b><small>Impressões</small></span><span><BarChart3/><b>{metrics.opens.toLocaleString('pt-BR')}</b><small>Aberturas · {metrics.openRate.toLocaleString('pt-BR',{maximumFractionDigits:1})}%</small></span><span><MousePointerClick/><b>{metrics.clicks.toLocaleString('pt-BR')}</b><small>Cliques externos · {metrics.outboundRate.toLocaleString('pt-BR',{maximumFractionDigits:1})}%</small></span></div></section>,target);
}
