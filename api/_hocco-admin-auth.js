import crypto from 'node:crypto';
export const HOCCO_COOKIE='hocco_admin_session';
const secret=()=>String(process.env.HOCCO_ADMIN_SECRET||'');
const hours=()=>Math.max(1,Number(process.env.HOCCO_ADMIN_SESSION_HOURS||12));
export function parseCookies(req){const raw=String(req.headers.cookie||'');return Object.fromEntries(raw.split(';').map(p=>{const i=p.indexOf('=');return i<0?['','']:[p.slice(0,i).trim(),decodeURIComponent(p.slice(i+1).trim())]}).filter(([k])=>k));}
export function verifyPassword(password){const a=Buffer.from(String(password||'')),b=Buffer.from(secret());return Boolean(b.length&&a.length===b.length&&crypto.timingSafeEqual(a,b));}
export function makeSession(){const exp=Date.now()+hours()*3600000,p=`hocco-admin.${exp}`,sig=crypto.createHmac('sha256',secret()).update(p).digest('base64url');return Buffer.from(p).toString('base64url')+'.'+sig;}
export function verifySession(token){if(!token||!secret())return false;try{const [e,s]=String(token).split('.'),p=Buffer.from(e,'base64url').toString('utf8'),x=crypto.createHmac('sha256',secret()).update(p).digest('base64url'),a=Buffer.from(s||''),b=Buffer.from(x);if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return false;const [k,exp]=p.split('.');return k==='hocco-admin'&&Date.now()<Number(exp);}catch{return false;}}
export function isAdmin(req){return verifySession(parseCookies(req)[HOCCO_COOKIE]);}
export function sessionCookie(req){const secure=String(req.headers['x-forwarded-proto']||'').includes('https')||process.env.NODE_ENV==='production';return [`${HOCCO_COOKIE}=${encodeURIComponent(makeSession())}`,'Path=/','HttpOnly','SameSite=Strict',`Max-Age=${hours()*3600}`,secure?'Secure':''].filter(Boolean).join('; ');}
export function clearCookie(req){const secure=String(req.headers['x-forwarded-proto']||'').includes('https')||process.env.NODE_ENV==='production';return [`${HOCCO_COOKIE}=`,'Path=/','HttpOnly','SameSite=Strict','Max-Age=0',secure?'Secure':''].filter(Boolean).join('; ');}
