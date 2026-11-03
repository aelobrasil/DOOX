export function validateSenderIdentity(input,headers){
 const fullName=String(input.fullName||'').normalize('NFC').trim().replace(/\s+/g,' ');let phone=String(input.phone||'').replace(/\D/g,'');
 if(phone.length===10||phone.length===11)phone='55'+phone;
 if(fullName.length<3||fullName.length>120||!/^\p{L}[\p{L}\p{M} .’'-]+$/u.test(fullName))throw Error('Informe seu nome completo para identificação privada.');
 if(!/^55[1-9][0-9]{9,10}$/.test(phone))throw Error('Informe um telefone brasileiro válido com DDD.');
 const candidate=String(headers.get('x-forwarded-for')?.split(',')[0]||headers.get('x-real-ip')||'').trim();let ip=null;
 if(/^(?:\d{1,3}\.){3}\d{1,3}$/.test(candidate)&&candidate.split('.').every(part=>Number(part)<=255))ip=candidate;
 else if(candidate.includes(':')&&candidate.length<=45){try{const url=new URL('http://['+candidate+']/');if(url.hostname.startsWith('['))ip=candidate}catch{}}
 if(!ip)throw Error('Não foi possível registrar os dados da conexão. Tente novamente.');
 return{fullName,phone,ip};
}
