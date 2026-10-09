import {Miniflare} from 'miniflare';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
export async function runtime(options={}){
 const token='a'.repeat(64);
 const mf=new Miniflare({modules:true,scriptPath:'dist/server/index.js',compatibilityDate:'2026-01-01',d1Databases:['DB'],bindings:{ADMIN_SETUP_HASH:createHash('sha256').update(token).digest('hex'),ADMIN_SETUP_EXPIRES:String(Date.now()+86400000)},...options});
 const db=await mf.getD1Database('DB');
 for(const file of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())for(const statement of fs.readFileSync('drizzle/'+file,'utf8').split('--> statement-breakpoint'))if(statement.trim())await db.prepare(statement).run();
 return {mf,db,token};
}
