import {esc,money,trackExperience} from './config.mjs';
export function mountSponsorWizard(form,price,validCnpj){
 if(!form)return;form.dataset.wizard='true';form.noValidate=true;
 const steps=[['Cadastre sua empresa','Identificação'],['Apresente sua marca','Perfil público'],['Confira antes de enviar','Revisão']];
 const holder=form.closest('.sponsor-form-card'),title=holder.querySelector('.sponsor-form-title h2'),subtitle=holder.querySelector('.sponsor-form-title p'),progress=holder.querySelector('.sponsor-form-progress');
 const panels=steps.map(([label],i)=>{const panel=document.createElement('fieldset');panel.className='sponsor-wizard-step';panel.dataset.step=i;const legend=document.createElement('legend');legend.className='sr-only';legend.textContent=label;panel.append(legend);return panel});
 const move=(name,index)=>{const input=form.elements.namedItem(name),field=input?.closest('.field');if(field)panels[index].append(field)};
 for(const name of ['cnpj','legalName','companyName','category','contactName','email','phone'])move(name,0);
 const uploads=form.querySelector('.sponsor-upload-grid');if(uploads)panels[1].append(uploads);
 for(const name of ['companyDescription','destinationUrl'])move(name,1);
 const location=form.querySelector('.location-filters');if(location)panels[1].append(location);
 for(const name of ['communityOffer','offerConditions','offerExpiresOn'])move(name,1);
 const review=document.createElement('section');review.className='registration-review';panels[2].append(review);
 for(const element of [form.querySelector('.sponsor-notice-options'),form.querySelector('.sponsor-consent')])if(element)panels[2].append(element);
 form.querySelectorAll('.sponsor-field-grid,.registration-section').forEach(el=>el.remove());
 const actions=form.querySelector('.sponsor-form-actions'),submit=form.querySelector('[type=submit]');panels.forEach(panel=>form.insertBefore(panel,actions));
 const navigation=document.createElement('div');navigation.className='wizard-navigation';navigation.innerHTML='<button class="btn secondary" type="button" data-wizard-back>Voltar</button><button class="btn" type="button" data-wizard-next>Continuar</button>';form.insertBefore(navigation,actions);
 const back=navigation.querySelector('[data-wizard-back]'),next=navigation.querySelector('[data-wizard-next]');let step=0;
 const valid=index=>{if(index===0){const cnpj=form.elements.namedItem('cnpj');cnpj.setCustomValidity(validCnpj(cnpj.value)?'':'Confira o CNPJ e seus dígitos verificadores.')}const invalid=[...panels[index].querySelectorAll('input,select,textarea')].find(el=>!el.checkValidity());if(invalid){if(panels[index].hidden)show(index);invalid.reportValidity();invalid.focus();return false}return true};
 const drawReview=()=>{const data=new FormData(form);review.innerHTML='<h3>Prévia do perfil público</h3><div class="wizard-brand-preview"><div class="wizard-cover"></div><div class="wizard-logo"></div><strong>'+esc(data.get('companyName'))+'</strong><p>'+esc(data.get('category'))+' · '+esc(data.get('city'))+' / '+esc(data.get('stateCode'))+'</p></div><dl>'+[['CNPJ','cnpj'],['Razão social','legalName'],['Responsável','contactName'],['E-mail','email'],['WhatsApp','phone'],['Descrição','companyDescription'],['Link público','destinationUrl'],['Oferta','communityOffer'],['Condições','offerConditions'],['Validade','offerExpiresOn']].map(([label,name])=>'<dt>'+label+'</dt><dd>'+esc(data.get(name)||'Não informado')+'</dd>').join('')+'</dl><div class="wizard-price"><strong>Patrocínio de 7 dias · '+money(price)+'</strong><p>Pagamento único. O período começa após pagamento e aprovação. Sem renovação automática.</p></div><button class="btn secondary" type="button" data-wizard-edit>Editar cadastro</button>';
 for(const [name,selector] of [['cover','.wizard-cover'],['logo','.wizard-logo']]){const image=form.querySelector('#'+name+'-preview img');if(image){const copy=image.cloneNode();copy.alt=name==='cover'?'Prévia da capa':'Prévia do logo';review.querySelector(selector).append(copy)}}
 review.querySelector('[data-wizard-edit]').onclick=()=>show(0);trackExperience('company_review')};
 const show=index=>{step=index;panels.forEach((panel,i)=>panel.hidden=i!==step);title.textContent=steps[step][0];subtitle.textContent=(step+1)+' de 3 · '+steps[step][1];progress.innerHTML='<ol class="wizard-progress" aria-label="Etapas do cadastro">'+steps.map(([,label],i)=>'<li '+(i===step?'aria-current="step"':'')+' class="'+(i<=step?'is-active':'')+'"><span>'+(i+1)+'</span><small>'+label+'</small></li>').join('')+'</ol>';back.hidden=step===0;next.hidden=step===2;next.textContent=step===1?'Revisar cadastro':'Continuar';actions.hidden=step!==2;navigation.hidden=step===2;submit.textContent='Confirmar cadastro e ir para pagamento';if(step===2)drawReview();title.tabIndex=-1;title.focus({preventScroll:true});holder.scrollIntoView({block:'start',behavior:'smooth'})};
 back.onclick=()=>show(step-1);next.onclick=()=>{if(valid(step))show(step+1)};
 form.addEventListener('submit',event=>{if(step<2){event.preventDefault();event.stopImmediatePropagation();if(valid(step))show(step+1);return}for(let i=0;i<3;i++){if(!valid(i)){event.preventDefault();event.stopImmediatePropagation();show(i);return}}form.dataset.reviewReady='true'},true);
 show(0);
}
