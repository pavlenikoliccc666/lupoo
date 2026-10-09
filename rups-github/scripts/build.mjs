import fs from 'node:fs';
import path from 'node:path';
import {build} from 'esbuild';
const root=process.cwd(),out=path.join(root,'dist');
if(path.dirname(out)!==root||path.basename(out)!=='dist')throw Error('Invalid build path');
fs.rmSync(out,{recursive:true,force:true});
const assets={};const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.mp4':'video/mp4','.svg':'image/svg+xml'};
function scan(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())scan(file);else{const key='/'+path.relative('public',file).split(path.sep).join('/');assets[key]={type:types[path.extname(file)]||'application/octet-stream',data:fs.readFileSync(file).toString('base64')};}}}
scan('public');
await build({entryPoints:['server/index.js'],bundle:true,format:'esm',platform:'browser',target:'es2022',outfile:'dist/server/index.js',minify:true,tsconfigRaw:{},plugins:[{name:'virtual-source',setup(b){b.onResolve({filter:/.*/},args=>({path:args.path,namespace:'source'}));b.onLoad({filter:/.*/,namespace:'source'},args=>({contents:args.path==='site-assets'?'export default '+JSON.stringify(assets):args.path==='crypto'?'export default {}':fs.readFileSync(args.path==='bcryptjs'?'node_modules/bcryptjs/index.js':args.path,'utf8'),loader:'js'}));}}]});
fs.mkdirSync('dist/.openai',{recursive:true});fs.copyFileSync('.openai/hosting.json','dist/.openai/hosting.json');fs.cpSync('drizzle','dist/.openai/drizzle',{recursive:true});
console.log('Built Lupoo website and protected enquiry API.');
