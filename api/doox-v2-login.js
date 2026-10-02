import { verifyPassword, sessionCookie } from './_doox-v2-auth.js';
function json(res,status,body){res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(body));}
function bodyOf(req){if(req.body&&typeof req.body==='object')return req.body;try{return req.body?JSON.parse(req.body):{};}catch{return {};}}
export default async function handler(req,res){
  if(req.method!=='POST') return json(res,405,{ok:false,message:'Método não permitido.'});
  const body=bodyOf(req);
  if(!verifyPassword(body.password)) return json(res,401,{ok:false,message:'Senha administrativa incorreta.'});
  res.setHeader('Set-Cookie',sessionCookie(req));
  return json(res,200,{ok:true,authenticated:true});
}
