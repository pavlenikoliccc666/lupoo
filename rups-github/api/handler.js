import { randomBytes, randomInt, createHash, createHmac, scryptSync, timingSafeEqual } from 'node:crypto';
import { verificationEmail } from '../lib/verification-email.js';

const cookie = '__Host-rups_admin';
const hash = value => createHash('sha256').update(value).digest('hex');
const token = () => randomBytes(32).toString('hex');
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const unavailable = () => fail('This service is not connected yet. Please email support@rups.io.', 503);
export function passwordHash(value, salt = randomBytes(16).toString('hex')) {
  if (typeof value !== 'string' || value.length < 8 || Buffer.byteLength(value) > 72) fail('Choose a password of 8–72 bytes.');
  return `${salt}:${scryptSync(value, salt, 64).toString('hex')}`;
}
export function passwordMatches(value, stored) {
  if (typeof value !== 'string' || Buffer.byteLength(value) > 72 || !stored) return false;
  const [salt, expected] = stored.split(':');
  const actual = scryptSync(value, salt, 64);
  const bytes = Buffer.from(expected || '', 'hex');
  return bytes.length === actual.length && timingSafeEqual(bytes, actual);
}
export function details(data) {
  if (data._honey) fail('Unable to accept this request.');
  const result = {};
  for (const [key, max] of Object.entries({name:120,email:254,clinic:160,phone:40,interest:80})) {
    const value = data[key] ?? (key === 'phone' ? '' : null);
    if (typeof value !== 'string' || value.length > max || /[\x00-\x1f]/.test(value) || (key !== 'phone' && !value.trim())) fail('Please check your contact details.');
    result[key] = value.trim();
  }
  result.email = result.email.toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email)) fail('Please check your email address.');
  if (!['Booking more appointments','Answering enquiries 24/7','Patient follow-ups','Reducing administration','All of the above'].includes(result.interest)) fail('Choose an area of interest.');
  return result;
}

export function createHandler(env = process.env, transport = fetch) {
  async function db(path, method = 'GET', body, extra = {}) {
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) unavailable();
    const response = await transport(`${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/${path}`, {
      method, headers: { apikey:env.SUPABASE_SERVICE_ROLE_KEY, Authorization:`Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type':'application/json', ...extra },
      body: body === undefined ? undefined : JSON.stringify(body), signal:AbortSignal.timeout(10000)
    });
    if (!response.ok) { if(response.status === 409) fail('This action has already been completed.',409); throw new Error('Database request failed'); }
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }
  async function rate(key, limit, seconds) {
    const allowed = await db('rpc/rups_rate','POST',{p_key:hash(key),p_limit:limit,p_seconds:seconds});
    if (!allowed) fail('Too many attempts. Please wait and try again.',429);
  }
  const otpHash = (id, code) => createHmac('sha256', env.OTP_SECRET).update(`${id}:${code}`).digest('hex');
  async function owner() { return (await db('rups_admin?id=eq.1&select=*'))[0]; }
  async function authenticated(req) {
    const raw = req.headers.cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith(cookie+'='))?.slice(cookie.length+1);
    if (!/^[a-f0-9]{64}$/.test(raw || '')) fail('Please sign in.',401);
    const sessions = await db(`rups_sessions?token_hash=eq.${hash(raw)}&expires_at=gt.${Date.now()}&select=*`);
    const admin = sessions.length ? await owner() : null;
    if (!admin || sessions[0].version !== admin.version) fail('Please sign in.',401);
    return {admin, tokenHash:hash(raw)};
  }
  async function startSession(res, version) {
    const raw = token();
    await db('rups_sessions','POST',{token_hash:hash(raw),version,expires_at:Date.now()+8*3600000});
    res.setHeader('Set-Cookie',`${cookie}=${raw}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=28800`);
  }
  return async function handler(req,res) {
    res.setHeader('Cache-Control','no-store'); res.setHeader('X-Content-Type-Options','nosniff'); res.setHeader('X-Robots-Tag','noindex, nofollow');
    try {
      const url = new URL(req.url, 'https://rups.invalid');
      const route = req.query?.route || url.searchParams.get('route');
      const path = route ? '/api/' + route : url.pathname;
      const ip = req.headers['x-vercel-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
      if (!['POST','GET'].includes(req.method)) fail('Method not allowed.',405);
      if (req.method === 'POST') {
        // Trust configured origin, never client-provided forwarded host values.
        if (!env.APP_ORIGIN || req.headers.origin !== env.APP_ORIGIN) fail('Request origin rejected.',403);
        if (!req.headers['content-type']?.startsWith('application/json')) fail('Use JSON.',415);
      }
      let data = req.body || {};
      if (typeof data === 'string') { if(Buffer.byteLength(data)>4096) fail('Request too large.',413); try {data=JSON.parse(data);} catch {fail('Invalid details.');} }
      if (Buffer.byteLength(JSON.stringify(data))>4096) fail('Request too large.',413);
      if (!data || Array.isArray(data) || typeof data !== 'object') fail('Invalid details.');
      if (path === '/api/enquiries' && req.method === 'POST') {
        if (!env.RESEND_API_KEY || !env.RESEND_FROM || !env.OTP_SECRET || env.OTP_SECRET.length<32) unavailable();
        const payload = details(data);
        await rate(`send-ip:${ip}`,10,3600);
        await rate(`send-email-minute:${payload.email}`,1,60);
        await rate(`send-email-day:${payload.email}`,10,86400);
        const id = token(), code = String(randomInt(100000,1000000));
        await db('rups_verifications','POST',{id,code_hash:otpHash(id,code),payload,expires_at:Date.now()+600000});
        try {
          const sent = await transport('https://api.resend.com/emails', {method:'POST',headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':`verification-${id}`},body:JSON.stringify({from:env.RESEND_FROM,to:[payload.email],...verificationEmail(code,env.APP_ORIGIN)}),signal:AbortSignal.timeout(10000)});
          if (!sent.ok) throw new Error('Email rejected');
        } catch {
          await db(`rups_verifications?id=eq.${id}`,'DELETE');
          fail('We could not send the code. Please try again later or email support@rups.io.',503);
        }
        return res.status(202).json({verificationRequired:true,challengeId:id,expiresIn:600});
      }
      if (path === '/api/enquiries/verify' && req.method === 'POST') {
        if (!env.OTP_SECRET) unavailable();
        if (!/^[a-f0-9]{64}$/.test(data.challengeId || '') || !/^\d{6}$/.test(data.code || '')) fail('Enter the six-digit code from your email.');
        await rate(`verify:${ip}`,30,900);
        const saved = await db('rpc/rups_verify','POST',{p_id:data.challengeId,p_hash:otpHash(data.challengeId,data.code)});
        if (!saved) fail('Code invalid, expired or already used. Request a new code if needed.');
        return res.status(201).json({saved:true});
      }
      if (path === '/api/admin/setup' && req.method === 'POST') {
        await rate(`setup:${ip}`,5,900);
        if (!env.ADMIN_SETUP_HASH || !/^[a-f0-9]{64}$/.test(data.token || '') || hash(data.token)!==env.ADMIN_SETUP_HASH || !(Number(env.ADMIN_SETUP_EXPIRES)>Date.now())) fail('This setup link is invalid or expired.',403);
        const encoded = passwordHash(data.password);
        await db('rups_admin','POST',{id:1,password_hash:encoded,version:1});
        await startSession(res,1); return res.status(201).json({created:true});
      }
      if (path === '/api/admin/login' && req.method === 'POST') {
        await rate(`login:${ip}`,8,900);
        const admin = await owner();
        if (!admin || !passwordMatches(data.password,admin.password_hash)) fail('Incorrect password or admin setup is incomplete.',401);
        await startSession(res,admin.version); return res.status(200).json({authenticated:true});
      }
      if (path.startsWith('/api/admin/')) {
        const current = await authenticated(req);
        if (path === '/api/admin/session' && req.method === 'GET') return res.status(200).json({authenticated:true});
        if (path === '/api/admin/enquiries' && req.method === 'GET') {
          const offset = Number(url.searchParams.get('offset') || 0);
          if (!Number.isSafeInteger(offset) || offset<0) fail('Invalid page.');
          const enquiries = await db(`rups_enquiries?select=*&order=created_at.desc,id.desc&limit=50&offset=${offset}`);
          const total = await db('rpc/rups_enquiry_count','POST',{});
          return res.status(200).json({enquiries,total});
        }
        if (path === '/api/admin/logout' && req.method === 'POST') {
          await db(`rups_sessions?token_hash=eq.${current.tokenHash}`,'DELETE');
          res.setHeader('Set-Cookie',`${cookie}=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0`);
          return res.status(200).json({loggedOut:true});
        }
        if (path === '/api/admin/password' && req.method === 'POST') {
          await rate(`password:${ip}`,5,900);
          if (!passwordMatches(data.currentPassword,current.admin.password_hash)) fail('Current password is incorrect.',401);
          const changed = await db('rpc/rups_change_password','POST',{p_old:current.admin.password_hash,p_new:passwordHash(data.password)});
          if (!changed) fail('Password changed in another session. Sign in again.',409);
          await startSession(res,changed); return res.status(200).json({changed:true});
        }
      }
      fail('Not found.',404);
    } catch(error) {
      return res.status(error.status || 503).json({error:error.status ? error.message : 'Temporarily unavailable. Please try again or email support@rups.io.'});
    }
  };
}
export default createHandler();
