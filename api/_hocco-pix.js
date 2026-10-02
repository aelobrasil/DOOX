const PIX_KEY='c9316176-6f92-413e-9209-63ae6f661ba9';
const MERCHANT_NAME='ALEX SANDRO SOARES FERNANDES';
const MERCHANT_CITY='BAURU';
const tlv=(id,value)=>id+String(value.length).padStart(2,'0')+value;
function ascii(s,max){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9 $%*+\-./:]/g,' ').replace(/\s+/g,' ').trim().toUpperCase().slice(0,max);}
function crc16(s){let crc=0xFFFF;for(let i=0;i<s.length;i++){crc^=s.charCodeAt(i)<<8;for(let j=0;j<8;j++)crc=(crc&0x8000)?((crc<<1)^0x1021):(crc<<1),crc&=0xFFFF;}return crc.toString(16).toUpperCase().padStart(4,'0');}
export function pixPayload({amount,txid='***'}={}){
 const gui=tlv('00','BR.GOV.BCB.PIX');
 const key=tlv('01',PIX_KEY);
 const merchant=tlv('26',gui+key);
 const value=Number(amount);
 let p=tlv('00','01')+tlv('01','12')+merchant+tlv('52','0000')+tlv('53','986');
 if(Number.isFinite(value)&&value>0)p+=tlv('54',value.toFixed(2));
 p+=tlv('58','BR')+tlv('59',ascii(MERCHANT_NAME,25))+tlv('60',ascii(MERCHANT_CITY,15))+tlv('62',tlv('05',ascii(txid,25)||'***'))+'6304';
 return p+crc16(p);
}
export const pixPublicInfo={key:PIX_KEY,merchantName:MERCHANT_NAME,merchantCity:'Bauru/SP'};
