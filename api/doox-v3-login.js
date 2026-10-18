import crypto from 'node:crypto';
import { verifyPassword, sessionCookie } from './_doox-v2-auth.js';

function json(res,status,body){res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store, max-age=0');res.setHeader('X-Robots-Tag','noindex, nofollow, noarchive');res.setHeader('X-Content-Type-Options','nosniff');res.end(JSON.stringify(body));}
function bodyOf(req){if(req.body&&typeof req.body==='object')return req.body;try{return req.body?JSON.parse(req.body):{}}catch{return{}}}
function safeEqual(input,expected){const a=Buffer.from(String(input||'')),b=Buffer.from(String(expected||''));return Boolean(b.length&&a.length===b.length&&crypto.timingSafeEqual(a,b));}
function passwordMatches(input){if(process.env.DOOX_ADMIN_PASSWORD_HASH)return verifyPassword(input);return safeEqual(input,process.env.DOOX_ADMIN_SECRET);}
export default async function handler(req,res){if(req.method!=='POST')return json(res,405,{ok:false,message:'Método não permitido.'});if(!process.env.DOOX_ADMIN_SECRET&&!process.env.DOOX_ADMIN_PASSWORD_HASH)return json(res,503,{ok:false,message:'Autenticação administrativa não configurada.'});const {password}=bodyOf(req);if(!passwordMatches(password))return json(res,401,{ok:false,message:'Senha incorreta.'});res.setHeader('Set-Cookie',sessionCookie(req));return json(res,200,{ok:true,authenticated:true});}
