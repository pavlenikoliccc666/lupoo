// Local-only QA: deterministic codes, no emails, no database, no real contact data.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname } from 'node:path';
import { verificationEmail } from '../lib/verification-email.js';
const root = fileURLToPath(new URL('../public/', import.meta.url));
const types = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.mp4':'video/mp4','.svg':'image/svg+xml'};
http.createServer(async(req,res)=>{
  const path = new URL(req.url, 'http://127.0.0.1').pathname;
  res.setHeader('Cache-Control','no-store');
  if (path === '/email-preview') {res.setHeader('Content-Type','text/html');return res.end(verificationEmail('123456','http://127.0.0.1:5180').html);}
  if (path.startsWith('/api/')) {
    let raw='';for await(const chunk of req) raw+=chunk;
    const body=JSON.parse(raw||'{}');res.setHeader('Content-Type','application/json');
    if(path==='/api/enquiries') {res.statusCode=202;return res.end(JSON.stringify({verificationRequired:true,challengeId:'a'.repeat(64)}));}
    res.statusCode=body.code==='123456'?201:400;
    return res.end(JSON.stringify(body.code==='123456'?{saved:true}:{error:'Code invalid, expired or already used. Request a new code if needed.'}));
  }
  const file=resolve(root,'.'+(path==='/'?'/index.html':decodeURIComponent(path)));
  if(!file.startsWith(root)){res.statusCode=403;return res.end();}
  try{const data=await readFile(file);res.setHeader('Content-Type',types[extname(file)]||'application/octet-stream');res.end(data);}catch{res.statusCode=404;res.end('Not found');}
}).listen(5180,'127.0.0.1',()=>console.log('Verification QA: http://127.0.0.1:5180'));
