import {runtime} from './local-runtime.mjs';
const {mf}=await runtime({host:'127.0.0.1',port:4173});
console.log('Lupoo local preview: '+await mf.ready);
process.on('SIGINT',async()=>{await mf.dispose();process.exit();});
