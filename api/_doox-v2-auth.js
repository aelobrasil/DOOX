import crypto from 'node:crypto';

const DEFAULT_ADMIN_PASSWORD_HASH = 'scrypt$N=16384,r=8,p=1$6R2yxd0DTs7360wsZYo3xA$gyJHji-UBmYdT4_CkjQB3CwS0zg3O0WSiGDzfiBZM0U';
export const V2_COOKIE = 'doox_v2_admin_session';

function passwordHash(){ return String(process.env.DOOX_ADMIN_PASSWORD_HASH || DEFAULT_ADMIN_PASSWORD_HASH); }
function sessionSecret(){ return String(process.env.DOOX_ADMIN_SECRET || process.env.DOOX_ADMIN_SESSION_SECRET || passwordHash()); }

export function parseCookies(req){
  const raw = String(req.headers.cookie || '');
  return Object.fromEntries(raw.split(';').map(part=>{
    const i=part.indexOf('='); if(i<0) return ['',''];
    return [part.slice(0,i).trim(),decodeURIComponent(part.slice(i+1).trim())];
  }).filter(([k])=>k));
}

export function verifyPassword(password){
  try{
    const parts=passwordHash().split('$');
    if(parts.length!==4 || parts[0]!=='scrypt') return false;
    const params=Object.fromEntries(parts[1].split(',').map(x=>x.split('=')));
    const N=Number(params.N), r=Number(params.r), p=Number(params.p);
    if(![N,r,p].every(Number.isFinite)) return false;
    const salt=Buffer.from(parts[2],'base64url');
    const expected=Buffer.from(parts[3],'base64url');
    const derived=crypto.scryptSync(String(password||''),salt,expected.length,{N,r,p,maxmem:64*1024*1024});
    return derived.length===expected.length && crypto.timingSafeEqual(derived,expected);
  }catch{return false;}
}

export function makeSession(){
  const hours=Math.max(1,Number(process.env.DOOX_ADMIN_SESSION_HOURS||12));
  const expires=Date.now()+hours*3600000;
  const payload=`admin-v2.${expires}`;
  const sig=crypto.createHmac('sha256',sessionSecret()).update(payload).digest('base64url');
  return `${Buffer.from(payload).toString('base64url')}.${sig}`;
}

export function verifySession(token){
  if(!token) return false;
  try{
    const [encoded,received]=String(token).split('.');
    if(!encoded||!received) return false;
    const payload=Buffer.from(encoded,'base64url').toString('utf8');
    const expected=crypto.createHmac('sha256',sessionSecret()).update(payload).digest('base64url');
    const a=Buffer.from(received), b=Buffer.from(expected);
    if(a.length!==b.length || !crypto.timingSafeEqual(a,b)) return false;
    const [kind,expiresRaw]=payload.split('.');
    return kind==='admin-v2' && Number.isFinite(Number(expiresRaw)) && Date.now()<Number(expiresRaw);
  }catch{return false;}
}

export function isAdmin(req){
  if(verifySession(parseCookies(req)[V2_COOKIE])) return true;
  const secret=String(process.env.DOOX_ADMIN_SECRET||'');
  const header=String(req.headers['x-doox-admin-secret']||'');
  return Boolean(secret && header && header===secret);
}

export function sessionCookie(req){
  const hours=Math.max(1,Number(process.env.DOOX_ADMIN_SESSION_HOURS||12));
  const secure=String(req.headers['x-forwarded-proto']||'').includes('https') || process.env.NODE_ENV==='production';
  return [`${V2_COOKIE}=${encodeURIComponent(makeSession())}`,'Path=/','HttpOnly','SameSite=Strict',`Max-Age=${hours*3600}`,secure?'Secure':''].filter(Boolean).join('; ');
}

export function clearCookie(req){
  const secure=String(req.headers['x-forwarded-proto']||'').includes('https') || process.env.NODE_ENV==='production';
  return [`${V2_COOKIE}=`,'Path=/','HttpOnly','SameSite=Strict','Max-Age=0',secure?'Secure':''].filter(Boolean).join('; ');
}
