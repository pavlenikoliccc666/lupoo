import test from 'node:test';
import assert from 'node:assert/strict';
import {createHandler,passwordHash,passwordMatches} from '../api/[...path].js';

const env={APP_ORIGIN:'https://rups.test',SUPABASE_URL:'https://db.test',SUPABASE_SERVICE_ROLE_KEY:'test-only',RESEND_API_KEY:'test-only',RESEND_FROM:'Rups <verification@example.com>',OTP_SECRET:'test-only-secret-at-least-32-characters'};
const payload={name:'Test Person',email:'test@example.com',clinic:'Test Clinic',phone:'',interest:'All of the above'};
function mockProvider({emailFails=false,rateAllowed=true}={}) {
 const state={pending:[],enquiries:[],mail:[],calls:[]};
 const fetch=async(url,options)=>{
  const data=options.body?JSON.parse(options.body):null;state.calls.push(url);
  const answer=x=>new Response(JSON.stringify(x));
  if(url==='https://api.resend.com/emails'){state.mail.push(data);return emailFails?new Response('{}',{status:500}):answer({id:'mail'});}
  const path=new URL(url).pathname.split('/rest/v1/')[1];
  if(path==='rpc/rups_rate')return answer(rateAllowed);
  if(path==='rups_verifications'){
    if(options.method==='DELETE'){state.pending=[];return new Response(null,{status:204});}
    state.pending.push({...data,attempts:0});return new Response(null,{status:201});
  }
  if(path==='rpc/rups_verify'){
    const row=state.pending.find(x=>x.id===data.p_id);
    if(!row||row.expires_at<Date.now()||row.attempts>=5)return answer(false);
    if(row.code_hash!==data.p_hash){row.attempts++;return answer(false);}
    state.enquiries.push(row.payload);state.pending=state.pending.filter(x=>x!==row);return answer(true);
  }
  if(path==='rups_sessions')return answer([]);
  throw Error('Unexpected provider request '+path);
 };
 return {state,fetch};
}
async function call(handler,path,body,headers={}) {
 const req={url:path,method:body===undefined?'GET':'POST',body,headers:{origin:env.APP_ORIGIN,'content-type':'application/json',...headers}};
 const res={headers:{},setHeader(k,v){this.headers[k]=v},status(n){this.code=n;return this},json(body){this.body=body;return this}};
 await handler(req,res);return res;
}
test('does not store enquiry until valid email code; rejects replay',async()=>{
 const p=mockProvider(),h=createHandler(env,p.fetch);
 const sent=await call(h,'/api/enquiries',payload);
 assert.equal(sent.code,202);assert.equal(p.state.enquiries.length,0);
 assert.equal(sent.body.code,undefined);
 const code=p.state.mail[0].text.match(/\b\d{6}\b/)[0];
 assert.notEqual(p.state.pending[0].code_hash,code);
 const wrong=await call(h,'/api/enquiries/verify',{challengeId:sent.body.challengeId,code:'000000'});
 assert.equal(wrong.code,400);
 const good=await call(h,'/api/enquiries/verify',{challengeId:sent.body.challengeId,code});
 assert.equal(good.code,201);assert.equal(p.state.enquiries.length,1);
 assert.equal((await call(h,'/api/enquiries/verify',{challengeId:sent.body.challengeId,code})).code,400);
});
test('expired code and five incorrect attempts cannot save a lead',async()=>{
 for(const expire of [true,false]){
  const p=mockProvider(),h=createHandler(env,p.fetch),sent=await call(h,'/api/enquiries',payload);
  const code=p.state.mail[0].text.match(/\b\d{6}\b/)[0];
  if(expire)p.state.pending[0].expires_at=0;
  else for(let i=0;i<5;i++)await call(h,'/api/enquiries/verify',{challengeId:sent.body.challengeId,code:'000000'});
  assert.equal((await call(h,'/api/enquiries/verify',{challengeId:sent.body.challengeId,code})).code,400);
  assert.equal(p.state.enquiries.length,0);
 }
});
test('sending failure removes pending details',async()=>{
 const p=mockProvider({emailFails:true});const result=await call(createHandler(env,p.fetch),'/api/enquiries',payload);
 assert.equal(result.code,503);assert.equal(p.state.pending.length,0);
});
test('rate limits prevent sending',async()=>{
 const p=mockProvider({rateAllowed:false});const result=await call(createHandler(env,p.fetch),'/api/enquiries',payload);
 assert.equal(result.code,429);assert.equal(p.state.mail.length,0);
});
test('admin requires a session; foreign origins rejected; missing configuration fails closed',async()=>{
 const p=mockProvider(),h=createHandler(env,p.fetch);
 assert.equal((await call(h,'/api/admin/enquiries')).code,401);
 assert.equal((await call(h,'/api/enquiries',payload,{origin:'https://evil.test'})).code,403);
 assert.equal((await call(createHandler({APP_ORIGIN:env.APP_ORIGIN},p.fetch),'/api/enquiries',payload)).code,503);
 assert.equal((await call(h,'/api/enquiries',{...payload,email:'bad'})).code,400);
});
test('salted password hashes and length checks',()=>{
 const first=passwordHash('test-long-password'),second=passwordHash('test-long-password');
 assert.notEqual(first,second);assert.equal(passwordMatches('test-long-password',first),true);
 assert.equal(passwordMatches('wrong',first),false);assert.throws(()=>passwordHash('short'));
});
