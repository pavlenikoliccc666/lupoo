import bcrypt from 'bcryptjs';
import assets from 'site-assets';
const cookieName='__Host-lupoo_admin';
const encoder=new TextEncoder();
const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...headers}});
const digest=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value))),b=>b.toString(16).padStart(2,'0')).join('');
const random=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
function db(env){if(!env.DB)throw Error('Database unavailable');return env.DB;}
const sql=(env,query,...args)=>db(env).prepare(query).bind(...args);
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
function password(value){if(typeof value!=='string'||value.length<8||encoder.encode(value).length>72)fail('Choose a password of at least 8 characters and no more than 72 bytes.');return value;}
async function body(request){
 if(!request.headers.get('content-type')?.startsWith('application/json'))fail('Use JSON.',415);
 const reader=request.body?.getReader();if(!reader)fail('Missing details.');let size=0,parts=[];
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>4096){await reader.cancel();fail('Request too large.',413);}parts.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}
 try {const data=JSON.parse(new TextDecoder().decode(bytes));if(!data||Array.isArray(data)||typeof data!=='object')throw Error();return data;}catch{fail('Invalid details.');}
}
async function rate(env,request,action,limit,seconds){
 const now=Math.floor(Date.now()/1000),bucket=Math.floor(now/seconds);
 const ip=request.headers.get('cf-connecting-ip')||'unknown';
 const key=await digest(`${action}:${ip}:${bucket}`);
 const result=await sql(env,'INSERT INTO limits (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count',key,now+seconds).first();
 if(result.count>limit)fail('Too many attempts. Please try again later.',429);
}
async function session(env,request){
 const raw=request.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName+'='))?.slice(cookieName.length+1);
 if(!raw||! /^[a-f0-9]{64}$/.test(raw))return null;
 const hash=await digest(raw);return await sql(env,'SELECT token_hash FROM sessions WHERE token_hash=? AND expires_at>?',hash,Date.now()).first();
}
async function requireAdmin(env,request){const s=await session(env,request);if(!s)fail('Please sign in.',401);return s;}
async function startSession(env){const token=random();await sql(env,'INSERT INTO sessions (token_hash,expires_at) VALUES (?,?)',await digest(token),Date.now()+8*3600000).run();return `${cookieName}=${token}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=28800`;}
async function api(request,env,ctx,url){
 if(request.method==='POST'&&request.headers.get('origin')!==url.origin)fail('Request origin rejected.',403);
 if(!['GET','POST'].includes(request.method))fail('Method not allowed.',405);
 const path=url.pathname;
 if(path==='/api/admin/session'&&request.method==='GET'){await requireAdmin(env,request);return json({authenticated:true});}
 if(path==='/api/admin/enquiries'&&request.method==='GET'){
  await requireAdmin(env,request);
  const offset=Number(url.searchParams.get('offset')||0);if(!Number.isSafeInteger(offset)||offset<0)fail('Invalid page.');
  const rows=await sql(env,'SELECT * FROM enquiries ORDER BY created_at DESC,id DESC LIMIT 50 OFFSET ?',offset).all();
  const total=await sql(env,'SELECT COUNT(*) AS total FROM enquiries').first();return json({enquiries:rows.results,total:total.total});
 }
 if(request.method!=='POST')fail('Not found.',404);
 const data=await body(request);
 if(path==='/api/enquiries'){
  await rate(env,request,'enquiry',10,3600);
  if(data._honey)fail('Unable to accept this request.');
  const field=(key,max,optional=false)=>{const val=data[key];if(typeof val!=='string'||val.length>max||(!optional&&!val.trim())||/[\x00-\x1f]/.test(val))fail('Please check your contact details.');return val.trim();};
  const id=field('id',36),name=field('name',120),email=field('email',254),clinic=field('clinic',160),phone=field('phone',40,true),interest=field('interest',80);
  if(!/^[a-f0-9-]{36}$/.test(id)||!/^\S+@\S+\.\S+$/.test(email))fail('Please check your email.');
  if(!['Booking more appointments','Answering enquiries 24/7','Patient follow-ups','Reducing administration','All of the above'].includes(interest))fail('Choose an area of interest.');
  await sql(env,'INSERT INTO enquiries (id,name,email,clinic,phone,interest,created_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING',id,name,email,clinic,phone,interest,Date.now()).run();
  ctx.waitUntil(sql(env,'DELETE FROM limits WHERE expires_at<?',Math.floor(Date.now()/1000)).run());
  return json({saved:true},201);
 }
 if(path==='/api/admin/setup'){
  await rate(env,request,'setup',5,900);
  if(!env.ADMIN_SETUP_HASH||!Number.isFinite(Number(env.ADMIN_SETUP_EXPIRES))||Date.now()>Number(env.ADMIN_SETUP_EXPIRES)||typeof data.token!=='string'||data.token.length!==64||await digest(data.token)!==env.ADMIN_SETUP_HASH)fail('This setup link is invalid or expired.',403);
  if(await sql(env,'SELECT id FROM admin WHERE id=1').first())fail('Setup is already complete. Please sign in.',409);
  const hash=await bcrypt.hash(password(data.password),12);
  const result=await sql(env,'INSERT INTO admin (id,password_hash) VALUES (1,?) ON CONFLICT(id) DO NOTHING',hash).run();
  if(!result.meta.changes)fail('Setup is already complete. Please sign in.',409);
  // A completed setup clears the login lockout accumulated before an account existed.
  const bucket=Math.floor(Math.floor(Date.now()/1000)/900);
  const loginKey=await digest(`login:${request.headers.get('cf-connecting-ip')||'unknown'}:${bucket}`);
  await sql(env,'DELETE FROM limits WHERE key=?',loginKey).run();
  return json({created:true},201,{'Set-Cookie':await startSession(env)});
 }
 if(path==='/api/admin/login'){
  await rate(env,request,'login',8,900);
  const owner=await sql(env,'SELECT password_hash FROM admin WHERE id=1').first();
  if(!owner)fail('Use your private setup link to create your password.',401);
  if(typeof data.password!=='string'||encoder.encode(data.password).length>72||!await bcrypt.compare(data.password,owner.password_hash))fail('Incorrect password.',401);
  await sql(env,'DELETE FROM sessions WHERE expires_at<?',Date.now()).run();
  return json({authenticated:true},200,{'Set-Cookie':await startSession(env)});
 }
 if(path==='/api/admin/logout'){
  const s=await requireAdmin(env,request);await sql(env,'DELETE FROM sessions WHERE token_hash=?',s.token_hash).run();return json({loggedOut:true},200,{'Set-Cookie':`${cookieName}=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0`});
 }
 if(path==='/api/admin/password'){
  await requireAdmin(env,request);await rate(env,request,'password',5,900);
  const owner=await sql(env,'SELECT password_hash FROM admin WHERE id=1').first();
  if(typeof data.currentPassword!=='string'||encoder.encode(data.currentPassword).length>72||!await bcrypt.compare(data.currentPassword,owner.password_hash))fail('Current password is incorrect.',401);
  const hash=await bcrypt.hash(password(data.password),12);
  await db(env).batch([sql(env,'UPDATE admin SET password_hash=? WHERE id=1',hash),sql(env,'DELETE FROM sessions')]);
  return json({changed:true},200,{'Set-Cookie':await startSession(env)});
 }
 fail('Not found.',404);
}
function staticFile(request,url){
 let path=url.pathname;if(path==='/')path='/index.html';else if(!path.split('/').pop().includes('.'))path+='.html';
 const asset=assets[path];if(!asset)return new Response('Page not found',{status:404});
 if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
 const bytes=Uint8Array.from(atob(asset.data),c=>c.charCodeAt(0));
 const headers={'Content-Type':asset.type,'Accept-Ranges':'bytes','Cache-Control':path.startsWith('/admin')?'no-store':'public, max-age=300'};
 const range=request.headers.get('range')?.match(/^bytes=(\d+)-(\d*)$/);
 if(range){const start=Number(range[1]),end=range[2]?Math.min(Number(range[2]),bytes.length-1):bytes.length-1;if(start>end)return new Response(null,{status:416,headers:{'Content-Range':`bytes */${bytes.length}`}});headers['Content-Range']=`bytes ${start}-${end}/${bytes.length}`;headers['Content-Length']=String(end-start+1);return new Response(request.method==='HEAD'?null:bytes.slice(start,end+1),{status:206,headers});}
 headers['Content-Length']=String(bytes.length);return new Response(request.method==='HEAD'?null:bytes,{headers});
}
export default {async fetch(request,env,ctx){
 const url=new URL(request.url);let response;
 try{response=url.pathname.startsWith('/api/')?await api(request,env,ctx,url):staticFile(request,url);}
 catch(error){if(!error.status)console.error('Lupoo request failed',error.name);response=json({error:error.status?error.message:'Temporarily unavailable. Please try again.'},error.status||503);}
 response.headers.set('X-Content-Type-Options','nosniff');response.headers.set('Referrer-Policy','no-referrer');response.headers.set('X-Frame-Options','DENY');
 response.headers.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self'; connect-src 'self'; frame-ancestors 'none'; form-action 'self'; base-uri 'none'");
 if(url.pathname.startsWith('/admin')||url.pathname.startsWith('/api/'))response.headers.set('X-Robots-Tag','noindex, nofollow');
 return response;
}};
