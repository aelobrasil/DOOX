'use client';

import {useEffect} from 'react';

const ICONS={
  '\u{1F525}':'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22c4 0 7-2.7 7-6.4 0-3.2-1.8-5.4-4.2-7.6.1 2-1 3.6-2.1 4.3.4-3.9-2.2-6.9-5-9.3.2 3.8-2.7 6-2.7 9.8C5 18 8.1 22 12 22Z"/><path d="M9.8 18.6c-1.1-1.5-.5-3.1.5-4.3.2 1.2.8 2 1.5 2.5.1-1.5.8-2.7 1.8-3.7 1.1 1.4 1.6 2.7 1.4 4-.2 1.7-1.5 2.9-3.1 2.9-.9 0-1.6-.5-2.1-1.4Z"/></svg>',
  '\u{2705}':'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.2 2.2 4.8-5"/></svg>',
  '\u{23F9}\uFE0F':'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
  '\u{1F536}':'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 9 9-9 9-9-9 9-9Z"/></svg>',
  '\u{1F538}':'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 6 6 6-6 6-6-6 6-6Z"/></svg>',
  '\u{26A1}':'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m13 2-8 12h6l-1 8 9-13h-6V2Z"/></svg>',
  '\u{1F381}':'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="8" width="18" height="13" rx="2"/><path d="M12 8v13M3 12h18M7.5 8C5.5 8 5 6.5 5.5 5.3c.6-1.4 2.4-1.6 3.5-.4L12 8M16.5 8c2 0 2.5-1.5 2-2.7-.6-1.4-2.4-1.6-3.5-.4L12 8"/></svg>',
  '\u{1F3C6}':'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4h8v4a4 4 0 0 1-8 0V4Z"/><path d="M8 6H4v1a4 4 0 0 0 4 4M16 6h4v1a4 4 0 0 1-4 4M12 12v5M8 21h8M9 17h6"/></svg>',
  '\u2661':'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z"/></svg>',
  '\u2713':'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>'
};

const TOKENS=Object.keys(ICONS).sort((a,b)=>b.length-a.length);
const RE=new RegExp(`(${TOKENS.map(x=>x.replace(/[.*+?^${}()|[\\]\\]/g,'\\$&')).join('|')})`,'u');
const SKIP=new Set(['SCRIPT','STYLE','TEXTAREA','OPTION']);

function replaceNode(node){
  if(!node?.nodeValue||!RE.test(node.nodeValue))return;
  RE.lastIndex=0;
  const parts=node.nodeValue.split(RE);
  if(parts.length<2)return;
  const frag=document.createDocumentFragment();
  parts.forEach(part=>{
    if(ICONS[part]){
      const span=document.createElement('span');
      span.className='uiSemanticIcon';
      span.setAttribute('aria-hidden','true');
      span.innerHTML=ICONS[part];
      frag.appendChild(span);
    }else if(part){frag.appendChild(document.createTextNode(part));}
  });
  node.parentNode?.replaceChild(frag,node);
}

function scan(root){
  if(!root)return;
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode(node){
    const p=node.parentElement;
    if(!p||SKIP.has(p.tagName)||p.closest('[data-allow-native-emoji="true"]'))return NodeFilter.FILTER_REJECT;
    return RE.test(node.nodeValue||'')?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT;
  }});
  const nodes=[];let n;
  while((n=walker.nextNode()))nodes.push(n);
  nodes.forEach(replaceNode);
}

export default function UiPolish(){
  useEffect(()=>{
    scan(document.body);
    const observer=new MutationObserver(entries=>entries.forEach(entry=>entry.addedNodes.forEach(node=>{
      if(node.nodeType===Node.TEXT_NODE)replaceNode(node);
      else if(node.nodeType===Node.ELEMENT_NODE)scan(node);
    })));
    observer.observe(document.body,{childList:true,subtree:true});
    return()=>observer.disconnect();
  },[]);
  return null;
}
