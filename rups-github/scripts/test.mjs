import assert from 'node:assert/strict';
import {runtime} from './local-runtime.mjs';
const {mf,db,token}=await runtime();
const origin='https://lupoo.example';let cookie='';
const call=(path,data,extra={})=>mf.dispatchFetch(origin+path,{method:data?'POST':'GET',headers:{...(data?{'Content-Type':'application/json',Origin:origin}:{}),...(cookie?{Cookie:cookie}:{}),...extra},body:data?JSON.stringify(data):undefined});
try{
 assert.equal((await call('/api/admin/enquiries')).status,401);
 assert.equal((await call('/api/admin/setup',{token:'b'.repeat(64),password:'Local1234!'})).status,403);
 assert.equal((await call('/api/admin/setup',{token,password:'short'})).status,400);
 let r=await call('/api/admin/setup',{token,password:'Local1234!'});assert.equal(r.status,201);cookie=r.headers.get('set-cookie').split(';')[0];assert.match(r.headers.get('set-cookie'),/Secure; HttpOnly; SameSite=Strict/);
 assert.equal((await call('/api/admin/setup',{token,password:'different secure password'})).status,409);
 const details={id:crypto.randomUUID(),name:'Test <script>alert(1)</script>',email:'test@example.com',clinic:'Test clinic',phone:'',interest:'Patient follow-ups'};
 assert.equal((await call('/api/enquiries',details,{Origin:'https://attacker.example'})).status,403);
 assert.equal((await call('/api/enquiries',{...details,email:'bad'})).status,400);
 assert.equal((await call('/api/enquiries',details)).status,201);assert.equal((await call('/api/enquiries',details)).status,201);
 r=await call('/api/admin/enquiries');assert.equal(r.status,200);const saved=await r.json();assert.equal(saved.total,1);assert.equal(saved.enquiries[0].name,details.name);
 assert.equal((await call('/api/admin/logout',{})).status,200);assert.equal((await call('/api/admin/enquiries')).status,401);
 cookie='';assert.equal((await call('/api/admin/login',{password:'wrong password'})).status,401);
 r=await call('/api/admin/login',{password:'Local1234!'});assert.equal(r.status,200);cookie=r.headers.get('set-cookie').split(';')[0];
 const oldCookie=cookie;r=await call('/api/admin/password',{currentPassword:'Local1234!',password:'new secure password'});assert.equal(r.status,200);cookie=r.headers.get('set-cookie').split(';')[0];assert.equal((await call('/api/admin/enquiries',null,{Cookie:oldCookie})).status,401);
 assert.equal((await call('/api/admin/enquiries')).status,200);await db.prepare('UPDATE sessions SET expires_at=0').run();assert.equal((await call('/api/admin/enquiries')).status,401);
 cookie='';for(let i=0;i<8;i++)r=await call('/api/admin/login',{password:'wrong password'});assert.equal(r.status,429);
 for(const page of ['/','/about','/privacy','/terms','/cookies','/admin']){r=await call(page);assert.equal(r.status,200);assert.doesNotMatch(await r.text(),/formsubmit/i);}
 r=await call('/assets/about-clinic.mp4',null,{Range:'bytes=0-99'});assert.equal(r.status,206);assert.equal((await r.arrayBuffer()).byteLength,100);
 console.log('PASS: enquiry persistence, duplicate retry, validation, CSRF, protected reads, setup once, password changes, expiry, logout, rate limits, public pages and video ranges.');
}finally{await mf.dispose();}
