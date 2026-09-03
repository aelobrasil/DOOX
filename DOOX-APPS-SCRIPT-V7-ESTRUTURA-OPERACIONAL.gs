/**
 * DOOX / HOCCO — Apps Script V7
 * Backend operacional.
 *
 * Pedido público: DOOX-YY-####, SEM episódio.
 * O episódio é definido posteriormente pela produção.
 * A escrita usa os nomes dos cabeçalhos para evitar desalinhamento.
 */

const CONFIG = {
  SPREADSHEET_ID: '1VWJKfePpzoFpH5h8Iyl58MErLGNjvgGB',
  TZ: 'America/Sao_Paulo',
  SHEETS: {
    PEDIDOS: 'PEDIDOS',
    CLIENTES: 'CLIENTES',
    PAGAMENTOS: 'PAGAMENTOS',
    MATERIAIS: 'MATERIAIS',
    EPISODIOS: 'EPISÓDIOS',
    PROGRAMACAO: 'PROGRAMAÇÃO',
    VEICULACOES: 'VEICULAÇÕES',
    VAGAS: 'VAGAS',
    COMPROVANTES: 'COMPROVANTES',
    DASHBOARD: 'DASHBOARD'
  }
};

function doGet(e) {
  try {
    const action = String(e?.parameter?.action || 'health');
    if (action === 'testSpreadsheet') return out_(testSpreadsheet_());
    return out_({ok:true, service:'DOOX HOCCO', version:'V7', timestamp:new Date().toISOString()});
  } catch(err) {
    return out_({ok:false,error:err.message || String(err)});
  }
}

function doPost(e) {
  try {
    const data = parse_(e);
    const action = String(data.action || 'registerRequest');
    if (action === 'testSpreadsheet') return out_(testSpreadsheet_());
    if (action === 'registerRequest') return out_(registerRequest_(data));
    return out_({ok:false,error:'AÇÃO NÃO RECONHECIDA'});
  } catch(err) {
    return out_({ok:false,error:err.message || String(err)});
  }
}

function registerRequest_(data) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) throw new Error('Sistema ocupado. Tente novamente.');
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    ensureStructure_(ss);

    const r = normalize_(data);
    validate_(r);

    // Nunca aceitar episódio vindo do site.
    r.episode = '';
    r.code = nextCode_(ss);
    r.createdAt = new Date();
    r.status = 'SOLICITADO';

    appendByHeaders_(ss.getSheetByName(CONFIG.SHEETS.PEDIDOS), {
      'Código DOOX':r.code, 'Código':r.code,
      'Data/Hora':r.createdAt, 'Data':r.createdAt, 'Criado em':r.createdAt,
      'Nome':r.name, 'Nome / Empresa':r.name, 'Empresa':r.company,
      'Tipo':r.type, 'E-mail':r.email, 'Email':r.email,
      'WhatsApp':r.phone, 'Telefone':r.phone,
      '@ / Perfil / Site':r.handle, 'Perfil / Site':r.handle,
      'Modalidade':r.mode, 'Inserção':r.mode, 'Momento':r.moment, 'Faixa':r.range,
      'Quantidade':r.quantity, 'Valor Unitário':r.unitPrice,
      'Valor':r.total, 'Valor Total':r.total,
      'Observações':r.observation, 'Observacao':r.observation,
      'Episódio':'', 'EP':'', 'Status':r.status,
      'Termos Aceitos':r.termsAccepted?'SIM':'NÃO',
      'Regras Aceitas':r.rulesAccepted?'SIM':'NÃO',
      'Material':'PENDENTE', 'Origem':r.source
    });

    upsertClient_(ss,r);

    // Controle financeiro inicial. Não significa pagamento recebido.
    upsertPayment_(ss,r);

    SpreadsheetApp.flush();

    return {
      ok:true, registered:true, code:r.code, status:r.status,
      episode:'', paymentStatus:'AGUARDANDO PAGAMENTO',
      message:'Solicitação registrada com sucesso.',
      timestamp:new Date().toISOString()
    };
  } finally {
    lock.releaseLock();
  }
}

function normalize_(d) {
  const mode = normalizeMode_(first_(d,['mode','modality','modalidade','insertion']));
  const range = normalizeRange_(first_(d,['range','requestRange','faixa']));
  let unit = money_(first_(d,['unitPrice','price','valorUnitario','valor']));
  if (!unit) unit = price_(mode,range);

  const qty = Math.max(1, integer_(first_(d,['quantity','qty','reqQty'])) || 1);

  return {
    name:clean_(first_(d,['name','fullName','reqName','nome'])),
    company:clean_(first_(d,['company','empresa','companyName'])),
    type:normalizeType_(first_(d,['type','requestType','tipo'])),
    email:clean_(first_(d,['email','reqEmail'])).toLowerCase(),
    phone:phone_(first_(d,['phone','whatsapp','reqPhone','telefone'])),
    handle:clean_(first_(d,['handle','profile','site','reqHandle','perfil'])),
    mode:mode, moment:clean_(first_(d,['moment','requestMoment','momento'])),
    range:range, quantity:qty, unitPrice:unit,
    total:round_(unit*qty),
    observation:clean_(first_(d,['observation','observations','obs','reqObs'])),
    episode:'',
    termsAccepted:bool_(first_(d,['termsAccepted','acceptTerms','terms'])),
    rulesAccepted:bool_(first_(d,['rulesAccepted','rules','acceptRules'])),
    source:clean_(first_(d,['source','origem'])) || 'SITE'
  };
}

function validate_(r) {
  if (!r.name) throw new Error('Nome ou empresa é obrigatório.');
  if (!r.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email)) throw new Error('E-mail inválido.');
  if (digits_(r.phone).length < 12) throw new Error('WhatsApp inválido.');
  if (!r.mode) throw new Error('Modalidade não informada.');
  if (!r.unitPrice || r.unitPrice <= 0) throw new Error('Valor não pôde ser determinado.');
  if (!r.termsAccepted || !r.rulesAccepted) throw new Error('Termos e Regras precisam ser aceitos.');
}

function price_(mode,range) {
  if (mode==='Presença no Rodapé') return 49.90;
  if (mode==='Apoiador Individual') return 9.90;
  if (mode==='Empresa Patrocinadora do Episódio') return 89.90;
  const a = {'00:30–02:00':39.90,'02:00–04:00':49.90,'04:00–06:30':59.90,'06:30–09:00':69.90,'09:00–11:00':79.90};
  const b = {'00:30–02:00':49.90,'02:00–04:00':59.90,'04:00–06:30':69.90,'06:30–09:00':79.90,'09:00–11:00':89.90};
  if (mode==='Sponsor Overlay') return a[range] || 0;
  if (mode==='Sponsor Overlay + Áudio') return b[range] || 0;
  return 0;
}

function normalizeMode_(v) {
  const x=clean_(v).toLowerCase();
  const m={
    'rodape':'Presença no Rodapé','presenca no rodape':'Presença no Rodapé','presença no rodapé':'Presença no Rodapé',
    'sponsor overlay':'Sponsor Overlay','overlay':'Sponsor Overlay',
    'sponsor overlay + audio':'Sponsor Overlay + Áudio','sponsor overlay + áudio':'Sponsor Overlay + Áudio',
    'overlay + audio':'Sponsor Overlay + Áudio','overlay + áudio':'Sponsor Overlay + Áudio',
    'apoiador individual':'Apoiador Individual',
    'empresa patrocinadora do episodio':'Empresa Patrocinadora do Episódio',
    'empresa patrocinadora do episódio':'Empresa Patrocinadora do Episódio'
  };
  return m[x] || clean_(v);
}

function normalizeRange_(v) {
  const x=clean_(v).replace(/[–—-]/g,'–').replace(/\s+/g,'');
  const m={'00:30–02:00':'00:30–02:00','00:30–2:00':'00:30–02:00',
    '02:00–04:00':'02:00–04:00','04:00–06:30':'04:00–06:30',
    '06:30–09:00':'06:30–09:00','09:00–11:00':'09:00–11:00'};
  return m[x] || clean_(v);
}

function normalizeType_(v) {
  const x=clean_(v).toLowerCase();
  if (['empresa','company','pj'].includes(x)) return 'Empresa';
  if (['pessoa','person','pf'].includes(x)) return 'Pessoa';
  return clean_(v);
}

function nextCode_(ss) {
  const sheet=ss.getSheetByName(CONFIG.SHEETS.PEDIDOS), h=headers_(sheet);
  const i=find_(h,['Código DOOX','Código','Codigo DOOX','Codigo']);
  let max=0;
  if(i>=0 && sheet.getLastRow()>1) {
    sheet.getRange(2,i+1,sheet.getLastRow()-1,1).getDisplayValues().forEach(r=>{
      const m=String(r[0]||'').match(/^DOOX-\d{2}-(\d{4,})$/i);
      if(m) max=Math.max(max,parseInt(m[1],10));
    });
  }
  const yy=Utilities.formatDate(new Date(),CONFIG.TZ,'yy');
  return 'DOOX-'+yy+'-'+pad_(max+1,4);
}

function upsertClient_(ss,r) {
  const sh=ss.getSheetByName(CONFIG.SHEETS.CLIENTES), h=headers_(sh);
  const pi=find_(h,['WhatsApp','Telefone','Celular','Telefone / WhatsApp']);
  const ei=find_(h,['E-mail','Email','E-mail principal']);
  let row=-1;
  if(sh.getLastRow()>1) {
    const all=sh.getDataRange().getDisplayValues();
    for(let n=1;n<all.length;n++) {
      const p=pi>=0?digits_(all[n][pi]):'', e=ei>=0?clean_(all[n][ei]).toLowerCase():'';
      if((p && p===digits_(r.phone)) || (e && e===r.email)){row=n+1;break;}
    }
  }
  const p={'Código DOOX':r.code,'Código':r.code,'Nome':r.name,'Nome / Empresa':r.name,
    'Empresa':r.company,'Tipo':r.type,'E-mail':r.email,'Email':r.email,
    'WhatsApp':r.phone,'Telefone':r.phone,'@ / Perfil / Site':r.handle,
    'Perfil / Site':r.handle,'Status':'ATIVO','Último Pedido':r.createdAt,
    'Última Atualização':r.createdAt};
  row>0 ? updateByHeaders_(sh,row,p) : appendByHeaders_(sh,p);
}

function upsertPayment_(ss,r) {
  const sh=ss.getSheetByName(CONFIG.SHEETS.PAGAMENTOS), h=headers_(sh);
  const ci=find_(h,['Código DOOX','Código','Pedido','Código do Pedido']);
  let row=-1;
  if(ci>=0 && sh.getLastRow()>1) {
    const v=sh.getRange(2,ci+1,sh.getLastRow()-1,1).getDisplayValues();
    for(let i=0;i<v.length;i++) if(clean_(v[i][0])===r.code){row=i+2;break;}
  }
  const p={'Código DOOX':r.code,'Código':r.code,'Pedido':r.code,'Nome':r.name,
    'Empresa':r.company,'Modalidade':r.mode,'Quantidade':r.quantity,
    'Valor Unitário':r.unitPrice,'Valor':r.total,'Valor Total':r.total,
    'Status':'AGUARDANDO PAGAMENTO','Status do Pagamento':'AGUARDANDO PAGAMENTO',
    'Data da Solicitação':r.createdAt,'Data/Hora':r.createdAt,
    'Data do Pagamento':'','Comprovante':'','Observações':''};
  row>0 ? updateByHeaders_(sh,row,p) : appendByHeaders_(sh,p);
}

function ensureStructure_(ss) {
  const s={};
  s[CONFIG.SHEETS.PEDIDOS]=['Código DOOX','Data/Hora','Nome','Empresa','Tipo','E-mail','WhatsApp','@ / Perfil / Site','Modalidade','Momento','Faixa','Quantidade','Valor Unitário','Valor Total','Observações','Episódio','Status','Termos Aceitos','Regras Aceitas','Material','Origem','Criado em'];
  s[CONFIG.SHEETS.CLIENTES]=['Código DOOX','Nome','Empresa','Tipo','E-mail','WhatsApp','@ / Perfil / Site','Status','Último Pedido','Última Atualização'];
  s[CONFIG.SHEETS.PAGAMENTOS]=['Código DOOX','Pedido','Nome','Empresa','Modalidade','Quantidade','Valor Unitário','Valor Total','Status','Data da Solicitação','Data do Pagamento','Comprovante','Observações'];
  s[CONFIG.SHEETS.MATERIAIS]=['Código DOOX','Cliente','Modalidade','Tipo de Material','Status','Canal de Recebimento','Data de Solicitação','Data de Recebimento','Arquivo / Referência','Observações'];
  s[CONFIG.SHEETS.EPISODIOS]=['Episódio','Título','Status','Data Prevista','Data de Publicação','Capacidade Rodapé','Capacidade Patrocinador','Observações'];
  s[CONFIG.SHEETS.PROGRAMACAO]=['Código DOOX','Episódio','Modalidade','Faixa Contratada','Momento Efetivo','Duração','Bloco / Ordem','Status','Observações'];
  s[CONFIG.SHEETS.VEICULACOES]=['Código DOOX','Episódio','Data de Publicação','URL','Momento Efetivo','Status','Evidência','Observações'];
  s[CONFIG.SHEETS.VAGAS]=['Episódio','Modalidade','Capacidade','Reservadas','Disponíveis','Status','Última Atualização'];
  s[CONFIG.SHEETS.COMPROVANTES]=['Código DOOX','Episódio','Cliente','Modalidade','Data de Publicação','URL','Arquivo do Comprovante','Enviado ao Cliente','Data de Envio','Status'];
  s[CONFIG.SHEETS.DASHBOARD]=['Indicador','Valor','Atualizado em'];
  Object.keys(s).forEach(n=>ensureHeaders_(getOrCreate_(ss,n),s[n]));
}

function testSpreadsheet_() {
  const ss=SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  ensureStructure_(ss);
  const sh=ss.getSheetByName(CONFIG.SHEETS.DASHBOARD);
  appendByHeaders_(sh,{'Indicador':'TESTE DE CONEXÃO','Valor':'OK','Atualizado em':new Date()});
  SpreadsheetApp.flush();
  return {ok:true,message:'Google Sheets conectado e estrutura verificada.',spreadsheetName:ss.getName(),timestamp:new Date().toISOString()};
}

function ensureHeaders_(sh,required) {
  const h=headers_(sh);
  if(!h.length){sh.getRange(1,1,1,required.length).setValues([required]);return;}
  const missing=required.filter(x=>find_(h,[x])<0);
  if(missing.length) sh.getRange(1,h.length+1,1,missing.length).setValues([missing]);
}

function appendByHeaders_(sh,p) {
  const h=headers_(sh);
  sh.appendRow(h.map(x=>value_(p,x)));
}

function updateByHeaders_(sh,row,p) {
  const h=headers_(sh);
  h.forEach((x,i)=>{const v=value_(p,x);if(v!==undefined)sh.getRange(row,i+1).setValue(v);});
}

function value_(p,h) {
  if(p[h]!==undefined)return p[h];
  const n=norm_(h);
  for(const k in p) if(norm_(k)===n)return p[k];
  const a={
    codigo:['Código DOOX','Código','Pedido'],datahora:['Data/Hora','Criado em'],
    email:['E-mail','Email'],whatsapp:['WhatsApp','Telefone'],
    perfilsite:['@ / Perfil / Site','Perfil / Site'],modalidade:['Modalidade','Inserção'],
    valor:['Valor Total','Valor'],episodio:['Episódio','EP'],
    status:['Status','Status do Pagamento']
  };
  for(const k of (a[n]||[])) if(p[k]!==undefined)return p[k];
  return undefined;
}

function headers_(sh){return sh.getLastColumn()?sh.getRange(1,1,1,sh.getLastColumn()).getDisplayValues()[0].map(clean_):[];}
function find_(h,c){const x=h.map(norm_);for(const k of c){const i=x.indexOf(norm_(k));if(i>=0)return i;}return -1;}
function norm_(v){return clean_(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');}
function getOrCreate_(ss,n){return ss.getSheetByName(n)||ss.insertSheet(n);}
function first_(o,keys){for(const k of keys)if(o[k]!==undefined&&o[k]!==null)return o[k];return '';}
function clean_(v){return v==null?'':String(v).trim();}
function digits_(v){return clean_(v).replace(/\D/g,'');}
function phone_(v){let d=digits_(v);if(!d)return '';if(d.length===10||d.length===11)d='55'+d;return '+'+d;}
function integer_(v){const n=parseInt(String(v||'').replace(/\D/g,''),10);return isNaN(n)?0:n;}
function money_(v){if(typeof v==='number')return round_(v);let s=clean_(v).replace(/[R$\s]/g,'');if(s.includes(','))s=s.replace(/\./g,'').replace(',','.');const n=Number(s);return isNaN(n)?0:round_(n);}
function round_(v){return Math.round(Number(v)*100)/100;}
function bool_(v){if(v===true)return true;return ['true','1','sim','yes','aceito','aceita'].includes(clean_(v).toLowerCase());}
function pad_(n,s){return String(n).padStart(s,'0');}
function parse_(e){if(!e?.postData?.contents)return e?.parameter||{};try{return JSON.parse(e.postData.contents);}catch(_){return e.parameter||{};}}
function out_(o){return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);}
